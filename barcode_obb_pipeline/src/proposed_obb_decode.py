from __future__ import annotations

from pathlib import Path

import numpy as np

from .barcode_decode import decode_image_combined
from .obb_detect import detect_barcodes_obb, model_exists
from .roi_preprocess import adaptive_preprocess_roi
from .roi_quality import assess_roi_quality
from .rotated_crop import warp_rotated_roi
from .utils import now_ms, read_image, resolve_project_path


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _points_center(points: np.ndarray) -> tuple[float, float]:
    center = np.mean(points.reshape(4, 2), axis=0)
    return float(center[0]), float(center[1])


def _points_area(points: np.ndarray) -> float:
    try:
        import cv2

        return float(abs(cv2.contourArea(points.astype(np.float32).reshape(4, 2))))
    except Exception:
        xs = points[:, 0]
        ys = points[:, 1]
        return float(max(xs) - min(xs)) * float(max(ys) - min(ys))


def _normalize_target_frame(target_frame: dict | None) -> dict | None:
    if not target_frame:
        return None

    try:
        x = _clamp(float(target_frame.get("x", 0.0)))
        y = _clamp(float(target_frame.get("y", 0.0)))
        frame_width = _clamp(float(target_frame.get("width", 0.0)), 0.01, 1.0)
        frame_height = _clamp(float(target_frame.get("height", 0.0)), 0.01, 1.0)
    except (TypeError, ValueError, AttributeError):
        return None

    if frame_width <= 0 or frame_height <= 0:
        return None

    if x + frame_width > 1.0:
        frame_width = max(0.01, 1.0 - x)
    if y + frame_height > 1.0:
        frame_height = max(0.01, 1.0 - y)

    return {
        "x": x,
        "y": y,
        "width": frame_width,
        "height": frame_height,
        "reference": target_frame.get("reference") or "scan_frame",
    }


def _center_distance_ratio(
    center_x: float,
    center_y: float,
    width: int,
    height: int,
    target_frame: dict | None = None,
) -> float:
    if width <= 0 or height <= 0:
        return 1.0

    normalized_frame = _normalize_target_frame(target_frame)
    if normalized_frame:
        target_width = max(width * normalized_frame["width"], 1.0)
        target_height = max(height * normalized_frame["height"], 1.0)
        target_center_x = width * (normalized_frame["x"] + (normalized_frame["width"] / 2))
        target_center_y = height * (normalized_frame["y"] + (normalized_frame["height"] / 2))
    else:
        target_width = float(width)
        target_height = float(height)
        target_center_x = width / 2
        target_center_y = height / 2

    normalized_x = (center_x - target_center_x) / (target_width / 2)
    normalized_y = (center_y - target_center_y) / (target_height / 2)
    return _clamp(float(np.sqrt((normalized_x * normalized_x) + (normalized_y * normalized_y))) / np.sqrt(2))


def _quality_score(quality: dict) -> float:
    brightness = float(quality.get("brightness") or 0.0)
    contrast = float(quality.get("contrast") or 0.0)
    blur_score = float(quality.get("blur_score") or 0.0)
    min_side = float(quality.get("min_side") or 0.0)

    brightness_score = _clamp(1.0 - (abs(brightness - 128.0) / 128.0))
    contrast_score = _clamp(contrast / 70.0)
    blur_normalized = _clamp(np.log10(max(blur_score, 0.0) + 1.0) / 3.0)
    size_score = _clamp(min_side / 220.0)

    return round(
        (brightness_score * 0.22)
        + (contrast_score * 0.26)
        + (blur_normalized * 0.26)
        + (size_score * 0.26),
        4,
    )


def _candidate_score(
    *,
    success: bool,
    detection: dict,
    quality: dict | None,
    center_distance: float,
    detection_area_ratio: float,
) -> float:
    confidence_score = _clamp(float(detection.get("confidence") or 0.0))
    center_score = _clamp(1.0 - center_distance)
    area_score = _clamp(np.sqrt(max(detection_area_ratio, 0.0)) * 3.0)
    roi_quality_score = _quality_score(quality or {})
    success_score = 1.0 if success else 0.0

    return round(
        (success_score * 0.36)
        + (confidence_score * 0.24)
        + (center_score * 0.18)
        + (area_score * 0.10)
        + (roi_quality_score * 0.12),
        4,
    )


def _decoded_text(candidate_result: dict) -> str | None:
    decoded_texts = candidate_result.get("decoded_texts") or []
    if not decoded_texts:
        return None
    return str(decoded_texts[0]).strip() or None


def _best_candidate(candidates: list[dict]) -> dict | None:
    successful = [candidate for candidate in candidates if candidate.get("success")]
    if not successful:
        return None
    return max(successful, key=lambda candidate: candidate.get("score") or 0.0)


def _build_arbitration(candidates: list[dict]) -> dict:
    successful = [candidate for candidate in candidates if candidate.get("success")]
    unique_texts = []
    for candidate in successful:
        text = candidate.get("decoded_text")
        if text and text not in unique_texts:
            unique_texts.append(text)

    sorted_successful = sorted(successful, key=lambda item: item.get("score") or 0.0, reverse=True)
    best = sorted_successful[0] if sorted_successful else None
    runner_up = sorted_successful[1] if len(sorted_successful) > 1 else None
    score_margin = None
    if best and runner_up:
        score_margin = round((best.get("score") or 0.0) - (runner_up.get("score") or 0.0), 4)

    return {
        "candidate_count": len(successful),
        "unique_decoded_count": len(unique_texts),
        "requires_user_selection": len(unique_texts) > 1,
        "auto_selectable": len(unique_texts) == 1,
        "score_margin": score_margin,
        "selected_candidate_id": best.get("candidate_id") if best else None,
        "selected_text": best.get("decoded_text") if best else None,
    }


def _empty_result(
    *,
    image_path: Path,
    start_ms: float,
    error: str | None = None,
    detection_time_ms: float = 0.0,
    num_detections: int = 0,
) -> dict:
    return {
        "image_path": str(image_path),
        "success": False,
        "decoded_texts": [],
        "decoded_types": [],
        "num_detections": num_detections,
        "best_preprocessing_mode": None,
        "roi_width": None,
        "roi_height": None,
        "brightness": None,
        "contrast": None,
        "blur_score": None,
        "detection_time_ms": detection_time_ms,
        "preprocessing_time_ms": 0.0,
        "decoding_time_ms": 0.0,
        "total_processing_time_ms": now_ms() - start_ms,
        "error": error,
        "candidates": [],
        "best_candidate": None,
        "arbitration": _build_arbitration([]),
    }


def decode_with_obb_candidates(
    image_path: str,
    model_path: str,
    conf: float = 0.25,
    target_frame: dict | None = None,
) -> dict:
    start_ms = now_ms()
    resolved_image = resolve_project_path(image_path)

    if not model_exists(model_path):
        return _empty_result(
            image_path=resolved_image,
            start_ms=start_ms,
            error=f"Missing OBB model: {resolve_project_path(model_path)}",
        )

    try:
        image = read_image(resolved_image)
    except Exception as error:
        return _empty_result(image_path=resolved_image, start_ms=start_ms, error=str(error))

    detection_start_ms = now_ms()
    detections = detect_barcodes_obb(str(resolved_image), model_path, conf=conf)
    detection_time_ms = now_ms() - detection_start_ms

    if not detections:
        return _empty_result(
            image_path=resolved_image,
            start_ms=start_ms,
            error="No OBB detections found.",
            detection_time_ms=detection_time_ms,
            num_detections=0,
        )

    preprocessing_time_ms = 0.0
    decoding_time_ms = 0.0
    last_quality: dict | None = None
    last_error: str | None = None
    image_height, image_width = image.shape[:2]
    image_area = max(float(image_width * image_height), 1.0)
    normalized_target_frame = _normalize_target_frame(target_frame)
    center_reference = normalized_target_frame.get("reference", "scan_frame") if normalized_target_frame else "image_center"
    candidates: list[dict] = []

    for detection_index, detection in enumerate(detections):
        candidate_base = {
            "candidate_id": f"obb-{detection_index + 1}",
            "detection_index": detection_index,
            "class_id": detection.get("class_id"),
            "class_name": detection.get("class_name"),
            "confidence": detection.get("confidence"),
            "xywhr": detection.get("xywhr"),
            "points": detection.get("points"),
            "source": detection.get("source", "obb"),
            "image_width": image_width,
            "image_height": image_height,
        }

        try:
            points = np.asarray(detection["points"], dtype=np.float32).reshape(4, 2)
            center_x, center_y = _points_center(points)
            detection_area = _points_area(points)
            detection_area_ratio = detection_area / image_area
            center_distance = _center_distance_ratio(
                center_x,
                center_y,
                image_width,
                image_height,
                normalized_target_frame,
            )
            roi = warp_rotated_roi(image, points)
            quality = assess_roi_quality(roi)
            last_quality = quality
        except Exception as error:
            last_error = f"ROI warp failed: {error}"
            candidates.append({
                **candidate_base,
                "success": False,
                "decoded_text": None,
                "decoded_texts": [],
                "decoded_types": [],
                "best_preprocessing_mode": None,
                "roi_width": None,
                "roi_height": None,
                "brightness": None,
                "contrast": None,
                "blur_score": None,
                "center_x": None,
                "center_y": None,
                "center_distance_ratio": None,
                "center_reference": center_reference,
                "target_frame": normalized_target_frame,
                "detection_area_ratio": None,
                "quality_score": 0.0,
                "score": 0.0,
                "error": last_error,
            })
            continue

        preprocess_start_ms = now_ms()
        preprocessing_candidates = adaptive_preprocess_roi(roi)
        preprocessing_time_ms += now_ms() - preprocess_start_ms
        decoded_success = None

        for preprocessing_candidate in preprocessing_candidates:
            mode = preprocessing_candidate.get("mode")
            candidate_image = preprocessing_candidate.get("image")
            if candidate_image is None:
                last_error = preprocessing_candidate.get("error", f"Preprocessing failed: {mode}")
                continue

            decode_start_ms = now_ms()
            decoded = decode_image_combined(candidate_image)
            decoding_time_ms += now_ms() - decode_start_ms

            if decoded.get("success"):
                decoded_success = {
                    "mode": mode,
                    "decoded": decoded,
                }
                break

            if decoded.get("error"):
                last_error = decoded["error"]

        success = bool(decoded_success)
        decoded = decoded_success["decoded"] if decoded_success else {}
        score = _candidate_score(
            success=success,
            detection=detection,
            quality=quality,
            center_distance=center_distance,
            detection_area_ratio=detection_area_ratio,
        )
        candidates.append({
            **candidate_base,
            "success": success,
            "decoded_text": _decoded_text(decoded) if success else None,
            "decoded_texts": decoded.get("decoded_texts", []),
            "decoded_types": decoded.get("decoded_types", []),
            "best_preprocessing_mode": decoded_success["mode"] if decoded_success else None,
            "roi_width": quality["width"],
            "roi_height": quality["height"],
            "brightness": quality["brightness"],
            "contrast": quality["contrast"],
            "blur_score": quality["blur_score"],
            "center_x": center_x,
            "center_y": center_y,
            "center_distance_ratio": round(center_distance, 4),
            "center_reference": center_reference,
            "target_frame": normalized_target_frame,
            "detection_area_ratio": round(detection_area_ratio, 6),
            "quality_score": _quality_score(quality),
            "score": score,
            "error": None if success else (last_error or "Detected ROI, but decoding failed."),
            "decoder_details": decoded.get("details", {}) if success else {},
        })

    best_candidate = _best_candidate(candidates)
    arbitration = _build_arbitration(candidates)
    successful_texts: list[str] = []
    successful_types: list[str] = []
    for candidate in sorted(candidates, key=lambda item: item.get("score") or 0.0, reverse=True):
        if not candidate.get("success"):
            continue
        for text in candidate.get("decoded_texts") or []:
            if text and text not in successful_texts:
                successful_texts.append(text)
        for decoded_type in candidate.get("decoded_types") or []:
            if decoded_type and decoded_type not in successful_types:
                successful_types.append(decoded_type)

    if best_candidate:
        return {
            "image_path": str(resolved_image),
            "success": True,
            "decoded_texts": successful_texts,
            "decoded_types": successful_types,
            "num_detections": len(detections),
            "best_preprocessing_mode": best_candidate.get("best_preprocessing_mode"),
            "roi_width": best_candidate.get("roi_width"),
            "roi_height": best_candidate.get("roi_height"),
            "brightness": best_candidate.get("brightness"),
            "contrast": best_candidate.get("contrast"),
            "blur_score": best_candidate.get("blur_score"),
            "detection_time_ms": detection_time_ms,
            "preprocessing_time_ms": preprocessing_time_ms,
            "decoding_time_ms": decoding_time_ms,
            "total_processing_time_ms": now_ms() - start_ms,
            "error": None,
            "detection": {
                "class_id": best_candidate.get("class_id"),
                "class_name": best_candidate.get("class_name"),
                "confidence": best_candidate.get("confidence"),
                "xywhr": best_candidate.get("xywhr"),
                "points": best_candidate.get("points"),
                "source": best_candidate.get("source"),
            },
            "decoder_details": best_candidate.get("decoder_details", {}),
            "candidates": sorted(candidates, key=lambda item: item.get("score") or 0.0, reverse=True),
            "best_candidate": best_candidate,
            "arbitration": arbitration,
        }

    return {
        "image_path": str(resolved_image),
        "success": False,
        "decoded_texts": [],
        "decoded_types": [],
        "num_detections": len(detections),
        "best_preprocessing_mode": None,
        "roi_width": last_quality.get("width") if last_quality else None,
        "roi_height": last_quality.get("height") if last_quality else None,
        "brightness": last_quality.get("brightness") if last_quality else None,
        "contrast": last_quality.get("contrast") if last_quality else None,
        "blur_score": last_quality.get("blur_score") if last_quality else None,
        "detection_time_ms": detection_time_ms,
        "preprocessing_time_ms": preprocessing_time_ms,
        "decoding_time_ms": decoding_time_ms,
        "total_processing_time_ms": now_ms() - start_ms,
        "error": last_error or "Detected ROI, but decoding failed for all preprocessing candidates.",
        "candidates": sorted(candidates, key=lambda item: item.get("score") or 0.0, reverse=True),
        "best_candidate": None,
        "arbitration": arbitration,
    }


def decode_with_obb_pipeline(
    image_path: str,
    model_path: str,
    conf: float = 0.25,
    target_frame: dict | None = None,
) -> dict:
    return decode_with_obb_candidates(image_path, model_path, conf=conf, target_frame=target_frame)
