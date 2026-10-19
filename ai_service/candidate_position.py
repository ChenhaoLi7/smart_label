"""Associate decoded candidates with real positions from the same frame.

Replaces the old merge that kept the first candidate per decoded text and silently
dropped later OBB candidates (and their coordinates) with the same text.

Rules (candidate-position-v1):
- Every successful decode is kept; identity (candidate_id) and decode source stay as before.
  A whole-image success stays a whole-image success even when OBB supplies its position.
- Positions come only from measurements in this frame: OBB detection corners, or the
  polygon the whole-image decoder (zbar / OpenCV QR) reported for that symbol.
- Association is by decoded text + location, never by list index. Observations of one text
  that overlap are one physical label; non-overlapping ones are separate labels, and then
  the text is marked ambiguous (no coordinates are chosen).
- Missing, invalid or ambiguous positions are recorded as such; nothing is defaulted.
No detector, decoder or recovery call is added here.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

POSITION_VERSION = "candidate-position-v1"
BOUNDS_TOLERANCE = 0.02  # fraction of width/height a corner may lie outside the image


def _family(value: Any) -> Optional[str]:
    text = str(value or "").strip().upper().replace("-", "_").replace(" ", "_")
    if not text or text in {"CODE", "BARCODE", "UNKNOWN", "ROI", "CODE_UNKNOWN"}:
        return None
    if "QR" in text:
        return "QR"
    return "LINEAR"


def _area(points: List[List[float]]) -> float:
    n = len(points)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _convex_hull(points: List[List[float]]) -> List[List[float]]:
    pts = sorted(set((float(x), float(y)) for x, y in points))
    if len(pts) <= 2:
        return [list(p) for p in pts]
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return [list(p) for p in lower[:-1] + upper[:-1]]


def _inside(point: Tuple[float, float], hull: List[List[float]]) -> bool:
    if len(hull) < 3:
        return False
    x, y = point
    sign = 0
    for i in range(len(hull)):
        x1, y1 = hull[i]
        x2, y2 = hull[(i + 1) % len(hull)]
        c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if c != 0:
            if sign == 0:
                sign = 1 if c > 0 else -1
            elif (c > 0) != (sign > 0):
                return False
    return True


def _validate(points: Any, width: int, height: int) -> Tuple[Optional[List[List[float]]], Optional[str]]:
    try:
        pts = [[float(p[0]), float(p[1])] for p in points]
    except Exception:
        return None, "unparseable_points"
    if len(pts) < 3:
        return None, "fewer_than_3_points"
    if not all(math.isfinite(v) for p in pts for v in p):
        return None, "non_finite_points"
    if not width or not height:
        return None, "image_size_unknown"
    tx, ty = width * BOUNDS_TOLERANCE, height * BOUNDS_TOLERANCE
    if any(p[0] < -tx or p[0] > width + tx or p[1] < -ty or p[1] > height + ty for p in pts):
        return None, "outside_image"
    hull = _convex_hull(pts)
    if _area(hull) <= 1.0:
        return None, "zero_area"
    return hull, None


class _Obs:
    def __init__(self, text, family, source, hull, priority, candidate=None):
        self.text, self.family, self.source, self.hull, self.priority, self.candidate = text, family, source, hull, priority, candidate
        xs = [p[0] for p in hull]; ys = [p[1] for p in hull]
        self.center = (sum(xs) / len(xs), sum(ys) / len(ys))
        self.area = _area(hull)
        self.size = math.sqrt(max(self.area, 1.0))


def _same_label(a: _Obs, b: _Obs) -> bool:
    if _inside(a.center, b.hull) or _inside(b.center, a.hull):
        return True
    return math.dist(a.center, b.center) < 0.5 * min(a.size, b.size)


def _cluster(obs: List[_Obs]) -> List[List[_Obs]]:
    clusters: List[List[_Obs]] = []
    for o in obs:
        hits = [c for c in clusters if any(_same_label(o, m) for m in c)]
        merged = [o]
        for c in hits:
            merged.extend(c)
            clusters.remove(c)
        clusters.append(merged)
    return clusters


def _text_of(candidate: Dict[str, Any]) -> str:
    texts = candidate.get("decoded_texts") or ([candidate.get("decoded_text")] if candidate.get("decoded_text") else [])
    return next((str(t).strip() for t in texts if str(t or "").strip()), "")


def associate_candidate_positions(
    baseline_result: Dict[str, Any],
    baseline_candidates: List[Dict[str, Any]],
    proposed_candidates: List[Dict[str, Any]],
    *,
    image_width: Optional[int],
    image_height: Optional[int],
    target_frame: Optional[dict],
    center_distance_ratio,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    raw = baseline_result.get("raw") or {}
    width = int(raw.get("image_width") or image_width or 0)
    height = int(raw.get("image_height") or image_height or 0)
    details = raw.get("engine_details") or {}
    reference = (target_frame or {}).get("reference", "scan_frame") if target_frame else "image_center"

    # Whole-image symbol reports, per text.
    symbol_obs: Dict[str, List[_Obs]] = {}
    symbol_types: Dict[str, List[str]] = {}
    invalid: Dict[str, List[str]] = {}
    for engine, source, priority in (("pyzbar", "whole_image_zbar_polygon", 1), ("opencv", "whole_image_opencv_qr_corners", 2)):
        for sym in (details.get(engine) or {}).get("symbols") or []:
            text = str(sym.get("text") or "").strip()
            if not text:
                continue
            symbol_types.setdefault(text, []).append(str(sym.get("type") or ""))
            if not sym.get("polygon"):
                continue  # decoder reported no location for this symbol: missing, not invalid
            hull, reason = _validate(sym.get("polygon"), width, height)
            if hull is None:
                invalid.setdefault(text, []).append(f"{source}:{reason}")
                continue
            symbol_obs.setdefault(text, []).append(_Obs(text, _family(sym.get("type")), source, hull, priority))

    # OBB detections that decoded, per text.
    obb_obs: Dict[str, List[_Obs]] = {}
    obb_by_text: Dict[str, List[Dict[str, Any]]] = {}
    for cand in proposed_candidates or []:
        text = _text_of(cand)
        if not (cand.get("success") and text):
            continue
        obb_by_text.setdefault(text, []).append(cand)
        cw = int(cand.get("image_width") or width or 0)
        ch = int(cand.get("image_height") or height or 0)
        if (cw, ch) != (width, height):
            invalid.setdefault(text, []).append("obb_detection:image_size_mismatch")
            continue
        hull, reason = _validate(cand.get("points") or [], width, height)
        if hull is None:
            invalid.setdefault(text, []).append(f"obb_detection:{reason}")
            continue
        pz_types = (((cand.get("decoder_details") or {}).get("pyzbar") or {}).get("decoded_types") or [])
        fam = _family(pz_types[0]) if len(set(pz_types)) == 1 else _family(cand.get("class_name"))
        obb_obs.setdefault(text, []).append(_Obs(text, fam, "obb_detection", hull, 0, cand))

    # Final candidates: same identities and order as the old merge, positions attached.
    ordered: List[Dict[str, Any]] = []
    seen = set()
    for cand in list(baseline_candidates or []) + list(proposed_candidates or []):
        text = _text_of(cand)
        if cand.get("success") and text:
            if text in seen:
                continue
            seen.add(text)
        ordered.append(cand)

    report = {"version": POSITION_VERSION, "image_width": width, "image_height": height, "center_reference": reference,
              "texts": {}, "measured": 0, "ambiguous": 0, "missing": 0}
    final: List[Dict[str, Any]] = []
    for cand in ordered:
        text = _text_of(cand)
        if not (cand.get("success") and text):
            final.append(cand)
            continue
        is_baseline = str(cand.get("candidate_id", "")).startswith("baseline-")
        observations = obb_obs.get(text, []) + symbol_obs.get(text, [])
        clusters = _cluster(observations)
        decode_sources = []
        if is_baseline:
            for engine in ("pyzbar", "opencv"):
                if text in [str(t).strip() for t in ((details.get(engine) or {}).get("decoded_texts") or [])]:
                    decode_sources.append(f"whole_image_{engine}")
        for oc in obb_by_text.get(text, []):
            decode_sources.append("qr_recovery" if "recover" in str(oc.get("source", "")).lower() else "obb_roi")
        decode_sources = list(dict.fromkeys(decode_sources))

        families = sorted({o.family for o in observations if o.family} | {f for f in (_family(t) for t in symbol_types.get(text, [])) if f})
        out = dict(cand)
        if is_baseline:
            # Type from the decoder that actually returned this text (old code used list index).
            aligned = [t for t in symbol_types.get(text, []) if t]
            if aligned:
                out["class_name"] = aligned[0]
                out["decoded_types"] = list(dict.fromkeys(aligned))
                out["type_source"] = "decoder_symbol"
            else:
                out["type_source"] = "unaligned_whole_image_list"
        position: Dict[str, Any] = {"version": POSITION_VERSION, "reference": reference, "image_width": width, "image_height": height,
                                    "observations": [o.source for o in observations], "location_count": len(clusters),
                                    "invalid_observations": invalid.get(text, []), "symbology_families": families}
        flat_reset = {"points": None, "center_x": None, "center_y": None, "center_distance_ratio": None,
                      "detection_area_ratio": None, "relative_area": None, "center_reference": reference}
        if len(clusters) == 1:
            best = sorted(clusters[0], key=lambda o: (o.priority, -float((o.candidate or {}).get("confidence") or 0)))[0]
            cdr = round(float(center_distance_ratio(best.center[0], best.center[1], width, height, target_frame)), 4)
            rel = round(best.area / float(max(width * height, 1)), 6)
            position.update(status="measured", source=best.source, association="same_text_single_location",
                            points=best.hull, center_x=round(best.center[0], 2), center_y=round(best.center[1], 2),
                            center_distance_ratio=cdr, relative_area=rel, merged_observations=len(clusters[0]))
            out.update(points=best.hull, image_width=width, image_height=height, center_x=position["center_x"], center_y=position["center_y"],
                       center_distance_ratio=cdr, center_reference=reference, center_distance_source=best.source,
                       detection_area_ratio=rel, relative_area=rel, relative_area_source=best.source)
            if best.candidate is not None:
                # Detector confidence and ROI quality measured at this location.
                out["confidence"] = best.candidate.get("confidence")
                out["confidence_source"] = "obb_detector_confidence"
                out["quality_score"] = best.candidate.get("quality_score")
                out["quality_score_source"] = "obb_roi_quality"
                out["obb_candidate_id"] = best.candidate.get("candidate_id")
            report["measured"] += 1
        elif len(clusters) > 1:
            position.update(status="ambiguous_multiple_locations", source=None, association="same_text_multiple_locations")
            out.update(flat_reset)
            if not is_baseline:
                out.update(confidence=None, quality_score=None, confidence_source="not_assigned_ambiguous_location", quality_score_source="not_assigned_ambiguous_location")
            report["ambiguous"] += 1
        else:
            position.update(status="invalid" if invalid.get(text) else "missing", source=None, association="none")
            out.update(flat_reset)
            if not is_baseline:
                out.update(confidence=None, quality_score=None, confidence_source="not_assigned_invalid_location", quality_score_source="not_assigned_invalid_location")
            report["missing"] += 1
        if len(families) > 1:
            position["symbology_conflict"] = True
        out["decode_sources"] = decode_sources
        out["position"] = position
        report["texts"][text] = {"candidate_id": out.get("candidate_id"), "status": position["status"], "source": position.get("source"),
                                 "location_count": len(clusters), "decode_sources": decode_sources}
        final.append(out)

    return sorted(final, key=lambda item: item.get("score") or 0.0, reverse=True), report
