from __future__ import annotations

import numpy as np
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STAR_MODEL_DIR = PROJECT_ROOT / "ui" / "models"
MODEL_MAP = {
    "male": STAR_MODEL_DIR / "model.npz",
    "m": STAR_MODEL_DIR / "model.npz",
    "female": STAR_MODEL_DIR / "model.npz",
    "f": STAR_MODEL_DIR / "model.npz",
    "neutral": STAR_MODEL_DIR / "model.npz",
}


def build_star_viewer_model(analysis: Dict[str, Any], gender: str = "male") -> Optional[Dict[str, Any]]:
    height = _metric_value(analysis, "height")
    shoulder_width = _metric_value(analysis, "shoulder_width")
    pelvis_width = _metric_value(analysis, "pelvis_width")
    arm_length = _metric_value(analysis, "arm_length")
    leg_length = _metric_value(analysis, "leg_length")
    torso_length = _metric_value(analysis, "torso_length")
    torso_depth = _metric_value(analysis, "torso_depth") or (pelvis_width * 0.62 if pelvis_width else None)

    if not all([height, shoulder_width, pelvis_width, arm_length, leg_length, torso_length, torso_depth]):
        return None

    (
        height,
        shoulder_width,
        pelvis_width,
        arm_length,
        leg_length,
        torso_length,
        torso_depth,
    ) = _normalize_body_dimensions(
        height,
        shoulder_width,
        pelvis_width,
        arm_length,
        leg_length,
        torso_length,
        torso_depth,
    )

    model = _load_star_model(gender)
    vertices = np.asarray(model["v_template"], dtype=np.float32).copy()
    faces = np.asarray(model["f"], dtype=np.int32)

    _apply_dimension_warp(
        vertices,
        height_cm=height,
        shoulder_width_cm=shoulder_width,
        pelvis_width_cm=pelvis_width,
        arm_length_cm=arm_length,
        leg_length_cm=leg_length,
        torso_length_cm=torso_length,
        torso_depth_cm=torso_depth,
    )
    _apply_posture_warp(vertices, analysis)

    return {
        "ok": True,
        "type": "star_template_body_v1",
        "unit": "m",
        "vertices": np.round(vertices, 6).tolist(),
        "faces": faces.tolist(),
        "meta": {
            "gender": gender,
            "height_cm": height,
            "shoulder_width_cm": shoulder_width,
            "pelvis_width_cm": pelvis_width,
            "arm_length_cm": arm_length,
            "leg_length_cm": leg_length,
            "torso_length_cm": torso_length,
            "torso_depth_cm": torso_depth,
            "source_model": str(MODEL_MAP.get(gender.lower(), MODEL_MAP["male"]).name),
        },
    }


@lru_cache(maxsize=4)
def _load_star_model(gender: str) -> Dict[str, Any]:
    key = (gender or "male").lower()
    model_path = MODEL_MAP.get(key, MODEL_MAP["male"])
    if not model_path.exists():
        raise FileNotFoundError(f"STAR model not found: {model_path}")

    # Load STAR model from .npz file
    model_data = dict(np.load(model_path, allow_pickle=False))

    # Ensure required keys exist
    required_keys = ["v_template", "f", "J_regressor", "kintree_table", "weights", "posedirs", "shapedirs"]
    for req_key in required_keys:
        if req_key not in model_data:
            raise ValueError(f"STAR model missing required key: {req_key}")

    return model_data


def _patch_numpy_legacy_aliases() -> None:
    # Not needed for STAR model (.npz format)
    pass


def _metric_value(analysis: Dict[str, Any], key: str) -> Optional[float]:
    item = analysis.get(key)
    if not item:
        return None
    value = item.get("value")
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_body_dimensions(
    height_cm: float,
    shoulder_width_cm: float,
    pelvis_width_cm: float,
    arm_length_cm: float,
    leg_length_cm: float,
    torso_length_cm: float,
    torso_depth_cm: float,
):
    base_height = max(
        height_cm,
        leg_length_cm / 0.50 if leg_length_cm > 0 else 0.0,
        torso_length_cm / 0.30 if torso_length_cm > 0 else 0.0,
        arm_length_cm / 0.38 if arm_length_cm > 0 else 0.0,
    )
    height_cm = float(np.clip(base_height, 135.0, 210.0))

    shoulder_width_cm = float(np.clip(shoulder_width_cm, height_cm * 0.18, height_cm * 0.30))
    pelvis_width_cm = float(np.clip(pelvis_width_cm, height_cm * 0.14, height_cm * 0.24))
    arm_length_cm = float(np.clip(arm_length_cm, height_cm * 0.30, height_cm * 0.46))
    leg_length_cm = float(np.clip(leg_length_cm, height_cm * 0.43, height_cm * 0.58))
    torso_length_cm = float(np.clip(torso_length_cm, height_cm * 0.24, height_cm * 0.36))
    torso_depth_cm = float(np.clip(torso_depth_cm, height_cm * 0.10, height_cm * 0.20))

    return (
        round(height_cm, 2),
        round(shoulder_width_cm, 2),
        round(pelvis_width_cm, 2),
        round(arm_length_cm, 2),
        round(leg_length_cm, 2),
        round(torso_length_cm, 2),
        round(torso_depth_cm, 2),
    )


def _apply_dimension_warp(
    vertices: np.ndarray,
    *,
    height_cm: float,
    shoulder_width_cm: float,
    pelvis_width_cm: float,
    arm_length_cm: float,
    leg_length_cm: float,
    torso_length_cm: float,
    torso_depth_cm: float,
) -> None:
    min_y = float(vertices[:, 1].min())
    max_y = float(vertices[:, 1].max())
    base_height_m = max(max_y - min_y, 1e-6)
    target_height_m = height_cm / 100.0
    vertices[:] *= target_height_m / base_height_m

    min_y = float(vertices[:, 1].min())
    max_y = float(vertices[:, 1].max())
    total_h = max(max_y - min_y, 1e-6)
    y_norm = np.clip((vertices[:, 1] - min_y) / total_h, 0.0, 1.0)

    shoulder_mask = _smooth_band_np(y_norm, 0.68, 0.88)
    chest_mask = _smooth_band_np(y_norm, 0.52, 0.78)
    pelvis_mask = _smooth_band_np(y_norm, 0.36, 0.56)
    upper_leg_mask = _smooth_band_np(y_norm, 0.18, 0.45)
    lower_leg_mask = _smooth_band_np(y_norm, 0.02, 0.26)
    head_mask = _smooth_band_np(y_norm, 0.86, 1.0)

    # STAR model v_template is in T-pose, causing extreme width measurements
    # Apply T-pose correction factor for accurate width estimation
    T_POSE_CORRECTION = 0.5  # T-pose arms add ~50% to apparent shoulder width

    shoulder_half_width = _masked_half_extent(vertices[:, 0], shoulder_mask, quantile=0.68) * T_POSE_CORRECTION
    chest_half_width = _masked_half_extent(vertices[:, 0], chest_mask, quantile=0.66)
    pelvis_half_width = _masked_half_extent(vertices[:, 0], pelvis_mask, quantile=0.66)
    upper_leg_half_width = _masked_half_extent(vertices[:, 0], upper_leg_mask, quantile=0.62)
    lower_leg_half_width = _masked_half_extent(vertices[:, 0], lower_leg_mask, quantile=0.62)
    head_half_width = _masked_half_extent(vertices[:, 0], head_mask, quantile=0.60)
    target_shoulder_half = shoulder_width_cm / 200.0
    target_pelvis_half = pelvis_width_cm / 200.0
    torso_depth_half = torso_depth_cm / 200.0

    x_scale = np.ones(len(vertices), dtype=np.float32)
    z_scale = np.ones(len(vertices), dtype=np.float32)

    # Apply scaling using consistent T-pose correction for all regions
    x_scale += shoulder_mask * ((target_shoulder_half / shoulder_half_width) - 1.0) * 1.0
    x_scale += chest_mask * (((target_shoulder_half * 0.92) / chest_half_width) - 1.0) * 0.95
    x_scale += pelvis_mask * ((target_pelvis_half / pelvis_half_width) - 1.0) * 1.0
    x_scale += upper_leg_mask * (((target_pelvis_half * 0.58) / upper_leg_half_width) - 1.0) * 0.60
    x_scale += lower_leg_mask * (((target_pelvis_half * 0.40) / lower_leg_half_width) - 1.0) * 0.48
    x_scale += head_mask * (((target_shoulder_half * 0.46) / head_half_width) - 1.0) * 0.30

    chest_half_depth = _masked_half_extent(vertices[:, 2], chest_mask + shoulder_mask, quantile=0.66)
    pelvis_half_depth = _masked_half_extent(vertices[:, 2], pelvis_mask, quantile=0.64)
    z_scale += chest_mask * ((torso_depth_half / chest_half_depth) - 1.0) * 1.02
    z_scale += pelvis_mask * (((torso_depth_half * 0.92) / pelvis_half_depth) - 1.0) * 0.84
    z_scale += shoulder_mask * (((torso_depth_half * 1.06) / chest_half_depth) - 1.0) * 0.72

    vertices[:, 0] *= x_scale
    vertices[:, 2] *= z_scale

    pelvis_y = min_y + total_h * 0.52
    shoulder_y = min_y + total_h * 0.78
    leg_scale = np.clip((leg_length_cm / 100.0) / (total_h * 0.50), 0.82, 1.22)
    torso_scale = np.clip((torso_length_cm / 100.0) / (total_h * 0.30), 0.84, 1.18)
    arm_spread_scale = np.clip((arm_length_cm / 100.0) / (target_height_m * 0.40), 0.88, 1.10)

    below_pelvis = vertices[:, 1] < pelvis_y
    vertices[below_pelvis, 1] = pelvis_y + (vertices[below_pelvis, 1] - pelvis_y) * leg_scale

    torso_region = (vertices[:, 1] >= pelvis_y) & (vertices[:, 1] < shoulder_y)
    vertices[torso_region, 1] = pelvis_y + (vertices[torso_region, 1] - pelvis_y) * torso_scale

    arm_threshold = max(shoulder_half_width * 1.18, target_shoulder_half * 1.05)
    arm_region = (np.abs(vertices[:, 0]) > arm_threshold) & (vertices[:, 1] > pelvis_y * 0.95)
    vertices[arm_region, 0] *= arm_spread_scale


def _apply_posture_warp(vertices: np.ndarray, analysis: Dict[str, Any]) -> None:
    min_y = float(vertices[:, 1].min())
    max_y = float(vertices[:, 1].max())
    total_h = max(max_y - min_y, 1e-6)
    y_norm = np.clip((vertices[:, 1] - min_y) / total_h, 0.0, 1.0)

    shoulder_mask = _smooth_band_np(y_norm, 0.68, 0.88)
    torso_mask = _smooth_band_np(y_norm, 0.44, 0.80)
    pelvis_mask = _smooth_band_np(y_norm, 0.38, 0.58)
    knee_mask = _smooth_band_np(y_norm, 0.14, 0.36)
    lower_leg_mask = _smooth_band_np(y_norm, 0.02, 0.28)
    head_mask = _smooth_band_np(y_norm, 0.84, 1.0)
    side_sign = np.where(vertices[:, 0] >= 0.0, 1.0, -1.0)

    head_tilt = _signed_metric_radians(analysis.get("head_tilt"), 0.9)
    shoulder_slope = _signed_metric_radians(analysis.get("shoulder_slope"), 0.60)
    pelvic_balance = _signed_metric_radians(analysis.get("pelvic_balance"), 0.52)
    lower_body_sym = _signed_metric_magnitude(analysis.get("lower_body_symmetry"), 0.028)
    xo_leg = _signed_xo_leg(analysis.get("xo_leg"), 0.055)
    body_center = _signed_metric_magnitude(analysis.get("body_center"), 0.035)
    waist_shift = _signed_metric_magnitude(analysis.get("waist_shape"), 0.022)
    forward_head = _metric_magnitude(analysis.get("head_neck_shape"), 0.12) + _metric_magnitude(analysis.get("cervical_alignment"), 0.10)
    round_shoulder = _metric_magnitude(analysis.get("shoulder_back_shape"), 0.10) + _metric_magnitude(analysis.get("back_shape"), 0.09)
    lumbar_curve = _metric_magnitude(analysis.get("lumbar_curve"), 0.08)
    pelvic_tilt = _metric_magnitude(analysis.get("pelvic_shape"), 0.06)

    vertices[:, 0] += body_center * shoulder_mask * 0.35
    vertices[:, 0] += waist_shift * torso_mask * 0.40
    vertices[:, 1] += side_sign * shoulder_slope * shoulder_mask * total_h * 0.07
    vertices[:, 1] += side_sign * pelvic_balance * pelvis_mask * total_h * 0.05
    vertices[:, 0] += side_sign * xo_leg * knee_mask * np.abs(vertices[:, 0]) * 0.9
    vertices[:, 2] += forward_head * head_mask * total_h * 0.12
    vertices[:, 2] += round_shoulder * shoulder_mask * total_h * 0.10
    vertices[:, 2] += pelvic_tilt * pelvis_mask * total_h * 0.05
    vertices[:, 2] += lumbar_curve * torso_mask * total_h * np.where(vertices[:, 1] > (min_y + total_h * 0.55), -0.03, 0.06)

    left_leg = side_sign < 0.0
    right_leg = ~left_leg
    leg_region = lower_leg_mask > 0.0
    vertices[left_leg & leg_region, 1] += lower_body_sym * total_h
    vertices[right_leg & leg_region, 1] -= lower_body_sym * total_h

    if abs(head_tilt) > 1e-6:
        pivot_y = min_y + total_h * 0.88
        head_indices = np.where(head_mask > 0.001)[0]
        dx = vertices[head_indices, 0]
        dy = vertices[head_indices, 1] - pivot_y
        cos_a = np.cos(head_tilt * head_mask[head_indices])
        sin_a = np.sin(head_tilt * head_mask[head_indices])
        vertices[head_indices, 0] = dx * cos_a - dy * sin_a
        vertices[head_indices, 1] = pivot_y + dx * sin_a + dy * cos_a


def _smooth_band_np(values: np.ndarray, start: float, end: float) -> np.ndarray:
    mid = (start + end) * 0.5
    result = np.zeros_like(values, dtype=np.float32)

    rising = (values > start) & (values <= mid)
    falling = (values > mid) & (values < end)
    result[rising] = (values[rising] - start) / max(1e-6, (mid - start))
    result[falling] = (end - values[falling]) / max(1e-6, (end - mid))
    return np.clip(result, 0.0, 1.0)


def _masked_half_extent(values: np.ndarray, mask: np.ndarray, quantile: float = 0.66) -> float:
    active = np.abs(values[mask > 0.18])
    if active.size == 0:
        active = np.abs(values)
    return max(float(np.quantile(active, quantile)), 1e-6)


def _metric_magnitude(metric: Optional[Dict[str, Any]], max_scale: float) -> float:
    if not metric:
        return 0.0
    value = metric.get("value")
    if value is None:
        return 0.0
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0

    unit = metric.get("unit") or ""
    if unit in ("score", "ratio"):
        normalized = np.clip(value, 0.0, 1.5) / 1.5
    else:
        normalized = np.clip(value, 0.0, 40.0) / 40.0
    return float(normalized * max_scale)


def _signed_metric_magnitude(metric: Optional[Dict[str, Any]], max_scale: float) -> float:
    magnitude = _metric_magnitude(metric, max_scale)
    metric_type = str((metric or {}).get("type") or "").lower()
    if "left" in metric_type:
        return -magnitude
    if "right" in metric_type:
        return magnitude
    return 0.0


def _signed_metric_radians(metric: Optional[Dict[str, Any]], multiplier: float) -> float:
    if not metric or metric.get("value") is None:
        return 0.0
    try:
        value = float(metric["value"])
    except (TypeError, ValueError):
        return 0.0

    metric_type = str(metric.get("type") or "").lower()
    signed = -value if "left" in metric_type else value if "right" in metric_type else 0.0
    return float(np.deg2rad(signed * multiplier))


def _signed_xo_leg(metric: Optional[Dict[str, Any]], max_scale: float) -> float:
    magnitude = _metric_magnitude(metric, max_scale)
    metric_type = str((metric or {}).get("type") or "").lower()
    if "o_" in metric_type:
        return magnitude
    if "x_" in metric_type:
        return -magnitude
    if "xo_" in metric_type:
        return magnitude * 0.45
    return 0.0
