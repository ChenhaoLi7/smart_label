from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.evaluate import evaluate_folder  # noqa: E402
from src.utils import json_dumps  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate baseline vs proposed OBB ROI pipeline.")
    parser.add_argument("--images", default="data/raw_images")
    parser.add_argument("--model", default="models/best_obb.pt")
    parser.add_argument("--output", default="data/results/evaluation.csv")
    args = parser.parse_args()

    summary = evaluate_folder(args.images, args.model, args.output)
    print(json_dumps(summary))


if __name__ == "__main__":
    main()
