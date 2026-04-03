from __future__ import annotations

from typing import Any, Dict, List

from core.pose_engine import detect_view_type
from utils.math_utils import round_or_none, mid_point, signed_horizontal_offset, distance
from utils.angle_utils import line_angle_deg, vertical_deviation_deg
from utils.common_utils import safe_grade, make_disabled_result, make_line, make_point


DISPLAY_KEYS = [
    "xo_leg",
    "pelvic_balance",
    "pelvic_shape",
    "back_shape",
    "head_tilt",
    "head_neck_shape",
    "cervical_alignment",
    "body_center",
    "knee_shape",
    "shoulder_slope",
    "shoulder_balance",
    "shoulder_back_shape",
    "calf_shape",
    "lower_body_symmetry",
    "lumbar_curve",
    "waist_shape",
]


def point_by_name(landmarks: List[Dict[str, Any]], name: str):
    for lm in landmarks:
        if lm["name"] == name:
            return lm
    return None


def analyze_head_tilt(landmarks):
    nose = point_by_name(landmarks, "nose")
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    le = point_by_name(landmarks, "left_ear")
    re = point_by_name(landmarks, "right_ear")
    if not all([nose, ls, rs, le, re]):
        return make_disabled_result("front", "머리 기울기 분석에 필요한 점이 부족합니다."), []

    neck_mid = mid_point(ls, rs)
    head_mid = mid_point(le, re)
    # Deviation from vertical (ideal is -90 deg for up vector RS -> Head)
    deg_raw = line_angle_deg(neck_mid, head_mid)
    # dev is distance from -90 or 90
    dev = abs(abs(deg_raw) - 90)
    
    kind, grade, summary = "neutral", "normal", "머리 중심축이 대체로 수직입니다."
    if dev > 5.0:
        grade = "mild" if dev < 10.0 else "moderate"
        if deg_raw > -90 and deg_raw < 90:
            kind, summary = "right_tilt", "머리 중심축이 우측으로 기울어져 있습니다."
        else:
            kind, summary = "left_tilt", "머리 중심축이 좌측으로 기울어져 있습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(dev, 2),
        "unit": "deg",
        "type": kind,
        "grade": grade,
        "confidence": 0.90,
        "summary": summary,
    }, [
        make_line("head_axis", neck_mid, head_mid),
        make_line("shoulder_ref", ls, rs),
    ]


def analyze_shoulder_slope(landmarks):
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    if not all([ls, rs]):
        return make_disabled_result("front", "어깨 경사 분석에 필요한 점이 부족합니다."), []

    deg_raw = line_angle_deg(ls, rs)
    # Normalize deviation: how far from perfectly horizontal (0 or 180 / -180)
    dev = abs(deg_raw)
    if dev > 90:
        dev = abs(180 - dev)
    
    kind, grade, summary = "neutral", "normal", "좌우 어깨 높이가 대체로 수평입니다."
    if dev > 8.0:
        grade = "mild" if dev < 15.0 else "moderate"
        ydiff = float(rs["y"]) - float(ls["y"]) 
        if ydiff > 0:
            kind, summary = "left_high", "좌측 어깨가 높습니다."
        else:
            kind, summary = "right_high", "우측 어깨가 높습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(dev, 2),
        "unit": "deg",
        "type": kind,
        "grade": grade,
        "confidence": 0.95,
        "summary": summary,
    }, [
        make_line("shoulder_line", ls, rs),
    ]


def analyze_pelvic_balance(landmarks):
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    if not all([lh, rh]):
        return make_disabled_result("front", "골반 균형 분석에 필요한 점이 부족합니다."), []

    deg_raw = line_angle_deg(lh, rh)
    dev = abs(deg_raw)
    if dev > 90:
        dev = abs(180 - dev)

    kind, grade, summary = "neutral", "normal", "좌우 골반 높이가 대체로 수평입니다."
    if dev > 8.0:
        grade = "mild" if dev < 15.0 else "moderate"
        ydiff = float(rh["y"]) - float(lh["y"])
        if ydiff > 0:
            kind, summary = "left_high", "좌측 골반이 높습니다."
        else:
            kind, summary = "right_high", "우측 골반이 높습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(dev, 2),
        "unit": "deg",
        "type": kind,
        "grade": grade,
        "confidence": 0.92,
        "summary": summary,
    }, [
        make_line("pelvic_line", lh, rh),
    ]


def analyze_body_center(landmarks):
    nose = point_by_name(landmarks, "nose")
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    if not all([nose, lh, rh, la, ra]):
        return make_disabled_result("front", "몸의 좌우 중심 분석에 필요한 점이 부족합니다."), []

    hip_mid = mid_point(lh, rh)
    ankle_mid = mid_point(la, ra)
    upper_offset = signed_horizontal_offset(nose, hip_mid)
    lower_offset = signed_horizontal_offset(ankle_mid, hip_mid)
    total = (upper_offset + lower_offset) / 2.0
    total_abs = abs(total)

    kind, summary = "center", "신체 중심축이 대체로 중앙입니다."
    if total > 8:
        kind, summary = "right_shift", "신체 중심축이 우측으로 이동해 있습니다."
    elif total < -8:
        kind, summary = "left_shift", "신체 중심축이 좌측으로 이동해 있습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(total_abs, 2),
        "unit": "px",
        "type": kind,
        "grade": safe_grade(total_abs, 12.0, 24.0),
        "confidence": 0.88,
        "summary": summary,
    }, [
        make_line("body_midline", nose, ankle_mid),
        make_point("pelvis_center", hip_mid),
    ]


def analyze_shoulder_balance(landmarks):
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    if not all([ls, rs, lh, rh]):
        return make_disabled_result("front", "어깨 균형 분석에 필요한 점이 부족합니다."), []

    shoulder_mid = mid_point(ls, rs)
    hip_mid = mid_point(lh, rh)
    offset = signed_horizontal_offset(shoulder_mid, hip_mid)
    offset_abs = abs(offset)

    kind, summary = "balanced", "어깨 중심과 골반 중심이 대체로 일치합니다."
    if offset > 8:
        kind, summary = "right_shift", "어깨 중심이 우측으로 치우쳐 있습니다."
    elif offset < -8:
        kind, summary = "left_shift", "어깨 중심이 좌측으로 치우쳐 있습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(offset_abs, 2),
        "unit": "px",
        "type": kind,
        "grade": safe_grade(offset_abs, 12.0, 24.0),
        "confidence": 0.90,
        "summary": summary,
    }, [
        make_line("center_drop", shoulder_mid, hip_mid),
    ]


def analyze_knee_shape(landmarks):
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    lk = point_by_name(landmarks, "left_knee")
    rk = point_by_name(landmarks, "right_knee")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    if not all([lh, rh, lk, rk, la, ra]):
        return make_disabled_result("front", "무릎 형태 분석에 필요한 점이 부족합니다."), []

    knee_gap = abs(float(lk["x"]) - float(rk["x"]))
    ankle_gap = abs(float(la["x"]) - float(ra["x"]))
    score = abs(knee_gap - ankle_gap)

    kind, grade, summary = "neutral", "normal", "무릎 정렬이 대체로 중립입니다."
    if knee_gap < ankle_gap - 20:
        kind, grade, summary = "valgus_tendency", "moderate", "무릎이 안쪽으로 모이는 경향(X자형)이 심해 교정이 필요합니다."
    elif knee_gap < ankle_gap - 10:
        kind, grade, summary = "valgus_tendency", "mild", "무릎이 안쪽으로 모이는 경향(X자형)이 관찰됩니다."
    elif knee_gap > ankle_gap + 20:
        kind, grade, summary = "varus_tendency", "moderate", "무릎이 바깥쪽으로 벌어지는 경향(O자형)이 심해 교정이 필요합니다."
    elif knee_gap > ankle_gap + 10:
        kind, grade, summary = "varus_tendency", "mild", "무릎이 바깥쪽으로 벌어지는 경향(O자형)이 관찰됩니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(score, 2),
        "unit": "px",
        "type": kind,
        "grade": grade,
        "confidence": 0.84,
        "summary": summary,
    }, [
        make_line("left_leg_axis", lh, la),
        make_line("right_leg_axis", rh, ra),
    ]


def analyze_xo_leg(landmarks):
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    lk = point_by_name(landmarks, "left_knee")
    rk = point_by_name(landmarks, "right_knee")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    if not all([lh, rh, lk, rk, la, ra]):
        return make_disabled_result("front", "XO형 다리 분석에 필요한 점이 부족합니다."), []

    knee_gap = abs(float(lk["x"]) - float(rk["x"]))
    ankle_gap = abs(float(la["x"]) - float(ra["x"]))
    score = abs(knee_gap - ankle_gap)

    kind, grade, summary = "straight", "normal", "하지 축이 비교적 곧습니다."
    if knee_gap < ankle_gap - 25:
        kind, grade, summary = "x_tendency", "moderate", "X형 다리 경향이 심해 전문적인 관리가 필요합니다."
    elif knee_gap < ankle_gap - 12:
        kind, grade, summary = "x_tendency", "mild", "X형 다리 경향이 관찰됩니다."
    elif knee_gap > ankle_gap + 25:
        kind, grade, summary = "o_tendency", "moderate", "O형 다리 경향이 심해 전문적인 관리가 필요합니다."
    elif knee_gap > ankle_gap + 12:
        kind, grade, summary = "o_tendency", "mild", "O형 다리 경향이 관찰됩니다."
    elif score > 10:
        kind, grade, summary = "xo_tendency", "mild", "XO형 복합 경향이 약간 관찰됩니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(score, 2),
        "unit": "score",
        "type": kind,
        "grade": grade,
        "confidence": 0.87,
        "summary": summary,
    }, [
        make_line("knee_ref", lk, rk),
        make_line("ankle_ref", la, ra),
    ]


def analyze_lower_body_symmetry(landmarks):
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    if not all([lh, rh, la, ra]):
        return make_disabled_result("front", "하체 대칭성 분석에 필요한 점이 부족합니다."), []

    left_len = distance(lh, la)
    right_len = distance(rh, ra)
    diff = abs(left_len - right_len)
    score = max(0.0, 1.0 - diff / max(left_len, right_len, 1.0))

    kind, grade, summary = "symmetric", "normal", "하체 좌우 대칭이 양호합니다."
    if score < 0.85:
        grade = "moderate"
        if left_len > right_len:
            kind, summary = "left_long", "좌측 하체(다리)가 상대적으로 깁니다."
        else:
            kind, summary = "right_long", "우측 하체(다리)가 상대적으로 깁니다."
    elif score < 0.95:
        grade = "mild"
        if left_len > right_len:
            kind, summary = "left_long_mild", "좌측 하체(다리)가 약간 깁니다."
        else:
            kind, summary = "right_long_mild", "우측 하체(다리)가 약간 깁니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(score, 3),
        "unit": "score",
        "type": kind,
        "grade": grade,
        "confidence": 0.86,
        "summary": summary,
    }, [
        make_line("hip_ref", lh, rh),
        make_line("ankle_ref", la, ra),
    ]


def analyze_waist_shape(landmarks):
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    if not all([ls, rs, lh, rh]):
        return make_disabled_result("front", "허리/상체 비율 분석을 위한 점이 부족합니다."), []

    shoulder_w = distance(ls, rs)
    pelvic_w = distance(lh, rh)
    ratio = shoulder_w / (pelvic_w + 1e-5)

    kind, summary = "balanced", "상하체 너비 비율이 대체로 균형적입니다."
    if ratio > 1.35:
        kind, summary = "inverted_triangle", "어깨가 골반에 비해 넓은 체형입니다."
    elif ratio < 0.9:
        kind, summary = "triangle", "골반이 어깨에 비해 넓은 체형입니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(ratio, 2),
        "unit": "ratio",
        "type": kind,
        "grade": "normal",
        "confidence": 0.75,
        "summary": summary,
    }, [
        make_line("shoulder_w", ls, rs),
        make_line("pelvic_w", lh, rh),
    ]


def analyze_calf_shape(landmarks):
    lk = point_by_name(landmarks, "left_knee")
    rk = point_by_name(landmarks, "right_knee")
    la = point_by_name(landmarks, "left_ankle")
    ra = point_by_name(landmarks, "right_ankle")
    if not all([lk, rk, la, ra]):
        return make_disabled_result("front", "종아리 길이 분석을 위한 점이 부족합니다."), []

    left_calf = distance(lk, la)
    right_calf = distance(rk, ra)
    diff = abs(left_calf - right_calf)
    ratio = max(0.0, 1.0 - diff / max(left_calf, right_calf, 1.0))

    kind, summary = "symmetric", "양측 종아리 길이가 균형적입니다."
    if ratio < 0.90:
        kind, summary = "asymmetric", "양측 종아리 길이에 유의미한 비대칭이 있습니다."

    return {
        "enabled": True,
        "view": "front",
        "value": round_or_none(ratio, 2),
        "unit": "score",
        "type": kind,
        "grade": safe_grade(1 - ratio, 0.05, 0.1),
        "confidence": 0.8,
        "summary": summary,
    }, [
        make_line("l_calf", lk, la),
        make_line("r_calf", rk, ra),
    ]


def choose_visible_side_points(landmarks):
    keys = ["ear", "shoulder", "hip", "knee", "ankle", "foot_index"]
    out = {}
    for key in keys:
        left = point_by_name(landmarks, f"left_{key}")
        right = point_by_name(landmarks, f"right_{key}")
        lv = float(left.get("visibility", 0.0)) if left else 0.0
        rv = float(right.get("visibility", 0.0)) if right else 0.0
        out[key] = left if lv >= rv else right
    out["nose"] = point_by_name(landmarks, "nose")
    return out


def analyze_forward_head(pts, side_view):
    ear = pts.get("ear")
    shoulder = pts.get("shoulder")
    if not ear or not shoulder:
        return make_disabled_result("side", "귀와 어깨 점이 필요합니다."), []

    offset = float(ear["x"]) - float(shoulder["x"])
    offset_abs = abs(offset)
    signed = offset if side_view == "left_side" else -offset

    kind, summary = "neutral", "머리-목 정렬이 대체로 중립입니다."
    if signed > 35:
        kind, summary = "forward_head", "전방두부(거북목) 경향이 심해 주의가 필요합니다."
    elif signed > 18:
        kind, summary = "forward_head", "전방두부(거북목) 경향이 관찰됩니다."
    elif signed < -18:
        kind, summary = "posterior_head", "머리 위치가 후방으로 치우쳐 있습니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(offset_abs, 2),
        "unit": "px",
        "type": kind,
        "grade": safe_grade(offset_abs, 18.0, 35.0),
        "confidence": 0.86,
        "summary": summary,
    }, [
        make_line(
            "head_forward_ref",
            {"x": shoulder["x"], "y": ear["y"]},
            {"x": ear["x"], "y": ear["y"]},
        )
    ]


def analyze_round_shoulder(pts, side_view):
    shoulder = pts.get("shoulder")
    hip = pts.get("hip")
    if not shoulder or not hip:
        return make_disabled_result("side", "어깨와 골반 점이 필요합니다."), []

    trunk_deg = vertical_deviation_deg(hip, shoulder)
    trunk_abs = abs(trunk_deg)

    kind, summary = "neutral", "상체 정렬이 대체로 중립입니다."
    if trunk_abs > 12.0:
        kind, summary = "round_shoulder_tendency", "상체 전방 말림(라운드 숄더) 경향이 심해 교정이 필요합니다."
    elif trunk_abs > 6.0:
        kind, summary = "round_shoulder_tendency", "상체 전방 말림(라운드 숄더) 경향이 관찰됩니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(trunk_abs, 2),
        "unit": "deg",
        "type": kind,
        "grade": safe_grade(trunk_abs, 6.0, 12.0),
        "confidence": 0.80,
        "summary": summary,
    }, [
        make_line("trunk_axis", hip, shoulder),
    ]


def analyze_pelvic_tilt_side(pts, side_view):
    hip = pts.get("hip")
    knee = pts.get("knee")
    if not hip or not knee:
        return make_disabled_result("side", "골반과 무릎 점이 필요합니다."), []

    dx = float(knee["x"]) - float(hip["x"])
    dx_abs = abs(dx)
    signed = dx if side_view == "left_side" else -dx

    kind, summary = "neutral", "골반-하지 정렬이 대체로 중립입니다."
    if signed > 40:
        kind, summary = "anterior_pelvic_tilt_tendency", "골반 전방경사 경향이 심해 주의가 필요합니다."
    elif signed > 20:
        kind, summary = "anterior_pelvic_tilt_tendency", "골반 전방경사 경향이 관찰됩니다."
    elif signed < -20:
        kind, summary = "posterior_pelvic_tilt_tendency", "골반 후방경사 경향이 관찰됩니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(dx_abs, 2),
        "unit": "px",
        "type": kind,
        "grade": safe_grade(dx_abs, 20.0, 40.0),
        "confidence": 0.76,
        "summary": summary,
    }, [
        make_line(
            "pelvic_tilt_ref",
            {"x": hip["x"], "y": hip["y"]},
            {"x": knee["x"], "y": hip["y"]},
        )
    ]


def analyze_lumbar_curve_side(pts, side_view):
    shoulder = pts.get("shoulder")
    hip = pts.get("hip")
    ankle = pts.get("ankle")
    if not shoulder or not hip or not ankle:
        return make_disabled_result("side", "어깨-골반-발목 점이 필요합니다."), []

    upper = float(shoulder["x"]) - float(hip["x"])
    lower = float(hip["x"]) - float(ankle["x"])
    curve_score = abs(upper - lower)

    kind, summary = "neutral", "요추 정렬이 대체로 중립입니다."
    if curve_score > 35:
        kind, summary = "hyperlordosis_tendency", "요추 전만 증가 경향이 심해 관리가 필요합니다."
    elif curve_score > 18:
        kind, summary = "mild_lordosis_change", "요추 곡도 변화가 약간 관찰됩니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(curve_score, 2),
        "unit": "score",
        "type": kind,
        "grade": safe_grade(curve_score, 18.0, 35.0),
        "confidence": 0.72,
        "summary": summary,
    }, [
        make_line("upper_trunk_ref", hip, shoulder),
        make_line("lower_trunk_ref", hip, ankle),
    ]


def analyze_cervical_alignment_side(pts, side_view):
    nose = pts.get("nose")
    ear = pts.get("ear")
    shoulder = pts.get("shoulder")
    if not nose or not ear or not shoulder:
        return make_disabled_result("side", "코-귀-어깨 점이 필요합니다."), []

    neck_deg = abs(line_angle_deg(shoulder, ear))
    head_deg = abs(line_angle_deg(ear, nose))
    value = abs(head_deg - neck_deg)

    kind, summary = "neutral", "경추-두부 연계 정렬이 대체로 안정적입니다."
    if value > 18:
        kind, summary = "cervical_misalignment", "경추 정렬 불균형이 심해 주의가 필요합니다."
    elif value > 10:
        kind, summary = "cervical_misalignment", "경추 정렬 불균형 경향이 관찰됩니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(value, 2),
        "unit": "deg",
        "type": kind,
        "grade": safe_grade(value, 10.0, 18.0),
        "confidence": 0.78,
        "summary": summary,
    }, [
        make_line("neck_axis", shoulder, ear),
        make_line("head_axis", ear, nose),
    ]


def analyze_thoracic_back_shape(pts, side_view):
    ear = pts.get("ear")
    shoulder = pts.get("shoulder")
    hip = pts.get("hip")
    if not ear or not shoulder or not hip:
        return make_disabled_result("side", "귀-어깨-골반 점이 필요합니다."), []

    upper_deg = abs(line_angle_deg(shoulder, ear))
    trunk_deg = abs(line_angle_deg(hip, shoulder))
    score = abs(upper_deg - trunk_deg)

    kind, summary = "neutral", "등 정렬이 대체로 중립입니다."
    if score > 22:
        kind, summary = "thoracic_kyphosis_tendency", "등 말림(흉추 후만) 경향이 심해 주의가 필요합니다."
    elif score > 12:
        kind, summary = "thoracic_kyphosis_tendency", "등 말림/흉추 후만 경향이 관찰됩니다."

    return {
        "enabled": True,
        "view": "side",
        "value": round_or_none(score, 2),
        "unit": "deg",
        "type": kind,
        "grade": safe_grade(score, 12.0, 22.0),
        "confidence": 0.75,
        "summary": summary,
    }, [
        make_line("thoracic_upper", shoulder, ear),
        make_line("thoracic_lower", hip, shoulder),
    ]


def build_front_analysis(landmarks):
    analysis = {}
    guides = {"all": []}

    for key, func in [
        ("head_tilt", analyze_head_tilt),
        ("shoulder_slope", analyze_shoulder_slope),
        ("shoulder_balance", analyze_shoulder_balance),
        ("pelvic_balance", analyze_pelvic_balance),
        ("body_center", analyze_body_center),
        ("knee_shape", analyze_knee_shape),
        ("xo_leg", analyze_xo_leg),
        ("lower_body_symmetry", analyze_lower_body_symmetry),
        ("waist_shape", analyze_waist_shape),
        ("calf_shape", analyze_calf_shape),
    ]:
        analysis[key], guides[key] = func(landmarks)

    for key, msg in {
        "pelvic_shape": "측면 촬영이 필요합니다.",
        "back_shape": "측면 촬영이 필요합니다.",
        "head_neck_shape": "측면 촬영이 필요합니다.",
        "cervical_alignment": "측면 촬영이 필요합니다.",
        "shoulder_back_shape": "측면 촬영이 필요합니다.",
        "lumbar_curve": "측면 촬영이 필요합니다.",
    }.items():
        analysis[key] = make_disabled_result("side", msg)
        guides[key] = []

    for key in DISPLAY_KEYS:
        analysis.setdefault(key, make_disabled_result("front", "아직 계산되지 않았습니다."))
        guides.setdefault(key, [])

    return analysis, guides


def analyze_side_bundle(landmarks, side_view):
    pts = choose_visible_side_points(landmarks)
    analysis = {}
    guides = {"all": []}

    side_funcs = {
        "head_neck_shape": analyze_forward_head,
        "shoulder_back_shape": analyze_round_shoulder,
        "pelvic_shape": analyze_pelvic_tilt_side,
        "lumbar_curve": analyze_lumbar_curve_side,
        "cervical_alignment": analyze_cervical_alignment_side,
        "back_shape": analyze_thoracic_back_shape,
    }

    for key, func in side_funcs.items():
        analysis[key], guides[key] = func(pts, side_view)

    for key, msg in {
        "xo_leg": "정면 촬영이 필요합니다.",
        "pelvic_balance": "정면 촬영이 필요합니다.",
        "head_tilt": "정면 촬영이 필요합니다.",
        "body_center": "정면 촬영이 필요합니다.",
        "knee_shape": "정면 촬영이 필요합니다.",
        "shoulder_slope": "정면 촬영이 필요합니다.",
        "shoulder_balance": "정면 촬영이 필요합니다.",
        "calf_shape": "정면 촬영이 필요합니다.",
        "lower_body_symmetry": "정면 촬영이 필요합니다.",
        "waist_shape": "정면 촬영이 필요합니다.",
    }.items():
        analysis[key] = make_disabled_result("front", msg)
        guides[key] = []

    for key in DISPLAY_KEYS:
        analysis.setdefault(key, make_disabled_result("unknown", "아직 계산되지 않았습니다."))
        guides.setdefault(key, [])

    return analysis, guides


def build_analysis_by_view(landmarks):
    view_info = detect_view_type(landmarks)

    if view_info["view"] == "front":
        analysis, guides = build_front_analysis(landmarks)
    elif view_info["view"] in ("left_side", "right_side"):
        analysis, guides = analyze_side_bundle(landmarks, view_info["view"])
    else:
        analysis = {}
        guides = {"all": []}
        for key in DISPLAY_KEYS:
            analysis[key] = make_disabled_result("unknown", "자세 방향을 판별할 수 없습니다.")
            guides[key] = []

    return analysis, guides, view_info