from __future__ import annotations

import numpy as np

from .roi_quality import assess_roi_quality


SMALL_ROI_MIN_SIDE = 180
LOW_BRIGHTNESS_THRESHOLD = 95.0
LOW_CONTRAST_THRESHOLD = 42.0
BLUR_THRESHOLD = 90.0


def _to_gray(image: np.ndarray) -> np.ndarray:
    import cv2

    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _resize(image: np.ndarray, scale: float) -> np.ndarray:
    import cv2

    height, width = image.shape[:2]
    return cv2.resize(
        image,
        (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
        interpolation=cv2.INTER_CUBIC,
    )


def _clahe(image: np.ndarray) -> np.ndarray:
    import cv2

    gray = _to_gray(image)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _sharpen(image: np.ndarray) -> np.ndarray:
    import cv2

    kernel = np.array([[0, -1, 0], [-1, 5.2, -1], [0, -1, 0]], dtype=np.float32)
    return cv2.filter2D(image, -1, kernel)


def _adaptive_threshold(image: np.ndarray) -> np.ndarray:
    import cv2

    gray = _to_gray(image)
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        7,
    )


def _denoise(image: np.ndarray) -> np.ndarray:
    import cv2

    if image.ndim == 2:
        return cv2.fastNlMeansDenoising(image, None, 7, 7, 21)
    return cv2.fastNlMeansDenoisingColored(image, None, 7, 7, 7, 21)


def preprocess_roi(roi, mode: str):
    if mode == "original":
        return roi.copy()
    if mode == "gray":
        return _to_gray(roi)
    if mode == "resize_2x":
        return _resize(roi, 2.0)
    if mode == "resize_3x":
        return _resize(roi, 3.0)
    if mode == "clahe":
        return _clahe(roi)
    if mode == "sharpen":
        return _sharpen(roi)
    if mode == "adaptive_threshold":
        return _adaptive_threshold(roi)
    if mode == "denoise":
        return _denoise(roi)
    if mode == "resize_2x_clahe":
        return _clahe(_resize(roi, 2.0))
    if mode == "resize_2x_sharpen":
        return _sharpen(_resize(roi, 2.0))
    raise ValueError(f"Unknown preprocessing mode: {mode}")


def adaptive_preprocess_roi(roi) -> list[dict]:
    quality = assess_roi_quality(roi)
    modes = ["original", "gray", "adaptive_threshold"]

    if quality["min_side"] < SMALL_ROI_MIN_SIDE:
        modes.extend(["resize_2x", "resize_3x"])

    if (
        quality["brightness"] < LOW_BRIGHTNESS_THRESHOLD
        or quality["contrast"] < LOW_CONTRAST_THRESHOLD
    ):
        modes.extend(["clahe", "resize_2x_clahe"])

    if quality["blur_score"] < BLUR_THRESHOLD:
        modes.extend(["sharpen", "resize_2x_sharpen"])

    modes.append("denoise")

    candidates: list[dict] = []
    seen: set[str] = set()
    for mode in modes:
        if mode in seen:
            continue
        seen.add(mode)
        try:
            candidates.append({"mode": mode, "image": preprocess_roi(roi, mode)})
        except Exception as error:
            candidates.append({"mode": mode, "image": None, "error": str(error)})
    return candidates
