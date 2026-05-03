from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from .utils import resolve_project_path


def _xyxy_to_points(box: np.ndarray) -> list[list[float]]:
    x1, y1, x2, y2 = [float(value) for value in box[:4]]
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]


def _xywhr_to_points(xywhr: np.ndarray) -> list[list[float]]:
    import cv2

    x, y, width, height, rotation = [float(value) for value in xywhr[:5]]
    points = cv2.boxPoints(((x, y), (width, height), rotation))
    return points.astype(float).tolist()


def _to_numpy(value: Any) -> np.ndarray | None:
    if value is None:
        return None
    try:
        if hasattr(value, "cpu"):
            value = value.cpu()
        if hasattr(value, "numpy"):
            return value.numpy()
    except Exception:
        return None
    return np.asarray(value)


def _class_name(names: Any, class_id: int) -> str:
    if isinstance(names, dict):
        return str(names.get(class_id, f"class_{class_id}"))
    if isinstance(names, (list, tuple)) and 0 <= class_id < len(names):
        return str(names[class_id])
    return f"class_{class_id}"


def detect_barcodes_obb(image_path: str, model_path: str, conf: float = 0.25) -> list[dict]:
    resolved_image = resolve_project_path(image_path)
    resolved_model = resolve_project_path(model_path)

    if not resolved_model.exists():
        print(
            "[barcode_obb_pipeline] Missing OBB model. "
            f"Expected: {resolved_model}. Train or copy a model to this path first."
        )
        return []

    try:
        from ultralytics import YOLO
    except Exception as error:
        print(f"[barcode_obb_pipeline] ultralytics unavailable: {error}")
        return []

    try:
        model = YOLO(str(resolved_model))
        results = model(str(resolved_image), conf=conf, verbose=False)
    except Exception as error:
        print(f"[barcode_obb_pipeline] OBB detection failed: {error}")
        return []

    detections: list[dict] = []
    for result in results:
        names = getattr(result, "names", getattr(model, "names", {}))
        obb = getattr(result, "obb", None)

        if obb is not None and getattr(obb, "xyxyxyxy", None) is not None:
            corner_points = _to_numpy(obb.xyxyxyxy)
            xywhr_values = _to_numpy(getattr(obb, "xywhr", None))
            conf_values = _to_numpy(getattr(obb, "conf", None))
            cls_values = _to_numpy(getattr(obb, "cls", None))

            if corner_points is None:
                continue

            for index, points in enumerate(corner_points):
                class_id = int(cls_values[index]) if cls_values is not None else -1
                xywhr = xywhr_values[index].astype(float).tolist() if xywhr_values is not None else None
                if points is None and xywhr is not None:
                    points = np.asarray(_xywhr_to_points(np.asarray(xywhr)), dtype=float)
                detections.append(
                    {
                        "class_id": class_id,
                        "class_name": _class_name(names, class_id),
                        "confidence": float(conf_values[index]) if conf_values is not None else None,
                        "xywhr": xywhr,
                        "points": np.asarray(points, dtype=float).reshape(4, 2).tolist(),
                        "source": "obb",
                    }
                )
            continue

        boxes = getattr(result, "boxes", None)
        if boxes is None or getattr(boxes, "xyxy", None) is None:
            continue

        xyxy_values = _to_numpy(boxes.xyxy)
        conf_values = _to_numpy(getattr(boxes, "conf", None))
        cls_values = _to_numpy(getattr(boxes, "cls", None))
        if xyxy_values is None:
            continue

        for index, box in enumerate(xyxy_values):
            class_id = int(cls_values[index]) if cls_values is not None else -1
            detections.append(
                {
                    "class_id": class_id,
                    "class_name": _class_name(names, class_id),
                    "confidence": float(conf_values[index]) if conf_values is not None else None,
                    "xywhr": None,
                    "points": _xyxy_to_points(box),
                    "source": "horizontal_bbox_fallback",
                }
            )

    return sorted(detections, key=lambda item: item.get("confidence") or 0.0, reverse=True)


def model_exists(model_path: str | Path) -> bool:
    return resolve_project_path(model_path).exists()
