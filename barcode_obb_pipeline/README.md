# Quality-Aware Rotated ROI Barcode Pipeline

This project is a Python research prototype for smartphone-based barcode reading in a smart warehouse management system.

It compares a simple whole-image decoding baseline with a proposed method:

```text
smartphone image
  -> YOLO-OBB rotated barcode detection
  -> rotated ROI rectification
  -> quality-aware adaptive ROI preprocessing
  -> barcode decoding
  -> evaluation CSV
```

The prototype does not claim to invent YOLO or barcode decoding. The research contribution is the integration of rotated barcode localization, ROI rectification, adaptive ROI preprocessing, and decode-oriented evaluation for warehouse smartphone images.

## Why This Exists

Whole-image decoding can fail when warehouse labels are:

- tilted
- small or far away
- dark
- low contrast
- blurry
- surrounded by complex background
- mixed with multiple labels

The proposed method first localizes the barcode, straightens the ROI, then chooses preprocessing candidates based on ROI quality before decoding.

## Install

```bash
cd barcode_obb_pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If `pyzbar` reports that `zbar` is missing on macOS, install it with:

```bash
brew install zbar
```

## Dataset Layout

Put raw evaluation images here:

```text
data/raw_images/
```

Prepare YOLO-OBB training data here:

```text
data/yolo_obb_dataset/
  images/train/
  images/val/
  images/test/
  labels/train/
  labels/val/
  labels/test/
  data.yaml
```

## YOLO OBB Label Format

Each label line should be:

```text
class_id x1 y1 x2 y2 x3 y3 x4 y4
```

Coordinates are normalized to image width and height. The four point pairs describe the rotated polygon around the barcode.

Class names in `data/yolo_obb_dataset/data.yaml`:

```yaml
names:
  0: qr_code
  1: barcode_1d
```

## Train OBB Model

```bash
cd barcode_obb_pipeline
python scripts/train_obb.py --epochs 80 --imgsz 640 --batch 8
```

The script tries `yolo11n-obb.pt` first and falls back to `yolov8n-obb.pt`. After training, it copies the best model to:

```text
models/best_obb.pt
```

If `models/best_obb.pt` is missing, the proposed pipeline will print a clear message and exit safely instead of crashing.

## Run Baseline

```bash
python scripts/run_baseline.py data/raw_images
```

Or for one image:

```bash
python scripts/run_baseline.py data/raw_images/example.jpg
```

## Run Proposed OBB Pipeline

```bash
python scripts/run_proposed_obb.py data/raw_images --model models/best_obb.pt
```

## Run Evaluation

```bash
python scripts/run_evaluation.py \
  --images data/raw_images \
  --model models/best_obb.pt \
  --output data/results/evaluation.csv
```

The CSV includes:

- baseline success
- proposed success
- decoded texts
- processing time
- number of detections
- best preprocessing mode
- ROI width and height
- brightness
- contrast
- blur score
- baseline-failed proposed-succeeded flag

The printed summary includes:

- total images
- baseline success rate
- proposed success rate
- improvement percentage points
- average processing time
- best preprocessing mode distribution

## Current Scope

The research prototype is also exposed through the existing AI FastAPI service:

```text
POST /api/scanner/roi-assist
```

The frontend should call the Express proxy path above. Express forwards the request to:

```text
POST http://127.0.0.1:8000/scanner/roi-assist
```

This avoids mixed-content problems when the iPad is using the HTTPS frontend.

Expected multipart fields:

```text
frame: image/jpeg or image/png
mode: obb
trigger: manual or auto
```

Health check:

```text
GET /api/scanner/roi-assist/health
```

The endpoint first tries server-side whole-image decoding. If that fails and `mode=obb`, it runs the YOLO-OBB ROI pipeline. If `models/best_obb.pt` does not exist yet, it returns a clear `model_ready: false` response.
