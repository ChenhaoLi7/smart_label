"""Frozen, hash-pinned QR recovery fallback for the existing ROI Assist API."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import threading
import time

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("QR_RECOVERY_CONFIG", HERE / "qr_recovery_config.json"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_config() -> dict:
    inline = os.environ.get("QR_RECOVERY_CONFIG_JSON")
    cfg = json.loads(inline) if inline else json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if "QR_RECOVERY_ENABLED" in os.environ:
        cfg["enabled"] = os.environ["QR_RECOVERY_ENABLED"] == "1"
    return cfg


class WorkerCallError(RuntimeError):
    def __init__(self, message: str, *, may_have_processed: bool, transport_failure: bool = False):
        super().__init__(message)
        self.may_have_processed = may_have_processed
        self.transport_failure = transport_failure


class JsonProcess:
    """Length-bounded JSON-lines process with deadlines and explicit cleanup."""
    def __init__(self, args: list[str], env: dict, timeout_ms: int, *, new_session: bool, cancel_event=None):
        self.new_session = new_session
        self.cancel_event = cancel_event
        self.proc = subprocess.Popen(
            args,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
            start_new_session=new_session,
        )
        self.buffer = b""
        try:
            self.ready = self.read(timeout_ms)
        except Exception:
            self.close()
            raise

    def read(self, timeout_ms: int) -> dict:
        deadline = time.monotonic() + max(1, timeout_ms) / 1000
        while b"\n" not in self.buffer:
            if self.cancel_event is not None and self.cancel_event.is_set():
                raise RuntimeError("QR worker operation cancelled during service shutdown")
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("QR worker exceeded its response deadline")
            readable, _, _ = select.select([self.proc.stdout.fileno()], [], [], min(remaining, .1) if self.cancel_event is not None else remaining)
            if not readable:
                if self.cancel_event is not None:
                    continue
                raise TimeoutError("QR worker exceeded its response deadline")
            block = os.read(self.proc.stdout.fileno(), 65536)
            if not block:
                raise RuntimeError("QR worker exited before returning a response")
            self.buffer += block
            if len(self.buffer) > 2 * 1024 * 1024:
                raise RuntimeError("QR worker response exceeded the protocol limit")
        line, self.buffer = self.buffer.split(b"\n", 1)
        return json.loads(line)

    def call(self, message: dict, timeout_ms: int) -> dict:
        if self.proc.poll() is not None:
            raise WorkerCallError("QR worker is not running", may_have_processed=False, transport_failure=True)
        data = json.dumps(message, separators=(",", ":")).encode("utf-8") + b"\n"
        fd = self.proc.stdin.fileno()
        os.set_blocking(fd, False)
        deadline = time.monotonic() + max(1, timeout_ms) / 1000
        offset = 0
        while offset < len(data):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise WorkerCallError(
                    "QR worker input deadline exceeded",
                    may_have_processed=offset >= len(data),
                    transport_failure=True,
                )
            _, writable, _ = select.select([], [fd], [], remaining)
            if not writable:
                raise WorkerCallError(
                    "QR worker input deadline exceeded",
                    may_have_processed=offset >= len(data),
                    transport_failure=True,
                )
            try:
                offset += os.write(fd, data[offset:])
            except BlockingIOError:
                continue
            except (BrokenPipeError, OSError) as error:
                raise WorkerCallError(
                    f"QR worker input failed: {error}", may_have_processed=offset >= len(data), transport_failure=True
                ) from error
        remaining_ms = int((deadline - time.monotonic()) * 1000)
        try:
            return self.read(max(1, remaining_ms))
        except Exception as error:
            raise WorkerCallError(str(error), may_have_processed=True, transport_failure=True) from error

    def close(self):
        try:
            if self.new_session:
                # The worker owns its Node child in the same process group. Kill
                # the group even if Python has already exited to avoid an orphan.
                os.killpg(self.proc.pid, signal.SIGTERM)
            elif self.proc.poll() is None:
                self.proc.terminate()
            self.proc.wait(timeout=2)
        except PermissionError:
            if self.proc.poll() is None:
                self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=2)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                if self.new_session:
                    os.killpg(self.proc.pid, signal.SIGKILL)
                elif self.proc.poll() is None:
                    self.proc.kill()
                self.proc.wait(timeout=2)
            except (ProcessLookupError, PermissionError):
                if self.proc.poll() is None:
                    self.proc.kill()
                    self.proc.wait(timeout=2)
        for stream in (self.proc.stdin, self.proc.stdout):
            if stream and not stream.closed:
                stream.close()


def png_message(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("Could not encode QR ROI")
    return base64.b64encode(encoded).decode("ascii")


def load_png(value: str, max_pixels: int) -> np.ndarray:
    raw = base64.b64decode(value, validate=True)
    encoded = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise ValueError("Invalid ROI image")
    if image.shape[0] * image.shape[1] > max_pixels:
        raise ValueError("ROI exceeds pixel limit")
    return image


def estimate_warp_size(points: np.ndarray) -> tuple[int, int]:
    from src.rotated_crop import order_points

    rect = order_points(points)
    top_left, top_right, bottom_right, bottom_left = rect
    width = max(
        int(round(float(np.linalg.norm(top_right - top_left)))),
        int(round(float(np.linalg.norm(bottom_right - bottom_left)))),
        1,
    )
    height = max(
        int(round(float(np.linalg.norm(bottom_right - top_right)))),
        int(round(float(np.linalg.norm(bottom_left - top_left)))),
        1,
    )
    return width, height


def prefix_images(r1: np.ndarray, r0: np.ndarray) -> list[tuple[str, np.ndarray]]:
    gray = cv2.cvtColor(r1, cv2.COLOR_BGR2GRAY) if r1.ndim == 3 else r1
    return [
        ("R1", r1),
        ("R2", cv2.cvtColor(cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray), cv2.COLOR_GRAY2BGR)),
        ("R3", cv2.addWeighted(r1, 1.8, cv2.GaussianBlur(r1, (0, 0), sigmaX=1.2), -0.8, 0)),
        ("R4", cv2.resize(r1, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)),
        ("R0", r0),
    ]


def model_images(pred: np.ndarray) -> list[tuple[str, np.ndarray]]:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(pred)
    adaptive = cv2.adaptiveThreshold(
        pred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 7
    )
    return [("model_direct", pred), ("model_clahe", clahe), ("model_adaptive_threshold", adaptive)]


class QRRecoveryService:
    def __init__(self, config: dict | None = None):
        self.cfg = dict(config or read_config())
        self.worker: JsonProcess | None = None
        self.error: str | None = None
        self.lock = threading.Lock()
        self.log_lock = threading.Lock()
        self.restart_on_next_request = False
        self._state_lock = threading.RLock()
        self._closed = False
        self._stop_event = threading.Event()
        self._restart_thread: threading.Thread | None = None
        self._restarting = False
        self._retry_after = 0.0

    def _worker_ready(self) -> bool:
        worker = self.worker
        return bool(not self._closed and not self.error and worker
                    and worker.proc.poll() is None and worker.ready.get("ready")
                    and worker.ready.get("model_sha256") == self.cfg["checkpoint_sha256"])

    def initialize(self) -> dict:
        # Startup may wait for loading. Request handlers only schedule this in
        # the background and never wait for initialization.
        if not self.cfg["enabled"] or self._closed:
            return self.health()
        with self.lock:
            self._initialize_locked()
        return self.health()

    def _initialize_locked(self):
        if self._closed or self._worker_ready():
            return
        started = time.perf_counter()
        new_worker = None
        old_worker, self.worker = self.worker, None
        if old_worker:
            old_worker.close()
        try:
            if self._closed:
                return
            env = os.environ.copy()
            env["QR_RECOVERY_CONFIG_JSON"] = json.dumps(self.cfg, ensure_ascii=False)
            env["PYTHONUNBUFFERED"] = "1"
            worker_pythonpath = self.cfg.get("worker_pythonpath")
            if worker_pythonpath:
                env["PYTHONPATH"] = worker_pythonpath
            new_worker = JsonProcess(
                [self.cfg["python"], str(Path(__file__).resolve()), "--worker"],
                env, self.cfg["worker_startup_timeout_ms"], new_session=True,
                cancel_event=self._stop_event,
            )
            if not new_worker.ready.get("ready"):
                raise RuntimeError(new_worker.ready.get("error", "QR worker failed startup"))
            if new_worker.ready.get("model_sha256") != self.cfg["checkpoint_sha256"]:
                raise RuntimeError("Worker reports a different frozen checkpoint hash")
            with self._state_lock:
                if self._closed:
                    return
                self.worker, new_worker = new_worker, None
                self.error = None
                self.restart_on_next_request = False
        except Exception as exc:
            self.error = str(exc)
        finally:
            if new_worker:
                new_worker.close()
            self.startup_ms = round((time.perf_counter() - started) * 1000, 3)

    def _schedule_restart(self) -> bool:
        with self._state_lock:
            if self._closed or not self.cfg["enabled"] or self._worker_ready():
                return False
            if self._restarting or time.monotonic() < self._retry_after:
                return False
            self._restarting = True
            self.restart_on_next_request = False
            self._restart_thread = threading.Thread(
                target=self._background_restart, name="qr-worker-restart", daemon=True,
            )
            self._restart_thread.start()
            return True

    def _background_restart(self):
        try:
            self.initialize()
        except Exception as exc:
            self.error = str(exc)
        finally:
            with self._state_lock:
                self._restarting = False
                # A failed restart can be retried by a later eligible request;
                # there is no unbounded retry loop or repeated model loading.
                self._retry_after = time.monotonic() + (0 if self._worker_ready() else 1.0)

    def health(self) -> dict:
        with self._state_lock:
            worker = self.worker
            ready = self._worker_ready()
            error = self.error
            if worker and worker.proc.poll() is not None and not error:
                error = "QR worker exited; next eligible request schedules a background restart"
            state = ("disabled" if not self.cfg["enabled"] else "closed" if self._closed
                     else "restarting" if self._restarting else "ready" if ready else "unavailable")
            return {
                "enabled": bool(self.cfg["enabled"]), "ready": ready,
                "state": state, "restart_in_progress": self._restarting,
                "version": self.cfg["version"], "model_sha256": self.cfg["checkpoint_sha256"],
                "seed": self.cfg["seed"], "epoch": self.cfg["epoch"],
                "parameter_count": self.cfg["parameter_count"], "decoder_version": self.cfg["decoder_version"],
                "max_candidates": self.cfg["max_candidates"], "request_budget_ms": self.cfg["request_budget_ms"],
                "error": error, "runtime": worker.ready if ready else None,
                "startup_ms": getattr(self, "startup_ms", None),
            }

    def close(self):
        with self._state_lock:
            self._closed = True
            self._stop_event.set()
            thread = self._restart_thread
        # A cancellation-aware startup read lets shutdown interrupt a worker
        # that has not yet sent its ready line. Never join under the state lock.
        if thread and thread is not threading.current_thread():
            thread.join()
        with self.lock:
            worker, self.worker = self.worker, None
            if worker:
                worker.close()

    def log(self, record: dict):
        try:
            path = Path(self.cfg["log_path"])
            path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_lock, path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps({
                    "time_unix": time.time(),
                    "version": self.cfg["version"],
                    "model_sha256": self.cfg["checkpoint_sha256"],
                    **record,
                }, ensure_ascii=False) + "\n")
        except OSError as exc:
            print("[qr-recovery] diagnostic log unavailable:", exc, file=sys.stderr)

    def recover(
        self,
        frame: np.ndarray,
        proposed: dict,
        *,
        request_id: str,
        frame_sha256: str,
        allow_model: bool = True,
    ) -> tuple[dict, dict]:
        started = time.perf_counter()
        diagnostic = {
            "enabled": bool(self.cfg["enabled"]),
            "ready": self.health()["ready"],
            "attempted": False,
            "model_executed": False,
            "recovered_count": 0,
            "candidates": [],
            "status": "skipped",
            "scope": "online_engineering",
        }
        if not self.cfg["enabled"]:
            diagnostic["reason"] = "disabled"
            self.log({"request_id": request_id, "frame_sha256": frame_sha256, "diagnostic": diagnostic})
            return proposed, diagnostic
        candidates = [dict(c) for c in proposed.get("candidates", [])]
        eligible = [c for c in candidates if not c.get("success")
                    and str(c.get("class_name", "")).lower() in {"qr_code", "qrcode", "qr"}]
        if not eligible:
            diagnostic.update(reason="no_failed_qr_candidate", wall_ms=round((time.perf_counter()-started)*1000, 3))
            self.log({"request_id": request_id, "frame_sha256": frame_sha256, "diagnostic": diagnostic})
            return proposed, diagnostic
        if not diagnostic["ready"]:
            diagnostic.update(status="degraded", reason="worker_unavailable",
                              restart_scheduled=self._schedule_restart(),
                              worker_state=self.health()["state"], error=self.health()["error"],
                              wall_ms=round((time.perf_counter()-started)*1000, 3))
            self.log({"request_id": request_id, "frame_sha256": frame_sha256, "diagnostic": diagnostic})
            return proposed, diagnostic
        if not self.lock.acquire(blocking=False):
            diagnostic.update(status="busy", reason="recovery_busy")
            self.log({"request_id": request_id, "frame_sha256": frame_sha256, "diagnostic": diagnostic})
            return proposed, diagnostic
        try:
            if not self._worker_ready():
                diagnostic.update(status="degraded", reason="worker_unavailable",
                                  ready=False, restart_scheduled=self._schedule_restart())
                return proposed, diagnostic
            h, w = frame.shape[:2]
            deadline = time.monotonic() + self.cfg["request_budget_ms"] / 1000
            from src.rotated_crop import warp_rotated_roi

            for candidate in eligible[:self.cfg["max_candidates"]]:
                if time.monotonic() >= deadline:
                    diagnostic["reason"] = "budget_exhausted"
                    break
                row = {"candidate_id": candidate.get("candidate_id"), "model_executed": False}
                diagnostic["candidates"].append(row)
                try:
                    points = np.asarray(candidate["points"], np.float32).reshape(4, 2)
                    if (
                        not np.isfinite(points).all()
                        or (points[:, 0] < 0).any()
                        or (points[:, 0] >= w).any()
                        or (points[:, 1] < 0).any()
                        or (points[:, 1] >= h).any()
                        or abs(cv2.contourArea(points)) < 16
                    ):
                        row.update(status="skipped", reason="invalid_or_outside_geometry")
                        continue
                    center = points.mean(axis=0, keepdims=True)
                    expanded = center + (points - center) * 1.7
                    r1_width, r1_height = estimate_warp_size(expanded)
                    r0_width, r0_height = estimate_warp_size(points)
                    if (
                        r1_width * r1_height > self.cfg["max_pixels"]
                        or r0_width * r0_height > self.cfg["max_pixels"]
                        or r1_width > self.cfg["max_roi_side"]
                        or r1_height > self.cfg["max_roi_side"]
                    ):
                        row.update(status="skipped", reason="projected_roi_exceeds_limit")
                        continue
                    r1 = warp_rotated_roi(frame, expanded)
                    r0 = warp_rotated_roi(frame, points)
                    r1_png, r0_png = png_message(r1), png_message(r0)
                    remaining_ms = int((deadline - time.monotonic()) * 1000)
                    if remaining_ms <= 0:
                        diagnostic["reason"] = "budget_exhausted"
                        break
                    diagnostic["attempted"] = True
                    result = self.worker.call({
                        "op": "recover",
                        "r1_png": r1_png,
                        "r0_png": r0_png,
                        "allow_model": bool(allow_model),
                    }, min(self.cfg["worker_call_timeout_ms"], remaining_ms))
                    if not result.get("ok"):
                        raise WorkerCallError(
                            result.get("error", "QR recovery failed"),
                            may_have_processed=result.get("model_executed") is not False,
                            transport_failure=True,
                        )
                    row.update(result)
                    diagnostic["model_executed"] = _tri_or(diagnostic["model_executed"], result.get("model_executed", False))
                    if result.get("text"):
                        candidate.update(
                            success=True,
                            decoded_text=result["text"],
                            decoded_texts=[result["text"]],
                            decoded_types=[result["format"]],
                            best_preprocessing_mode=result["branch"],
                            error=None,
                            recovery_method="learned_qr" if result["model_executed"] else "fixed_qr_prefix",
                            recovery_version=self.cfg["version"],
                            score=round(min(1.0, float(candidate.get("score") or 0) + 0.36), 4),
                        )
                        diagnostic["recovered_count"] += 1
                except Exception as exc:
                    may_have_processed = getattr(exc, "may_have_processed", False)
                    row.update(
                        status="error",
                        error=str(exc),
                        model_executed=None if may_have_processed else False,
                    )
                    if may_have_processed:
                        diagnostic["model_executed"] = _tri_or(diagnostic["model_executed"], None)
                    if isinstance(exc, WorkerCallError) and exc.transport_failure:
                        self.error = str(exc)
                        self.restart_on_next_request = True
                        diagnostic.update(ready=False, status="degraded", reason="worker_transport_failure",
                                          restart_scheduled=self._schedule_restart())
                        break
                    if not self.worker or self.worker.proc.poll() is not None:
                        self.error = str(exc)
                        self.restart_on_next_request = True
                        diagnostic.update(ready=False, status="degraded", reason="worker_unavailable",
                                          restart_scheduled=self._schedule_restart())
                        break
            if diagnostic.get("reason") != "budget_exhausted" and diagnostic["status"] != "degraded":
                diagnostic["status"] = "returned" if diagnostic["recovered_count"] else "no_return"
            if diagnostic["recovered_count"]:
                successful = sorted(
                    [c for c in candidates if c.get("success")],
                    key=lambda c: c.get("score") or 0,
                    reverse=True,
                )
                proposed = {
                    **proposed,
                    "success": True,
                    "error": None,
                    "candidates": sorted(candidates, key=lambda c: c.get("score") or 0, reverse=True),
                    "best_candidate": successful[0],
                    "decoded_texts": [c["decoded_text"] for c in successful if c.get("decoded_text")],
                    "decoded_types": list(dict.fromkeys(
                        t for c in successful for t in (c.get("decoded_types") or [])
                    )),
                }
            return proposed, diagnostic
        finally:
            diagnostic["wall_ms"] = round((time.perf_counter() - started) * 1000, 3)
            self.lock.release()
            self.log({
                "request_id": request_id,
                "frame_sha256": frame_sha256,
                "frame_width": int(frame.shape[1]),
                "frame_height": int(frame.shape[0]),
                "diagnostic": _diagnostic_for_log(diagnostic),
            })


def _tri_or(left, right):
    if left is True or right is True:
        return True
    if left is None or right is None:
        return None
    return False


def _diagnostic_for_log(diagnostic: dict) -> dict:
    safe = json.loads(json.dumps(diagnostic, ensure_ascii=False))
    for candidate in safe.get("candidates", []):
        candidate.pop("text", None)
    return safe


def get_service() -> QRRecoveryService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = QRRecoveryService()
    return _SERVICE


_SERVICE: QRRecoveryService | None = None


def create_model():
    import torch
    from torch import nn

    class Block(nn.Module):
        def __init__(self, a, b):
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv2d(a, b, 3, padding=1), nn.ReLU(inplace=True),
                nn.Conv2d(b, b, 3, padding=1), nn.ReLU(inplace=True),
            )

        def forward(self, x):
            return self.net(x)

    class TinyUNet(nn.Module):
        def __init__(self, base=8):
            super().__init__()
            self.enc1, self.enc2, self.enc3 = Block(1, base), Block(base, base * 2), Block(base * 2, base * 4)
            self.pool, self.mid = nn.MaxPool2d(2), Block(base * 4, base * 8)
            self.dec3, self.dec2, self.dec1 = Block(base * 12, base * 4), Block(base * 6, base * 2), Block(base * 3, base)
            self.out = nn.Conv2d(base, 1, 1)

        def forward(self, x):
            a = self.enc1(x)
            b = self.enc2(self.pool(a))
            c = self.enc3(self.pool(b))
            z = self.mid(self.pool(c))

            def up(value, skip):
                return nn.functional.interpolate(value, size=skip.shape[-2:], mode="bilinear", align_corners=False)

            x = self.dec3(torch.cat([up(z, c), c], 1))
            x = self.dec2(torch.cat([up(x, b), b], 1))
            x = self.dec1(torch.cat([up(x, a), a], 1))
            return torch.sigmoid(self.out(x))

    return TinyUNet().cpu().eval()


def predict(model, r1: np.ndarray) -> tuple[np.ndarray, float]:
    import torch
    from PIL import Image

    gray = cv2.cvtColor(r1, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    scale = min(240 / w, 240 / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = Image.fromarray(gray, mode="L").resize((nw, nh), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (256, 256), 255)
    canvas.paste(resized, ((256 - nw) // 2, (256 - nh) // 2))
    array = np.asarray(canvas, dtype=np.uint8).copy()
    tensor = torch.from_numpy(array.astype(np.float32, copy=True)[None, None] / 255.0)
    started = time.perf_counter()
    with torch.inference_mode():
        output = model(tensor)
    inference_ms = (time.perf_counter() - started) * 1000
    return np.uint8(np.clip(output[0, 0].numpy() * 255.0, 0, 255)), inference_ms


def run_policy(model, decoder: JsonProcess, r1: np.ndarray, r0: np.ndarray, cfg: dict, allow_model=True) -> dict:
    started = time.perf_counter()
    trace = []
    model_executed: bool | None = False

    def attempt(branch: str, image: np.ndarray, deadline: float):
        nonlocal model_executed
        arr = image if image.ndim == 3 else cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        h, w = arr.shape[:2]
        remaining_ms = int((deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            raise TimeoutError("QR recovery request budget elapsed")
        reply = decoder.call({
            "id": len(trace), "symbology": "QR_CODE", "width": w, "height": h,
            "pixels_b64": base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode("ascii"),
            "warmups": 0, "repeats": 1,
        }, min(cfg["decoder_call_timeout_ms"], remaining_ms))
        if not reply.get("ok"):
            raise RuntimeError(reply.get("error_message", "ZXing failed"))
        measurement = reply["response"]["measurements"][0]
        text = measurement["text"]
        trace.append({
            "branch": branch,
            "status": measurement["status"],
            "format": measurement["format"],
            "text_sha256": digest(text.encode("utf-8")) if text else None,
            "decoder_ms": measurement["decoder_ms"],
            "error_type": measurement["error_type"],
        })
        if measurement["status"] == "error":
            raise RuntimeError("ZXing program error: " + measurement["error_type"])
        if text:
            return {
                "ok": True, "status": "returned", "text": text,
                "format": measurement["format"], "branch": branch,
                "model_executed": model_executed, "trace": trace,
                "policy_ms": (time.perf_counter() - started) * 1000,
            }
        return None

    deadline = time.monotonic() + cfg["request_budget_ms"] / 1000
    for branch, image in prefix_images(r1, r0):
        result = attempt(branch, image, deadline)
        if result:
            return result
    inference_ms = 0.0
    if allow_model:
        remaining_ms = int((deadline - time.monotonic()) * 1000)
        if remaining_ms <= 0:
            return {"ok": True, "status": "budget_exhausted", "text": "", "format": "", "branch": "",
                    "model_executed": False, "inference_ms": inference_ms, "trace": trace,
                    "policy_ms": (time.perf_counter() - started) * 1000}
        model_executed = True
        pred, inference_ms = predict(model, r1)
        for branch, image in model_images(pred):
            result = attempt(branch, image, deadline)
            if result:
                result["inference_ms"] = inference_ms
                return result
    return {
        "ok": True,
        "status": "no_return" if time.monotonic() < deadline else "budget_exhausted",
        "text": "", "format": "", "branch": "", "model_executed": model_executed,
        "inference_ms": inference_ms, "trace": trace,
        "policy_ms": (time.perf_counter() - started) * 1000,
    }


def worker_main():
    decoder = None
    def graceful_exit(signum, _frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, graceful_exit)
    try:
        cfg = read_config()
        import torch
        from PIL import __version__ as pillow_version

        torch.set_num_threads(cfg["cpu_threads"])
        torch.use_deterministic_algorithms(True)
        torch.backends.mkldnn.deterministic = True
        checkpoint = HERE / cfg["checkpoint"]
        checkpoint_bytes = checkpoint.read_bytes()
        if digest(checkpoint_bytes) != cfg["checkpoint_sha256"]:
            raise RuntimeError("Frozen QR checkpoint SHA-256 mismatch")
        obj = torch.load(checkpoint, map_location="cpu", weights_only=False)
        model = create_model()
        model.load_state_dict(obj["state_dict"], strict=True)
        if sum(p.numel() for p in model.parameters()) != cfg["parameter_count"] or obj["epoch"] != cfg["epoch"]:
            raise RuntimeError("Frozen QR architecture or epoch mismatch")
        with torch.inference_mode():
            model(torch.zeros(1, 1, 256, 256))
        env = os.environ.copy()
        env["NODE_PATH"] = cfg["node_modules"]
        decoder = JsonProcess(
            [cfg["node"], str(HERE / "qr_recovery_worker.js")],
            env,
            cfg["decoder_startup_timeout_ms"],
            new_session=False,
        )
        if decoder.ready.get("decoder_version") != cfg["decoder_version"]:
            raise RuntimeError("Frozen ZXing decoder version mismatch")
        ready = {
            "ready": True,
            "model_sha256": cfg["checkpoint_sha256"],
            "torch": torch.__version__,
            "numpy": np.__version__,
            "opencv": cv2.__version__,
            "pillow": pillow_version,
            "parameter_count": cfg["parameter_count"],
            "epoch": cfg["epoch"],
            "decoder_version": cfg["decoder_version"],
            "node_version": decoder.ready.get("node_version"),
            "device": "cpu",
        }
        print(json.dumps(ready), flush=True)
        for line in sys.stdin:
            try:
                req = json.loads(line)
                r1 = load_png(req["r1_png"], cfg["max_pixels"])
                if req.get("op") == "predict_hash":
                    prediction, inference_ms = predict(model, r1)
                    reply = {"ok": True, "prediction_pixel_sha256": digest(prediction.tobytes()),
                             "inference_ms": inference_ms}
                else:
                    r0 = load_png(req["r0_png"], cfg["max_pixels"])
                    reply = run_policy(model, decoder, r1, r0, cfg, req.get("allow_model", True))
            except Exception as exc:
                reply = {"ok": False, "error": str(exc), "model_executed": None}
            print(json.dumps(reply, ensure_ascii=False), flush=True)
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc)}), flush=True)
    finally:
        if decoder:
            decoder.close()


if __name__ == "__main__" and "--worker" in sys.argv:
    worker_main()
