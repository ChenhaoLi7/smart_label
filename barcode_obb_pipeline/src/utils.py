from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_project_path(path: str | Path) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    cwd_candidate = Path.cwd() / candidate
    if cwd_candidate.exists() or cwd_candidate.parent.exists():
        return cwd_candidate.resolve()
    return project_root() / candidate


def ensure_dir(path: str | Path) -> Path:
    resolved = resolve_project_path(path)
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def discover_images(folder: str | Path) -> list[Path]:
    root = resolve_project_path(folder)
    if not root.exists():
        return []
    return sorted(
        path for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def read_image(path: str | Path):
    import cv2

    resolved = resolve_project_path(path)
    image = cv2.imread(str(resolved))
    if image is None:
        raise ValueError(f"Could not read image: {resolved}")
    return image


def now_ms() -> float:
    return time.perf_counter() * 1000.0


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(normalized)
    return output


def normalize_text_list(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        return [values] if values.strip() else []
    if isinstance(values, (list, tuple, set)):
        return dedupe_preserve_order([str(value) for value in values])
    return [str(values)]


def as_serializable(value: Any) -> Any:
    try:
        import numpy as np

        if isinstance(value, np.ndarray):
            return value.tolist()
        if isinstance(value, np.generic):
            return value.item()
    except Exception:
        pass

    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {key: as_serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [as_serializable(item) for item in value]
    return value


def json_dumps(value: Any) -> str:
    return json.dumps(as_serializable(value), ensure_ascii=False, indent=2)
