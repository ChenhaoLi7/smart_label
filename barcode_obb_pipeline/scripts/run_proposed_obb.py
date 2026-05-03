from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.proposed_obb_decode import decode_with_obb_pipeline  # noqa: E402
from src.utils import discover_images, json_dumps, resolve_project_path  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run proposed YOLO-OBB ROI barcode pipeline.")
    parser.add_argument("input", help="Image file or folder.")
    parser.add_argument("--model", default="models/best_obb.pt")
    parser.add_argument("--conf", type=float, default=0.25)
    args = parser.parse_args()

    input_path = resolve_project_path(args.input)
    if input_path.is_dir():
        results = [
            decode_with_obb_pipeline(str(path), args.model, conf=args.conf)
            for path in discover_images(input_path)
        ]
    else:
        results = decode_with_obb_pipeline(str(input_path), args.model, conf=args.conf)

    print(json_dumps(results))


if __name__ == "__main__":
    main()
