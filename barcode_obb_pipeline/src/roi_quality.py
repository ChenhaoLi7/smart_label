from __future__ import annotations

import numpy as np


def _to_gray(image: np.ndarray) -> np.ndarray:
    import cv2

    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def compute_brightness(gray) -> float:
    return float(np.mean(gray))


def compute_contrast(gray) -> float:
    return float(np.std(gray))


def compute_blur_score(gray) -> float:
    import cv2

    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_roi_size(roi) -> dict:
    height, width = roi.shape[:2]
    return {
        "width": int(width),
        "height": int(height),
        "area": int(width * height),
        "min_side": int(min(width, height)),
        "max_side": int(max(width, height)),
        "aspect_ratio": float(width / height) if height else 0.0,
    }


def assess_roi_quality(roi) -> dict:
    gray = _to_gray(roi)
    return {
        **compute_roi_size(roi),
        "brightness": compute_brightness(gray),
        "contrast": compute_contrast(gray),
        "blur_score": compute_blur_score(gray),
    }
