from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.baseline_decode import decode_whole_image  # noqa: E402
from src.utils import discover_images, json_dumps, resolve_project_path  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run whole-image barcode decoding baseline.")
    parser.add_argument("input", help="Image file or folder.")
    args = parser.parse_args()

    input_path = resolve_project_path(args.input)
    if input_path.is_dir():
        results = [decode_whole_image(str(path)) for path in discover_images(input_path)]
    else:
        results = decode_whole_image(str(input_path))

    print(json_dumps(results))


if __name__ == "__main__":
    main()
