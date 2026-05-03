from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.utils import resolve_project_path  # noqa: E402


def _load_yolo_model(candidates: list[str]):
    from ultralytics import YOLO

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            print(f"Loading YOLO OBB model candidate: {candidate}")
            return YOLO(candidate)
        except Exception as error:
            last_error = error
            print(f"Could not load {candidate}: {error}")
    raise RuntimeError(f"Could not load any YOLO OBB model. Last error: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a YOLO OBB barcode detector.")
    parser.add_argument("--data", default="data/yolo_obb_dataset/data.yaml")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--name", default="barcode_obb")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--device", default="auto", help="Training device: auto, cpu, mps, cuda, 0, ...")
    parser.add_argument("--workers", type=int, default=0, help="Dataloader workers. 0 is safest on macOS.")
    parser.add_argument("--models", nargs="*", default=["yolo11n-obb.pt", "yolov8n-obb.pt"])
    parser.add_argument("--no-copy-best", action="store_true")
    args = parser.parse_args()

    # YOLO OBB label format:
    # class_id x1 y1 x2 y2 x3 y3 x4 y4
    # Coordinates are normalized to image width/height and must follow the
    # four corners of the rotated object polygon.
    data_yaml = resolve_project_path(args.data)
    if not data_yaml.exists():
        raise FileNotFoundError(f"Dataset YAML not found: {data_yaml}")

    try:
        model = _load_yolo_model(args.models)
    except Exception as error:
        raise SystemExit(f"ultralytics/YOLO setup failed: {error}") from error

    device = args.device
    if device == "auto":
        try:
            import torch

            device = "mps" if torch.backends.mps.is_available() else "cpu"
        except Exception:
            device = "cpu"
    print(f"Training device: {device}")

    result = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        workers=args.workers,
        project=str(resolve_project_path("runs/obb")),
        name=args.name,
    )

    save_dir = Path(getattr(result, "save_dir", resolve_project_path(f"runs/obb/{args.name}")))
    best_model = save_dir / "weights" / "best.pt"
    target_model = resolve_project_path("models/best_obb.pt")

    if best_model.exists() and not args.no_copy_best:
        target_model.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_model, target_model)
        print(f"Copied best model to: {target_model}")
    else:
        print(f"Training finished. Best model should be under: {best_model}")


if __name__ == "__main__":
    main()
