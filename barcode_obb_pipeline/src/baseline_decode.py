from __future__ import annotations

from .barcode_decode import decode_image_combined
from .utils import now_ms, read_image, resolve_project_path


def decode_whole_image(image_path: str) -> dict:
    start_ms = now_ms()
    resolved_path = resolve_project_path(image_path)

    try:
        image = read_image(resolved_path)
        decoded = decode_image_combined(image)
        error = decoded.get("error")
        return {
            "image_path": str(resolved_path),
            "success": decoded["success"],
            "decoded_texts": decoded["decoded_texts"],
            "decoded_types": decoded["decoded_types"],
            "processing_time_ms": now_ms() - start_ms,
            "error": error,
            "engine_details": decoded.get("details", {}),
        }
    except Exception as error:
        return {
            "image_path": str(resolved_path),
            "success": False,
            "decoded_texts": [],
            "decoded_types": [],
            "processing_time_ms": now_ms() - start_ms,
            "error": str(error),
            "engine_details": {},
        }
