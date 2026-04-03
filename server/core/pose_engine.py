from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2

from core.storage_manager import APP_DATA_DIR
from utils.math_utils import clamp


MEDIAPIPE_AVAILABLE = False
MEDIAPIPE_ERROR = None
mp = None
mp_python = None
mp_vision = None
POSE_LANDMARKER = None
POSE_TASK_PATH = None

try:
    import mediapipe as mp  # type: ignore
    from mediapipe.tasks import python as mp_python  # type: ignore
    from mediapipe.tasks.python import vision as mp_vision  # type: ignore
    MEDIAPIPE_AVAILABLE = True
except Exception as e:
    MEDIAPIPE_ERROR = f"mediapipe import failed: {e}"

POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28]
]

LANDMARK_NAMES = {
    0: "nose",
    7: "left_ear",
    8: "right_ear",
    11: "left_shoulder",
    12: "right_shoulder",
    13: "left_elbow",
    14: "right_elbow",
    15: "left_wrist",
    16: "right_wrist",
    23: "left_hip",
    24: "right_hip",
    25: "left_knee",
    26: "right_knee",
    27: "left_ankle",
    28: "right_ankle",
    31: "left_foot_index",
    32: "right_foot_index",
}

def get_runtime_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent

        internal_dir = exe_dir / "_internal"
        if internal_dir.exists():
            return internal_dir

        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(meipass)

        return exe_dir

    return Path(__file__).resolve().parents[2]


def find_pose_task_file():
    base_dir = get_runtime_base_dir()
    candidates = [
        base_dir / "pose_landmarker_lite.task",
        Path.cwd() / "pose_landmarker_lite.task",
        APP_DATA_DIR / "pose_landmarker_lite.task",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None

def init_pose_landmarker() -> bool:
    global POSE_LANDMARKER, POSE_TASK_PATH, MEDIAPIPE_ERROR
    if not MEDIAPIPE_AVAILABLE:
        return False
    if POSE_LANDMARKER is not None:
        return True

    POSE_TASK_PATH = find_pose_task_file()
    if not POSE_TASK_PATH:
        MEDIAPIPE_ERROR = "pose_landmarker_lite.task not found"
        return False

    try:
        base_options = mp_python.BaseOptions(model_asset_path=POSE_TASK_PATH)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.35,
            min_pose_presence_confidence=0.35,
            min_tracking_confidence=0.35,
        )
        POSE_LANDMARKER = mp_vision.PoseLandmarker.create_from_options(options)
        return True
    except Exception as e:
        MEDIAPIPE_ERROR = f"PoseLandmarker init failed: {e}"
        POSE_LANDMARKER = None
        return False


def run_pose_landmarker_bgr(image_bgr):
    if not MEDIAPIPE_AVAILABLE:
        return None
    init_pose_landmarker()
    if POSE_LANDMARKER is None:
        return None

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    return POSE_LANDMARKER.detect(mp_image)


def task_result_to_landmarks(result, width: int, height: int):
    if not result or not getattr(result, "pose_landmarks", None) or len(result.pose_landmarks) == 0:
        return []

    pose = result.pose_landmarks[0]
    out = []

    for idx, lm in enumerate(pose):
        if idx not in LANDMARK_NAMES:
            continue
        out.append({
            "name": LANDMARK_NAMES[idx],
            "index": idx,
            "x": float(clamp(lm.x * width, 0, width - 1)),
            "y": float(clamp(lm.y * height, 0, height - 1)),
            "z": float(lm.z),
            "visibility": float(getattr(lm, "visibility", 1.0)),
            "presence": float(getattr(lm, "presence", 1.0)),
        })
    return out


def extract_pose_landmarks(image_bgr):
    h, w = image_bgr.shape[:2]
    result = run_pose_landmarker_bgr(image_bgr)
    return result, task_result_to_landmarks(result, w, h)


def point_by_name(landmarks: List[Dict[str, Any]], name: str):
    for lm in landmarks:
        if lm["name"] == name:
            return lm
    return None


def detect_view_type(landmarks):
    ls = point_by_name(landmarks, "left_shoulder")
    rs = point_by_name(landmarks, "right_shoulder")
    lh = point_by_name(landmarks, "left_hip")
    rh = point_by_name(landmarks, "right_hip")
    nose = point_by_name(landmarks, "nose")
    le = point_by_name(landmarks, "left_ear")
    re = point_by_name(landmarks, "right_ear")

    if not all([ls, rs, lh, rh]):
        return {"view": "unknown", "confidence": 0.2, "reason": "required torso landmarks missing"}

    shoulder_dx = abs(float(ls["x"]) - float(rs["x"]))
    hip_dx = abs(float(lh["x"]) - float(rh["x"]))
    left_score = 0.0
    right_score = 0.0

    if le and re:
        lv = float(le.get("visibility", 0.0))
        rv = float(re.get("visibility", 0.0))
        if lv > rv + 0.15:
            left_score += 1.0
        elif rv > lv + 0.15:
            right_score += 1.0

    if nose and le and re:
        nose_x = float(nose["x"])
        le_x = float(le["x"])
        re_x = float(re["x"])
        if abs(nose_x - le_x) < abs(nose_x - re_x):
            left_score += 0.5
        else:
            right_score += 0.5

    if shoulder_dx >= 90 and hip_dx >= 70:
        return {
            "view": "front",
            "confidence": 0.92,
            "reason": f"front shoulder_dx={shoulder_dx:.1f}, hip_dx={hip_dx:.1f}",
        }

    if shoulder_dx <= 55 and hip_dx <= 45:
        side = "left_side" if left_score >= right_score else "right_side"
        return {
            "view": side,
            "confidence": 0.82,
            "reason": f"side shoulder_dx={shoulder_dx:.1f}, hip_dx={hip_dx:.1f}",
        }

    return {
        "view": "unknown",
        "confidence": 0.5,
        "reason": f"ambiguous shoulder_dx={shoulder_dx:.1f}, hip_dx={hip_dx:.1f}",
    }


def evaluate_pose_quality(landmarks):
    required = [
        "nose", "left_shoulder", "right_shoulder",
        "left_hip", "right_hip",
        "left_knee", "right_knee",
        "left_ankle", "right_ankle",
    ]
    found = {lm["name"] for lm in landmarks}
    missing = [name for name in required if name not in found]
    pose_ok = len(missing) == 0 and len(landmarks) > 0
    confidence = 0.95 if pose_ok else max(0.0, 1.0 - len(missing) * 0.1)
    return {
        "pose_ok": pose_ok,
        "missing_points": missing,
        "confidence": round(confidence, 2),
    }