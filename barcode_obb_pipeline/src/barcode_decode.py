from __future__ import annotations

from typing import Any

from .utils import dedupe_preserve_order


def _decode_bytes(value: bytes | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    for encoding in ("utf-8", "shift_jis", "latin1"):
        try:
            return value.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return value.decode("utf-8", errors="ignore").strip()


def _result(
    *,
    success: bool,
    decoded_texts: list[str] | None = None,
    decoded_types: list[str] | None = None,
    engine: str,
    error: str | None = None,
    raw: Any = None,
) -> dict:
    texts = dedupe_preserve_order(decoded_texts or [])
    types = dedupe_preserve_order(decoded_types or [])
    return {
        "success": bool(success and texts),
        "decoded_texts": texts,
        "decoded_types": types,
        "engine": engine,
        "error": error,
        "raw": raw,
    }


def _iter_values(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, (str, bytes)):
        return [value]
    try:
        return list(value)
    except TypeError:
        return [value]


def _append_text(value: Any, texts: list[str]) -> None:
    if isinstance(value, bytes):
        value = _decode_bytes(value)
    if isinstance(value, str):
        value = value.strip()
        if value:
            texts.append(value)


def _append_type(value: Any, types: list[str]) -> None:
    if isinstance(value, bytes):
        value = _decode_bytes(value)
    if isinstance(value, str):
        value = value.strip()
        if value:
            types.append(value)


def decode_image_with_pyzbar(image) -> dict:
    try:
        from pyzbar.pyzbar import decode
    except Exception as error:
        return _result(success=False, engine="pyzbar", error=f"pyzbar unavailable: {error}")

    try:
        decoded = decode(image)
        texts = [_decode_bytes(item.data) for item in decoded]
        types = [str(getattr(item, "type", "UNKNOWN")) for item in decoded]
        return _result(success=bool(texts), decoded_texts=texts, decoded_types=types, engine="pyzbar")
    except Exception as error:
        return _result(success=False, engine="pyzbar", error=str(error))


def decode_image_with_opencv(image) -> dict:
    try:
        import cv2
    except Exception as error:
        return _result(success=False, engine="opencv", error=f"opencv unavailable: {error}")

    texts: list[str] = []
    types: list[str] = []
    errors: list[str] = []

    try:
        qr_detector = cv2.QRCodeDetector()
        if hasattr(qr_detector, "detectAndDecodeMulti"):
            ok, decoded_info, _points, _straight = qr_detector.detectAndDecodeMulti(image)
            if ok:
                for text in decoded_info:
                    if text:
                        texts.append(str(text))
                        types.append("QR_CODE")
        text, _points, _straight = qr_detector.detectAndDecode(image)
        if text:
            texts.append(str(text))
            types.append("QR_CODE")
    except Exception as error:
        errors.append(f"qrcode: {error}")

    try:
        barcode_module = getattr(cv2, "barcode", None)
        barcode_detector_cls = getattr(barcode_module, "BarcodeDetector", None) if barcode_module else None
        if barcode_detector_cls is not None:
            detector = barcode_detector_cls()
            result = detector.detectAndDecode(image)
            if isinstance(result, tuple):
                if result and isinstance(result[0], str):
                    _append_text(result[0], texts)
                    types.append("BARCODE")
                elif len(result) >= 3:
                    decoded_info = result[1]
                    decoded_types = result[2]
                    for text in _iter_values(decoded_info):
                        _append_text(text, texts)
                    if any(str(text).strip() for text in texts):
                        for decoded_type in _iter_values(decoded_types):
                            _append_type(decoded_type, types)
        else:
            errors.append("opencv barcode module unavailable")
    except Exception as error:
        errors.append(f"barcode: {error}")

    return _result(
        success=bool(texts),
        decoded_texts=texts,
        decoded_types=types,
        engine="opencv",
        error="; ".join(errors) if errors and not texts else None,
    )


def decode_image_combined(image) -> dict:
    pyzbar_result = decode_image_with_pyzbar(image)
    opencv_result = decode_image_with_opencv(image)

    texts = dedupe_preserve_order(
        pyzbar_result.get("decoded_texts", []) + opencv_result.get("decoded_texts", [])
    )
    types = dedupe_preserve_order(
        pyzbar_result.get("decoded_types", []) + opencv_result.get("decoded_types", [])
    )
    engines = [
        result["engine"]
        for result in (pyzbar_result, opencv_result)
        if result.get("success")
    ]
    errors = [
        result.get("error")
        for result in (pyzbar_result, opencv_result)
        if result.get("error")
    ]

    return {
        "success": bool(texts),
        "decoded_texts": texts,
        "decoded_types": types,
        "engines": engines,
        "error": "; ".join(errors) if errors and not texts else None,
        "details": {
            "pyzbar": pyzbar_result,
            "opencv": opencv_result,
        },
    }
