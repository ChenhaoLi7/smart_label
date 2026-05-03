from __future__ import annotations

from collections import Counter
from typing import Any

from .baseline_decode import decode_whole_image
from .proposed_obb_decode import decode_with_obb_pipeline
from .utils import discover_images, ensure_dir, resolve_project_path


def _join(values: list[Any]) -> str:
    return " | ".join(str(value) for value in values)


def evaluate_folder(image_folder: str, model_path: str, output_csv: str) -> dict:
    import pandas as pd
    from tqdm import tqdm

    images = discover_images(image_folder)
    rows: list[dict] = []

    for image_path in tqdm(images, desc="Evaluating barcode images"):
        baseline = decode_whole_image(str(image_path))
        proposed = decode_with_obb_pipeline(str(image_path), model_path)

        baseline_success = bool(baseline.get("success"))
        proposed_success = bool(proposed.get("success"))

        rows.append(
            {
                "image_path": str(image_path),
                "baseline_success": baseline_success,
                "proposed_success": proposed_success,
                "baseline_decoded_texts": _join(baseline.get("decoded_texts", [])),
                "proposed_decoded_texts": _join(proposed.get("decoded_texts", [])),
                "baseline_time_ms": baseline.get("processing_time_ms"),
                "proposed_time_ms": proposed.get("total_processing_time_ms"),
                "num_detections": proposed.get("num_detections"),
                "best_preprocessing_mode": proposed.get("best_preprocessing_mode"),
                "roi_width": proposed.get("roi_width"),
                "roi_height": proposed.get("roi_height"),
                "brightness": proposed.get("brightness"),
                "contrast": proposed.get("contrast"),
                "blur_score": proposed.get("blur_score"),
                "proposed_success_but_baseline_failed": proposed_success and not baseline_success,
                "baseline_success_but_proposed_failed": baseline_success and not proposed_success,
                "baseline_error": baseline.get("error"),
                "proposed_error": proposed.get("error"),
            }
        )

    output_path = resolve_project_path(output_csv)
    ensure_dir(output_path.parent)
    frame = pd.DataFrame(rows)
    frame.to_csv(output_path, index=False)

    total = len(rows)
    baseline_success_count = sum(1 for row in rows if row["baseline_success"])
    proposed_success_count = sum(1 for row in rows if row["proposed_success"])
    mode_counter = Counter(
        row["best_preprocessing_mode"]
        for row in rows
        if row.get("best_preprocessing_mode")
    )

    def rate(count: int) -> float:
        return float(count / total * 100.0) if total else 0.0

    return {
        "total_images": total,
        "baseline_success_rate": rate(baseline_success_count),
        "proposed_success_rate": rate(proposed_success_count),
        "improvement_percentage_points": rate(proposed_success_count) - rate(baseline_success_count),
        "average_baseline_time_ms": float(frame["baseline_time_ms"].mean()) if total else 0.0,
        "average_proposed_time_ms": float(frame["proposed_time_ms"].mean()) if total else 0.0,
        "proposed_success_but_baseline_failed_count": int(
            sum(1 for row in rows if row["proposed_success_but_baseline_failed"])
        ),
        "baseline_success_but_proposed_failed_count": int(
            sum(1 for row in rows if row["baseline_success_but_proposed_failed"])
        ),
        "best_preprocessing_mode_distribution": dict(mode_counter),
        "output_csv": str(output_path),
    }
