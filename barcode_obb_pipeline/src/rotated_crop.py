from __future__ import annotations

import numpy as np


def order_points(points: np.ndarray) -> np.ndarray:
    pts = np.asarray(points, dtype="float32").reshape(4, 2)
    rect = np.zeros((4, 2), dtype="float32")

    sums = pts.sum(axis=1)
    diffs = np.diff(pts, axis=1).reshape(-1)

    rect[0] = pts[np.argmin(sums)]
    rect[2] = pts[np.argmax(sums)]
    rect[1] = pts[np.argmin(diffs)]
    rect[3] = pts[np.argmax(diffs)]
    return rect


def warp_rotated_roi(image: np.ndarray, points: np.ndarray) -> np.ndarray:
    import cv2

    rect = order_points(points)
    top_left, top_right, bottom_right, bottom_left = rect

    width_top = np.linalg.norm(top_right - top_left)
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    max_width = max(int(round(width_top)), int(round(width_bottom)), 1)

    height_right = np.linalg.norm(bottom_right - top_right)
    height_left = np.linalg.norm(bottom_left - top_left)
    max_height = max(int(round(height_right)), int(round(height_left)), 1)

    destination = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype="float32",
    )

    matrix = cv2.getPerspectiveTransform(rect, destination)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))
