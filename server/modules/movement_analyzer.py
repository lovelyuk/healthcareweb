from __future__ import annotations

from typing import Dict, List

from core.pose_engine import point_by_name


def compute_angle(a, b, c) -> float:
    import math
    abx = float(a["x"]) - float(b["x"])
    aby = float(a["y"]) - float(b["y"])
    cbx = float(c["x"]) - float(b["x"])
    cby = float(c["y"]) - float(b["y"])
    dot = abx * cbx + aby * cby
    mag1 = math.sqrt(abx * abx + aby * aby) + 1e-6
    mag2 = math.sqrt(cbx * cbx + cby * cby) + 1e-6
    cos_v = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_v))

def analyze_movement_from_landmarks(landmarks: List[Dict], test_type: str) -> dict:
    import math
    result = {
        "module": "movement",
        "test_type": test_type,
        "status": "ok",
        "metrics": {},
        "guides": [],
        "summary": "",
    }

    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    lk = point_by_name(landmarks, "left_knee")
    rk = point_by_name(landmarks, "right_knee")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    lw = point_by_name(landmarks, "left_wrist")
    rw = point_by_name(landmarks, "right_wrist")

    if test_type == "deep_squat":
        points = [lh, rh, lk, rk, la, ra]
        if not all(points) or any(float(p.get("visibility", 0)) < 0.5 for p in points):
            result["status"] = "missing_points"
            result["summary"] = "점 인식 상태가 불안정합니다. 전신이 잘 보이게 서주세요."
            return result

        # 1. Squat Depth (Angle based)
        # We average left and right knee flexion
        left_knee_flex = compute_angle(lh, lk, la)
        right_knee_flex = compute_angle(rh, rk, ra)
        avg_knee_angle = (left_knee_flex + right_knee_flex) / 2.0
        
        # 2. Balance (Left/Right Hip Height symmetry)
        # Using Y coordinates (lower Y is higher in image, but we care about height difference)
        hip_diff = abs(float(lh["y"]) - float(rh["y"]))
        # Normalize balance: 100% means perfect symmetry, 0% means huge lean
        # Threshold: if diff is more than 30px (~5-10cm), balance drops
        balance_left = 50.0
        balance_right = 50.0
        if hip_diff > 2:
            if float(lh["y"]) > float(rh["y"]): # Left hip is lower (larger Y)
                balance_right = 50.0 + min(15.0, hip_diff / 4.0)
                balance_left = 100.0 - balance_right
            else:
                balance_left = 50.0 + min(15.0, hip_diff / 4.0)
                balance_right = 100.0 - balance_left

        # 3. Trunk Tilt (Shoulder-Hip alignment)
        shoulder_mid_x = (float(ls["x"]) + float(rs["x"])) / 2.0
        hip_mid_x = (float(lh["x"]) + float(rh["x"])) / 2.0
        trunk_tilt_px = shoulder_mid_x - hip_mid_x # negative means leaning left

        result["metrics"] = {
            "knee_angle": round(avg_knee_angle, 1),
            "balance_left": round(balance_left, 1),
            "balance_right": round(balance_right, 1),
            "trunk_tilt": round(trunk_tilt_px, 1),
            "hip_center_y": round((float(lh["y"]) + float(rh["y"])) / 2.0, 1),
            "knee_center_y": round((float(lk["y"]) + float(rk["y"])) / 2.0, 1),
        }
        
        # Squat State logic for frontend rep counting
        # Depth < 110 deg is considered "deep" or "bottom zone"
        # Depth > 160 deg is "standing" 
        state = "moving"
        if avg_knee_angle < 110: 
            state = "bottom"
        elif avg_knee_angle > 160: 
            state = "standing"
        
        result["metrics"]["squat_state"] = state
        result["summary"] = f"스쿼트 각도: {avg_knee_angle:.1f}도 | 상태: {state}"
        return result

    if test_type == "single_leg_balance":
        if not all([lh, rh]):
            result["status"] = "missing_points"
            result["summary"] = "균형 분석에 필요한 점이 부족합니다."
            return result

        sway = abs(float(lh["x"]) - float(rh["x"]))
        result["metrics"] = {
            "pelvic_sway_px": round(sway, 2),
        }
        result["summary"] = "싱글 레그 밸런스 골반 흔들림 계산 완료"
        return result

    if test_type == "hurdle_step":
        if not all([lk, rk, la, ra]):
            result["status"] = "missing_points"
            result["summary"] = "허들 스텝 분석에 필요한 점이 부족합니다."
            return result

        knee_height_diff = abs(float(lk["y"]) - float(rk["y"]))
        ankle_height_diff = abs(float(la["y"]) - float(ra["y"]))
        result["metrics"] = {
            "knee_height_diff_px": round(knee_height_diff, 2),
            "ankle_height_diff_px": round(ankle_height_diff, 2),
        }
        result["summary"] = "허들 스텝 높이 차이 계산 완료"
        return result

    if test_type == "lunge":
        if not all([lh, rh, lk, rk]):
            result["status"] = "missing_points"
            result["summary"] = "런지 분석에 필요한 점이 부족합니다."
            return result

        knee_offset = abs(float(lk["x"]) - float(rk["x"]))
        hip_offset = abs(float(lh["x"]) - float(rh["x"]))
        result["metrics"] = {
            "knee_offset_px": round(knee_offset, 2),
            "hip_offset_px": round(hip_offset, 2),
        }
        result["summary"] = "런지 정렬 차이 계산 완료"
        return result

    if test_type == "jump":
        if not all([lk, rk, la, ra]):
            result["status"] = "missing_points"
            result["summary"] = "점프 분석에 필요한 점이 부족합니다."
            return result

        landing_width = abs(float(la["x"]) - float(ra["x"]))
        knee_width = abs(float(lk["x"]) - float(rk["x"]))
        result["metrics"] = {
            "landing_width_px": round(landing_width, 2),
            "knee_width_px": round(knee_width, 2),
        }
        result["summary"] = "점프 착지 정렬 계산 완료"
        return result

    if test_type == "arm_raise":
        if not all([ls, rs, lw, rw]):
            result["status"] = "missing_points"
            result["summary"] = "팔 들기 분석에 필요한 점이 부족합니다."
            return result

        wrist_height = min(float(lw["y"]), float(rw["y"]))
        shoulder_height = min(float(ls["y"]), float(rs["y"]))
        raise_delta = shoulder_height - wrist_height
        result["metrics"] = {
            "raise_delta_px": round(raise_delta, 2),
        }
        result["summary"] = "팔 들기 높이 계산 완료"
        return result

    result["status"] = "todo"
    result["summary"] = f"{test_type} 분석 로직은 아직 추가 전입니다."
    return result