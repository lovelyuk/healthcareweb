from __future__ import annotations

import math
from typing import Dict, List, Optional

from core.pose_engine import point_by_name
from utils.common_utils import safe_grade


def compute_angle(a, b, c) -> float:
    abx = float(a["x"]) - float(b["x"])
    aby = float(a["y"]) - float(b["y"])
    cbx = float(c["x"]) - float(b["x"])
    cby = float(c["y"]) - float(b["y"])

    dot = abx * cbx + aby * cby
    mag1 = math.sqrt(abx * abx + aby * aby) + 1e-6
    mag2 = math.sqrt(cbx * cbx + cby * cby) + 1e-6
    cos_v = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_v))


def side_name(side: Optional[str], part: str) -> str:
    return f"{side}_{part}" if side in ("left", "right") else f"right_{part}"


def analyze_rom_from_landmarks(landmarks: List[Dict], test_type: str, side: Optional[str] = None) -> dict:
    result = {
        "module": "rom",
        "test_type": test_type,
        "side": side,
        "status": "ok",
        "metrics": {},
        "guides": [],
        "summary": "",
    }

    if test_type == "cervical_rotation":
        nose = point_by_name(landmarks, "nose")
        le = point_by_name(landmarks, "left_ear")
        re = point_by_name(landmarks, "right_ear")
        if not all([nose, le, re]):
            result["status"] = "missing_points"
            result["summary"] = "경추 회전 측정을 위한 점이 부족합니다."
            return result

        # Robust 2D rotation estimation logic
        # MediaPipe Z is noisy, so we use horizontal ratio of nose between ears
        nx = float(nose["x"])
        lx = float(le["x"])
        rx = float(re["x"])
        
        # 1. Ear horizontal distance (Reference scale)
        ear_dist = abs(lx - rx)
        if ear_dist < 0.01:
            result["status"] = "missing_points"
            result["summary"] = "얼굴이 정면이 아니거나 너무 멀리 있습니다."
            return result

        # 2. Nose offset from center
        mid_x = (lx + rx) / 2.0
        # Ratio of nose offset relative to ear distance
        # ratio ~ 0.5 (nose at left ear), -0.5 (nose at right ear)
        ratio = (nx - mid_x) / ear_dist

        # 3. Angle Approximation using Sine curve (more natural than linear)
        # We assume 90 degrees happens when the nose reaches the ear profile (ratio = 0.5)
        # Using arcsin to map ratio slowly at start and faster at end
        # Clamping ratio to [-0.5, 0.5] to prevent > 90 deg anomalies
        clamped_ratio = max(-0.5, min(0.5, ratio))
        # angle_rad = arcsin(ratio * 2) -> when ratio=0.5, rad=pi/2=90deg
        angle_deg = math.degrees(math.asin(clamped_ratio * 2.0))
        angle = abs(angle_deg)

        # Direction determined by yaw sign
        direction = "left" if angle_deg > 0 else "right"

        result["side"] = direction
        result["metrics"] = {
            "rotation_angle": round(angle, 2),
            "direction": direction,
            "raw_ratio": round(ratio, 3),
            "grade": safe_grade(angle, 40.0, 70.0),
        }
        result["summary"] = f"경추 {direction} 회전: {angle:.1f}도"
        return result

    if test_type in ("shoulder_flexion", "shoulder_abduction"):
        shoulder = point_by_name(landmarks, side_name(side, "shoulder"))
        elbow = point_by_name(landmarks, side_name(side, "elbow"))
        hip = point_by_name(landmarks, side_name(side, "hip"))
        if not all([shoulder, elbow, hip]):
            result["status"] = "missing_points"
            result["summary"] = "어깨 ROM 측정을 위한 점이 부족합니다."
            return result

        angle_raw = compute_angle(elbow, shoulder, hip)
        # Normalize: 180 (straight) becomes 0, so "flexion" starts from 0
        angle = abs(180 - angle_raw)

        result["metrics"] = {
            "flexion_angle": round(angle, 2),
            "abduction_angle": round(angle, 2),
            "max_angle_deg": round(angle, 2),
            "raw_angle": round(angle_raw, 2),
            "grade": safe_grade(angle, 60.0, 140.0), # Assuming flexion range
        }
        result["summary"] = f"어깨 가동 범위: {angle:.1f}도"
        return result

    if test_type == "hip_flexion":
        shoulder = point_by_name(landmarks, side_name(side, "shoulder"))
        hip = point_by_name(landmarks, side_name(side, "hip"))
        knee = point_by_name(landmarks, side_name(side, "knee"))
        if not all([shoulder, hip, knee]):
            result["status"] = "missing_points"
            result["summary"] = "고관절 굴곡 측정을 위한 점이 부족합니다."
            return result

        angle_raw = compute_angle(shoulder, hip, knee)
        # Normalize: 180 (straight) becomes 0
        angle = abs(180 - angle_raw)

        result["metrics"] = {
            "flexion_angle": round(angle, 2),
            "max_angle_deg": round(angle, 2),
            "raw_angle": round(angle_raw, 2),
            "grade": safe_grade(angle, 40.0, 100.0),
        }
        result["summary"] = f"고관절 굴곡 각도: {angle:.1f}도"
        return result

    if test_type == "knee_flexion":
        hip = point_by_name(landmarks, side_name(side, "hip"))
        knee = point_by_name(landmarks, side_name(side, "knee"))
        ankle = point_by_name(landmarks, side_name(side, "ankle"))
        if not all([hip, knee, ankle]):
            result["status"] = "missing_points"
            result["summary"] = "무릎 굴곡 측정을 위한 점이 부족합니다."
            return result

        angle_raw = compute_angle(hip, knee, ankle)
        # Normalize: 180 (straight) becomes 0
        angle = abs(180 - angle_raw)

        result["metrics"] = {
            "flexion_angle": round(angle, 2),
            "max_angle_deg": round(angle, 2),
            "raw_angle": round(angle_raw, 2),
            "grade": safe_grade(angle, 40.0, 120.0),
        }
        result["summary"] = f"무릎 굴곡 각도: {angle:.1f}도"
        return result

    if test_type == "ankle_dorsiflexion":
        knee = point_by_name(landmarks, side_name(side, "knee"))
        ankle = point_by_name(landmarks, side_name(side, "ankle"))
        foot = point_by_name(landmarks, "left_foot_index" if side == "left" else "right_foot_index")
        if not all([knee, ankle, foot]):
            result["status"] = "missing_points"
            result["summary"] = "발목 배측굴곡 측정을 위한 점이 부족합니다."
            return result

        angle_raw = compute_angle(knee, ankle, foot)
        # Dorsiflexion: Foot is usually perpendicular (90) to leg.
        # Moving toward leg decreases angle (e.g. 70 deg angle = 20 deg dorsiflexion)
        angle = abs(90 - angle_raw)

        result["metrics"] = {
            "dorsiflexion_angle": round(angle, 2),
            "max_angle_deg": round(angle, 2),
            "raw_angle": round(angle_raw, 2),
            "grade": safe_grade(angle, 10.0, 20.0),
        }
        result["summary"] = f"발목 배측굴곡 각도: {angle:.1f}도"
        return result

    result["status"] = "todo"
    result["summary"] = f"{test_type} 분석 로직은 아직 추가 전입니다."
    return result