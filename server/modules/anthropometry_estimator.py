from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import cv2

# REALSENSE_DEPENDENCY: camera_manager 함수들이 RealSense calibration 사용
from core.camera_manager import (
    deproject_pixels_to_points,  # REALSENSE_DEPENDENCY
    depth_raw_to_meters,  # REALSENSE_DEPENDENCY
    get_camera_calibration,  # REALSENSE_DEPENDENCY
)

FX = 615.0
FY = 615.0


def point_by_name(landmarks: List[Dict[str, Any]], name: str):
    for lm in landmarks:
        if lm.get("name") == name:
            return lm
    return None


# REALSENSE_DEPENDENCY: depth_image 기반 신체 치수 추정
# - 웹캡 전환 시 depth_image=None → 빈 dict 반환 (2D 추정 fallback 없음)
# - 향후 2D landmark 기반 추정 fallback 구현 필요
def estimate_anthropometry_from_frame(
    landmarks: List[Dict[str, Any]],
    depth_image,  # REALSENSE_DEPENDENCY: RealSense depth image
    frame_width: int,
    frame_height: int,
    view: str,
) -> Dict[str, Dict[str, Any]]:
    if not landmarks or depth_image is None:  # REALSENSE_DEPENDENCY: depth None 체크
        return {}

    metrics: Dict[str, Dict[str, Any]] = {}
    calibration = get_camera_calibration()
    body_mask, body_depth_m = _build_body_mask(
        landmarks,
        depth_image,
        frame_width,
        frame_height,
        calibration,
    )

    height_cm = _estimate_height_cm(
        landmarks,
        depth_image,
        body_mask,
        body_depth_m,
        frame_width,
        frame_height,
        calibration,
    )
    if height_cm:
        metrics["height"] = _metric(height_cm, "cm", view, "estimated_height")

    shoulder_width = _estimate_band_width_cm(
        landmarks,
        depth_image,
        body_mask,
        body_depth_m,
        ("left_shoulder", "right_shoulder"),
        calibration=calibration,
    ) or _segment_length_cm(landmarks, depth_image, "left_shoulder", "right_shoulder")
    if shoulder_width:
        metrics["shoulder_width"] = _metric(shoulder_width, "cm", view, "shoulder_span")

    pelvis_width = _estimate_band_width_cm(
        landmarks,
        depth_image,
        body_mask,
        body_depth_m,
        ("left_hip", "right_hip"),
        calibration=calibration,
    ) or _segment_length_cm(landmarks, depth_image, "left_hip", "right_hip")
    if pelvis_width:
        metrics["pelvis_width"] = _metric(pelvis_width, "cm", view, "pelvis_span")

    arm_length = _paired_chain_length_cm(
        landmarks,
        depth_image,
        [["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"]],
        [["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"]],
        calibration=calibration,
    )
    if arm_length:
        metrics["arm_length"] = _metric(arm_length, "cm", view, "arm_chain")

    leg_length = _paired_chain_length_cm(
        landmarks,
        depth_image,
        [["left_hip", "left_knee"], ["left_knee", "left_ankle"]],
        [["right_hip", "right_knee"], ["right_knee", "right_ankle"]],
        calibration=calibration,
    )
    if leg_length:
        metrics["leg_length"] = _metric(leg_length, "cm", view, "leg_chain")

    torso_length = _midpoint_distance_cm(
        landmarks,
        depth_image,
        ("left_shoulder", "right_shoulder"),
        ("left_hip", "right_hip"),
        calibration=calibration,
    )
    if torso_length:
        metrics["torso_length"] = _metric(torso_length, "cm", view, "torso_midline")

    if view in ("right_side", "left_side", "side"):
        torso_depth = _estimate_side_depth_cm(
            landmarks,
            depth_image,
            body_mask,
            body_depth_m,
            frame_width,
            frame_height,
            calibration,
        )
        if torso_depth:
            metrics["torso_depth"] = _metric(torso_depth, "cm", view, "side_depth")

    return metrics


def build_body_model_from_payloads(front_payload: Dict[str, Any], side_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    front_analysis = front_payload.get("analysis") or {}
    side_analysis = side_payload.get("analysis") or {}

    height = _metric_value(front_analysis, "height")
    shoulder_width = _metric_value(front_analysis, "shoulder_width")
    pelvis_width = _metric_value(front_analysis, "pelvis_width")
    arm_length = _metric_value(front_analysis, "arm_length")
    leg_length = _metric_value(front_analysis, "leg_length")
    torso_length = _metric_value(front_analysis, "torso_length")
    torso_depth = _metric_value(side_analysis, "torso_depth") or (pelvis_width * 0.62 if pelvis_width else None)

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

    vertices, faces = _build_parametric_body_mesh(
        height_cm=height,
        shoulder_width_cm=shoulder_width,
        pelvis_width_cm=pelvis_width,
        arm_length_cm=arm_length,
        leg_length_cm=leg_length,
        torso_length_cm=torso_length,
        torso_depth_cm=torso_depth,
    )

    return {
        "ok": True,
        "type": "landmark_humanoid_body_v2",
        "unit": "cm",
        "vertices": vertices,
        "faces": faces,
        "meta": {
            "height_cm": height,
            "shoulder_width_cm": shoulder_width,
            "pelvis_width_cm": pelvis_width,
            "arm_length_cm": arm_length,
            "leg_length_cm": leg_length,
            "torso_length_cm": torso_length,
            "torso_depth_cm": torso_depth,
        },
    }


def _metric(value: float, unit: str, view: str, kind: str) -> Dict[str, Any]:
    return {
        "enabled": True,
        "view": view,
        "value": round(float(value), 2),
        "unit": unit,
        "type": kind,
        "grade": "normal",
        "confidence": 0.82,
        "summary": f"{kind.replace('_', ' ')} estimated from landmarks and depth.",
    }


def _metric_value(analysis: Dict[str, Any], key: str) -> Optional[float]:
    item = analysis.get(key)
    if not item:
        return None
    value = item.get("value")
    if value is None:
        return None
    return float(value)


def _landmark_3d(
    landmarks: List[Dict[str, Any]],
    depth_image,
    name: str,
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[np.ndarray]:
    lm = point_by_name(landmarks, name)
    if not lm:
        return None

    x = int(np.clip(round(float(lm["x"])), 0, depth_image.shape[1] - 1))
    y = int(np.clip(round(float(lm["y"])), 0, depth_image.shape[0] - 1))
    depth_scale = float((calibration or {}).get("depth_scale", 0.001))
    depth_m = float(depth_image[y, x]) * depth_scale
    if depth_m <= 0:
        return None

    if calibration is not None:
        return deproject_pixels_to_points(
            pixel_x=np.asarray([x], dtype=np.float32),
            pixel_y=np.asarray([y], dtype=np.float32),
            depth_values=np.asarray([depth_m], dtype=np.float32),
            calibration=calibration,
            output_space="color",
        )[0]

    cx = depth_image.shape[1] / 2.0
    cy = depth_image.shape[0] / 2.0
    return np.array([
        (x - cx) * depth_m / FX,
        -(y - cy) * depth_m / FY,
        depth_m,
    ], dtype=np.float32)


def _segment_length_cm(
    landmarks,
    depth_image,
    a_name: str,
    b_name: str,
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    a = _landmark_3d(landmarks, depth_image, a_name, calibration)
    b = _landmark_3d(landmarks, depth_image, b_name, calibration)
    if a is None or b is None:
        return None
    return float(np.linalg.norm(a - b) * 100.0)


def _paired_chain_length_cm(
    landmarks,
    depth_image,
    left_segments: List[List[str]],
    right_segments: List[List[str]],
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    lengths = []
    for chain in (left_segments, right_segments):
        total = 0.0
        ok = True
        for a_name, b_name in chain:
            seg = _segment_length_cm(landmarks, depth_image, a_name, b_name, calibration)
            if seg is None:
                ok = False
                break
            total += seg
        if ok:
            lengths.append(total)
    if not lengths:
        return None
    return float(np.mean(lengths))


def _midpoint_distance_cm(
    landmarks,
    depth_image,
    upper_pair: tuple[str, str],
    lower_pair: tuple[str, str],
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    a1 = _landmark_3d(landmarks, depth_image, upper_pair[0], calibration)
    a2 = _landmark_3d(landmarks, depth_image, upper_pair[1], calibration)
    b1 = _landmark_3d(landmarks, depth_image, lower_pair[0], calibration)
    b2 = _landmark_3d(landmarks, depth_image, lower_pair[1], calibration)
    if any(v is None for v in (a1, a2, b1, b2)):
        return None
    upper_mid = (a1 + a2) / 2.0
    lower_mid = (b1 + b2) / 2.0
    return float(np.linalg.norm(upper_mid - lower_mid) * 100.0)


def _estimate_height_cm(
    landmarks,
    depth_image,
    body_mask,
    body_depth_m,
    frame_width: int,
    frame_height: int,
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    visible = [lm for lm in landmarks if float(lm.get("visibility", 0.0)) >= 0.35]
    if len(visible) < 6:
        return None

    if body_mask is not None and np.any(body_mask):
        ys, xs = np.where(body_mask)
        top_points = _sample_mask_edge_points(xs, ys, body_depth_m, top=True)
        bottom_points = _sample_mask_edge_points(xs, ys, body_depth_m, top=False)
        if top_points is not None and bottom_points is not None:
            top_world = _deproject_sampled_points(top_points, calibration)
            bottom_world = _deproject_sampled_points(bottom_points, calibration)
            if top_world is not None and bottom_world is not None:
                return float(abs(top_world[1] - bottom_world[1]) * 100.0)

    ys = np.array([float(lm["y"]) for lm in visible], dtype=np.float32)
    depths = []
    for lm in visible:
        x = int(np.clip(round(float(lm["x"])), 0, frame_width - 1))
        y = int(np.clip(round(float(lm["y"])), 0, frame_height - 1))
        depth_scale = float((calibration or {}).get("depth_scale", 0.001))
        depth_m = float(depth_image[y, x]) * depth_scale
        if depth_m > 0:
            depths.append(depth_m)
    if not depths:
        return None

    median_depth = float(np.median(depths))
    pixel_height = float(np.max(ys) - np.min(ys))
    fy = _fy_from_calibration(calibration) or FY
    return ((pixel_height + 28.0) * median_depth / fy) * 100.0


def _estimate_side_depth_cm(
    landmarks,
    depth_image,
    body_mask,
    body_depth_m,
    frame_width: int,
    frame_height: int,
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    if body_mask is not None and np.any(body_mask):
        shoulder_band = _estimate_band_width_cm(
            landmarks,
            depth_image,
            body_mask,
            body_depth_m,
            ("left_shoulder", "right_shoulder"),
            vertical_margin=18,
            calibration=calibration,
        )
        hip_band = _estimate_band_width_cm(
            landmarks,
            depth_image,
            body_mask,
            body_depth_m,
            ("left_hip", "right_hip"),
            vertical_margin=18,
            calibration=calibration,
        )
        values = [v for v in (shoulder_band, hip_band) if v]
        if values:
            return float(np.mean(values))

    names = ["shoulder", "hip"]
    xs = []
    depths = []
    for prefix in ("left", "right"):
        for name in names:
            lm = point_by_name(landmarks, f"{prefix}_{name}")
            if not lm:
                continue
            x = int(np.clip(round(float(lm["x"])), 0, frame_width - 1))
            y = int(np.clip(round(float(lm["y"])), 0, frame_height - 1))
            depth_scale = float((calibration or {}).get("depth_scale", 0.001))
            depth_m = float(depth_image[y, x]) * depth_scale
            if depth_m <= 0:
                continue
            xs.append(float(lm["x"]))
            depths.append(depth_m)
    if not xs or not depths:
        return None

    lateral_px = max(xs) - min(xs) + 18.0
    median_depth = float(np.median(depths))
    fx = _fx_from_calibration(calibration) or FX
    return (lateral_px * median_depth / fx) * 100.0


def _build_body_mask(
    landmarks,
    depth_image,
    frame_width: int,
    frame_height: int,
    calibration: Optional[Dict[str, Any]] = None,
):
    valid_landmarks = [
        lm for lm in landmarks
        if float(lm.get("visibility", 0.0)) >= 0.35 and float(lm.get("presence", 0.0)) >= 0.35
    ]
    depth_m = depth_raw_to_meters(depth_image, calibration)
    if len(valid_landmarks) < 4:
        return np.zeros((frame_height, frame_width), dtype=bool), depth_m

    xs = np.array([float(lm["x"]) for lm in valid_landmarks], dtype=np.float32)
    ys = np.array([float(lm["y"]) for lm in valid_landmarks], dtype=np.float32)
    x_min = max(0, int(np.floor(xs.min() - frame_width * 0.12)))
    x_max = min(frame_width, int(np.ceil(xs.max() + frame_width * 0.12)))
    y_min = max(0, int(np.floor(ys.min() - frame_height * 0.12)))
    y_max = min(frame_height, int(np.ceil(ys.max() + frame_height * 0.16)))

    roi_mask = np.zeros((frame_height, frame_width), dtype=np.uint8)
    roi_mask[y_min:y_max, x_min:x_max] = 255

    depths = []
    for lm in valid_landmarks:
        px = int(np.clip(round(float(lm["x"])), 0, frame_width - 1))
        py = int(np.clip(round(float(lm["y"])), 0, frame_height - 1))
        z = float(depth_m[py, px])
        if z > 0:
            depths.append(z)

    if depths:
        median_depth = float(np.median(depths))
        depth_mask = (depth_m > max(0.3, median_depth - 0.45)) & (depth_m < median_depth + 0.45)
    else:
        depth_mask = depth_m > 0

    mask = (roi_mask > 0) & depth_mask
    mask_u8 = (mask.astype(np.uint8) * 255)
    kernel = np.ones((7, 7), dtype=np.uint8)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask_u8.astype(bool), depth_m


def _estimate_band_width_cm(
    landmarks,
    depth_image,
    body_mask,
    body_depth_m,
    pair_names: tuple[str, str],
    vertical_margin: int = 14,
    calibration: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    if body_mask is None or not np.any(body_mask):
        return None

    lm_a = point_by_name(landmarks, pair_names[0])
    lm_b = point_by_name(landmarks, pair_names[1])
    ys = []
    for lm in (lm_a, lm_b):
        if lm:
            ys.append(int(round(float(lm["y"]))))
    if not ys:
        return None

    y_center = int(np.clip(round(np.mean(ys)), 0, body_mask.shape[0] - 1))
    y1 = max(0, y_center - vertical_margin)
    y2 = min(body_mask.shape[0], y_center + vertical_margin + 1)
    band = body_mask[y1:y2, :]
    cols = np.where(np.any(band, axis=0))[0]
    if len(cols) < 2:
        return None

    x_span = float(cols[-1] - cols[0])
    depth_values = body_depth_m[y1:y2, cols[0]:cols[-1] + 1]
    depth_values = depth_values[depth_values > 0]
    if depth_values.size == 0:
        return None

    if calibration is not None:
        row = int(np.clip(round((y1 + y2 - 1) / 2.0), 0, body_mask.shape[0] - 1))
        left_x = float(cols[0])
        right_x = float(cols[-1])
        depth_m = float(np.median(depth_values))
        edge_points = deproject_pixels_to_points(
            pixel_x=np.asarray([left_x, right_x], dtype=np.float32),
            pixel_y=np.asarray([row, row], dtype=np.float32),
            depth_values=np.asarray([depth_m, depth_m], dtype=np.float32),
            calibration=calibration,
            output_space="color",
        )
        return float(np.linalg.norm(edge_points[1] - edge_points[0]) * 100.0)

    depth_m = float(np.median(depth_values))
    return (x_span * depth_m / FX) * 100.0


def _sample_mask_edge_points(xs, ys, body_depth_m, top: bool) -> Optional[np.ndarray]:
    if xs.size == 0 or ys.size == 0:
        return None
    threshold = np.quantile(ys, 0.01 if top else 0.99)
    band_mask = ys <= threshold if top else ys >= threshold
    if not np.any(band_mask):
        return None
    sampled = np.column_stack((xs[band_mask], ys[band_mask]))
    depth_values = body_depth_m[sampled[:, 1], sampled[:, 0]]
    valid = depth_values > 0
    if not np.any(valid):
        return None
    sampled = sampled[valid]
    depth_values = depth_values[valid]
    if len(sampled) > 48:
        indices = np.linspace(0, len(sampled) - 1, 48, dtype=np.int32)
        sampled = sampled[indices]
        depth_values = depth_values[indices]
    return np.column_stack((sampled[:, 0], sampled[:, 1], depth_values))


def _deproject_sampled_points(samples: np.ndarray, calibration: Optional[Dict[str, Any]]) -> Optional[np.ndarray]:
    if samples is None or len(samples) == 0:
        return None
    if calibration is not None:
        points = deproject_pixels_to_points(
            pixel_x=samples[:, 0].astype(np.float32),
            pixel_y=samples[:, 1].astype(np.float32),
            depth_values=samples[:, 2].astype(np.float32),
            calibration=calibration,
            output_space="color",
        )
        return np.median(points, axis=0)

    depth_m = float(np.median(samples[:, 2]))
    x = float(np.median(samples[:, 0]))
    y = float(np.median(samples[:, 1]))
    cx = 320.0
    cy = 240.0
    return np.array([(x - cx) * depth_m / FX, -((y - cy) * depth_m / FY), depth_m], dtype=np.float32)


def _fx_from_calibration(calibration: Optional[Dict[str, Any]]) -> Optional[float]:
    if not calibration:
        return None
    intrinsics = calibration.get("aligned_depth_intrinsics") or calibration.get("color_intrinsics")
    if not intrinsics:
        return None
    return float(intrinsics.get("fx"))


def _fy_from_calibration(calibration: Optional[Dict[str, Any]]) -> Optional[float]:
    if not calibration:
        return None
    intrinsics = calibration.get("aligned_depth_intrinsics") or calibration.get("color_intrinsics")
    if not intrinsics:
        return None
    return float(intrinsics.get("fy"))


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


def _build_parametric_body_mesh(
    *,
    height_cm: float,
    shoulder_width_cm: float,
    pelvis_width_cm: float,
    arm_length_cm: float,
    leg_length_cm: float,
    torso_length_cm: float,
    torso_depth_cm: float,
):
    vertices: List[List[float]] = []
    faces: List[List[int]] = []
    segments = 26

    head_height = height_cm * 0.13
    neck_height = height_cm * 0.04
    chest_y = height_cm - head_height - neck_height
    waist_y = chest_y - torso_length_cm * 0.42
    pelvis_y = chest_y - torso_length_cm * 0.86
    shoulder_y = chest_y + torso_length_cm * 0.08
    knee_y = pelvis_y - leg_length_cm * 0.48
    ankle_y = max(4.0, pelvis_y - leg_length_cm * 0.96)
    head_center_y = height_cm - head_height * 0.52

    _append_ellipsoid(
        vertices,
        faces,
        center=(0.0, head_center_y, 0.0),
        radius_x=shoulder_width_cm * 0.17,
        radius_y=head_height * 0.50,
        radius_z=torso_depth_cm * 0.20,
        lat_segments=12,
        lon_segments=segments,
    )
    _append_oriented_limb(
        vertices,
        faces,
        centers=[
            (0.0, chest_y + neck_height * 0.30, 0.0),
            (0.0, chest_y + neck_height * 0.72, 0.0),
            (0.0, head_center_y - head_height * 0.38, 0.0),
        ],
        radii_x=[shoulder_width_cm * 0.08, shoulder_width_cm * 0.07, shoulder_width_cm * 0.06],
        radii_z=[torso_depth_cm * 0.09, torso_depth_cm * 0.08, torso_depth_cm * 0.07],
        segments=segments,
    )

    torso_rings = [
        (chest_y + neck_height * 0.80, shoulder_width_cm * 0.16, torso_depth_cm * 0.12),
        (chest_y + neck_height * 0.40, shoulder_width_cm * 0.22, torso_depth_cm * 0.15),
        (shoulder_y + torso_length_cm * 0.06, shoulder_width_cm * 0.58, torso_depth_cm * 0.37),
        (shoulder_y, shoulder_width_cm * 0.60, torso_depth_cm * 0.36),
        (chest_y, shoulder_width_cm * 0.54, torso_depth_cm * 0.33),
        (chest_y - torso_length_cm * 0.15, shoulder_width_cm * 0.47, torso_depth_cm * 0.30),
        (waist_y, shoulder_width_cm * 0.34, torso_depth_cm * 0.22),
        (pelvis_y + torso_length_cm * 0.14, pelvis_width_cm * 0.44, torso_depth_cm * 0.26),
        (pelvis_y + torso_length_cm * 0.05, pelvis_width_cm * 0.50, torso_depth_cm * 0.29),
        (pelvis_y, pelvis_width_cm * 0.53, torso_depth_cm * 0.32),
    ]
    _append_ring_surface(vertices, faces, torso_rings, segments)

    foot_y = 0.0
    hip_offset = pelvis_width_cm * 0.19
    thigh_r = pelvis_width_cm * 0.125
    calf_r = pelvis_width_cm * 0.085
    ankle_r = pelvis_width_cm * 0.045
    for side in (-1.0, 1.0):
        _append_oriented_limb(
            vertices,
            faces,
            centers=[
                (side * shoulder_width_cm * 0.30, shoulder_y + 1.0, torso_depth_cm * 0.02),
                (side * shoulder_width_cm * 0.44, shoulder_y + 0.4, torso_depth_cm * 0.018),
                (side * shoulder_width_cm * 0.56, shoulder_y - 1.0, torso_depth_cm * 0.012),
            ],
            radii_x=[shoulder_width_cm * 0.08, shoulder_width_cm * 0.09, shoulder_width_cm * 0.07],
            radii_z=[torso_depth_cm * 0.11, torso_depth_cm * 0.10, torso_depth_cm * 0.08],
            segments=segments,
        )
        _append_oriented_limb(
            vertices,
            faces,
            centers=[
                (side * hip_offset * 0.72, pelvis_y + 1.8, 0.0),
                (side * hip_offset * 0.92, pelvis_y + 0.8, torso_depth_cm * 0.015),
                (side * hip_offset * 1.00, pelvis_y - leg_length_cm * 0.14, torso_depth_cm * 0.018),
                (side * hip_offset * 0.94, knee_y, torso_depth_cm * 0.008),
                (side * hip_offset * 0.84, ankle_y, 0.0),
                (side * hip_offset * 0.78, foot_y + 2.0, torso_depth_cm * 0.035),
            ],
            radii_x=[thigh_r * 1.08, thigh_r * 1.22, thigh_r * 1.16, calf_r * 1.08, ankle_r, ankle_r * 0.74],
            radii_z=[thigh_r * 0.98, thigh_r * 1.05, thigh_r, calf_r * 0.88, ankle_r * 0.84, ankle_r * 0.56],
            segments=segments,
        )
        _append_oriented_limb(
            vertices,
            faces,
            centers=[
                (side * hip_offset * 0.80, foot_y + 2.4, torso_depth_cm * 0.03),
                (side * hip_offset * 0.92, foot_y + 1.1, torso_depth_cm * 0.11),
                (side * hip_offset * 1.10, foot_y + 0.7, torso_depth_cm * 0.18),
            ],
            radii_x=[ankle_r * 0.85, ankle_r * 1.18, ankle_r * 0.88],
            radii_z=[ankle_r * 1.15, ankle_r * 1.9, ankle_r * 1.45],
            segments=segments,
        )

    arm_drop = arm_length_cm * 0.52
    elbow_y = shoulder_y - arm_drop * 0.55
    wrist_y = shoulder_y - arm_drop
    shoulder_offset = shoulder_width_cm * 0.58
    upper_arm_r = shoulder_width_cm * 0.065
    forearm_r = shoulder_width_cm * 0.045
    hand_r = shoulder_width_cm * 0.03
    for side in (-1.0, 1.0):
        _append_oriented_limb(
            vertices,
            faces,
            centers=[
                (side * shoulder_offset * 0.86, shoulder_y + 0.2, torso_depth_cm * 0.012),
                (side * shoulder_offset * 1.00, shoulder_y - arm_drop * 0.16, torso_depth_cm * 0.015),
                (side * shoulder_offset * 1.08, elbow_y, torso_depth_cm * 0.01),
                (side * shoulder_offset * 1.06, wrist_y, torso_depth_cm * 0.03),
            ],
            radii_x=[upper_arm_r, upper_arm_r * 1.04, forearm_r, hand_r * 0.92],
            radii_z=[upper_arm_r * 1.10, upper_arm_r * 1.05, forearm_r * 0.82, hand_r * 0.60],
            segments=segments,
        )
        _append_oriented_limb(
            vertices,
            faces,
            centers=[
                (side * shoulder_offset * 1.08, wrist_y, torso_depth_cm * 0.03),
                (side * shoulder_offset * 1.10, wrist_y - arm_drop * 0.08, torso_depth_cm * 0.055),
                (side * shoulder_offset * 1.04, wrist_y - arm_drop * 0.16, torso_depth_cm * 0.07),
            ],
            radii_x=[hand_r * 0.95, hand_r * 0.88, hand_r * 0.42],
            radii_z=[hand_r * 1.2, hand_r * 1.45, hand_r * 0.72],
            segments=segments,
        )

    return vertices, faces


def _append_ring_surface(vertices: List[List[float]], faces: List[List[int]], rings, segments: int):
    start = len(vertices)
    for y_cm, rx_cm, rz_cm in rings:
        for i in range(segments):
            theta = (2.0 * math.pi * i) / segments
            vertices.append([
                round(math.cos(theta) * rx_cm, 3),
                round(y_cm, 3),
                round(math.sin(theta) * rz_cm, 3),
            ])

    ring_count = len(rings)
    for ring_idx in range(ring_count - 1):
        base_a = start + ring_idx * segments
        base_b = start + (ring_idx + 1) * segments
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append([base_a + i, base_b + i, base_b + ni])
            faces.append([base_a + i, base_b + ni, base_a + ni])


def _append_oriented_limb(
    vertices: List[List[float]],
    faces: List[List[int]],
    centers,
    radii_x,
    radii_z,
    segments: int,
):
    start_index = len(vertices)
    point_count = len(centers)
    if point_count < 2:
        return

    centers_np = [np.asarray(center, dtype=np.float32) for center in centers]
    for idx, center in enumerate(centers_np):
        prev_center = centers_np[idx - 1] if idx > 0 else center
        next_center = centers_np[idx + 1] if idx < point_count - 1 else center
        tangent = next_center - prev_center
        tangent_norm = float(np.linalg.norm(tangent))
        if tangent_norm < 1e-6:
            tangent = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        else:
            tangent = tangent / tangent_norm

        ref = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        if abs(float(np.dot(ref, tangent))) > 0.92:
            ref = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        axis_x = np.cross(ref, tangent)
        axis_x_norm = float(np.linalg.norm(axis_x))
        if axis_x_norm < 1e-6:
            axis_x = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        else:
            axis_x = axis_x / axis_x_norm
        axis_z = np.cross(tangent, axis_x)
        axis_z = axis_z / max(float(np.linalg.norm(axis_z)), 1e-6)

        rx = float(radii_x[idx])
        rz = float(radii_z[idx])
        for i in range(segments):
            theta = (2.0 * math.pi * i) / segments
            shape = 0.88 + 0.12 * math.cos(theta) ** 2
            point = center + axis_x * (math.cos(theta) * rx * shape) + axis_z * (math.sin(theta) * rz)
            vertices.append([round(float(point[0]), 3), round(float(point[1]), 3), round(float(point[2]), 3)])

    for ring_idx in range(point_count - 1):
        base_a = start_index + ring_idx * segments
        base_b = start_index + (ring_idx + 1) * segments
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append([base_a + i, base_b + i, base_b + ni])
            faces.append([base_a + i, base_b + ni, base_a + ni])


def _append_ellipsoid(
    vertices: List[List[float]],
    faces: List[List[int]],
    center,
    radius_x: float,
    radius_y: float,
    radius_z: float,
    lat_segments: int,
    lon_segments: int,
):
    cx, cy, cz = center
    start_index = len(vertices)
    for lat in range(lat_segments + 1):
        phi = math.pi * lat / lat_segments
        sin_phi = math.sin(phi)
        cos_phi = math.cos(phi)
        for lon in range(lon_segments):
            theta = (2.0 * math.pi * lon) / lon_segments
            vertices.append([
                round(cx + math.cos(theta) * radius_x * sin_phi, 3),
                round(cy + radius_y * cos_phi, 3),
                round(cz + math.sin(theta) * radius_z * sin_phi, 3),
            ])

    for lat in range(lat_segments):
        base_a = start_index + lat * lon_segments
        base_b = start_index + (lat + 1) * lon_segments
        for lon in range(lon_segments):
            next_lon = (lon + 1) % lon_segments
            faces.append([base_a + lon, base_b + lon, base_b + next_lon])
            faces.append([base_a + lon, base_b + next_lon, base_a + next_lon])
