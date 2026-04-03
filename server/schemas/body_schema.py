from __future__ import annotations

from core.pose_engine import POSE_CONNECTIONS
from utils.common_utils import now_iso


def build_body_response(
    *,
    color_image,
    depth_image,
    landmarks: list,
    pose_quality: dict,
    analysis: dict,
    guides: dict,
    view_info: dict,
    requested_view: str = "auto",
) -> dict:
    height, width = color_image.shape[:2]

    return {
        "ok": True,
        "module": "body",
        "timestamp": now_iso(),
        "requested_view": requested_view,
        "frame": {
            "width": int(width),
            "height": int(height),
            "captured_at": now_iso(),
            "has_depth": depth_image is not None,
        },
        "pose": {
            "detected": len(landmarks) > 0,
            "landmarks": landmarks,
            "connections": POSE_CONNECTIONS,
        },
        "quality": {
            "capture_ok": True,
            "pose_ok": bool(pose_quality.get("pose_ok", False)),
            "body_in_frame": len(landmarks) > 0,
            "confidence": float(pose_quality.get("confidence", 0.0)),
            "missing_points": pose_quality.get("missing_points", []),
        },
        "view_detection": {
            "view": view_info.get("view", "unknown"),
            "confidence": float(view_info.get("confidence", 0.0)),
            "reason": view_info.get("reason", ""),
        },
        "analysis": analysis or {},
        "guides": guides or {"all": []},
        "debug": {
            "depth_used": depth_image is not None,
        },
    }


def build_empty_body_response(message: str = "frame not ready") -> dict:
    return {
        "ok": False,
        "module": "body",
        "timestamp": now_iso(),
        "requested_view": "auto",
        "frame": {
            "width": 640,
            "height": 480,
            "captured_at": now_iso(),
            "has_depth": False,
        },
        "pose": {
            "detected": False,
            "landmarks": [],
            "connections": POSE_CONNECTIONS,
        },
        "quality": {
            "capture_ok": False,
            "pose_ok": False,
            "body_in_frame": False,
            "confidence": 0.0,
            "missing_points": [],
            "message": message,
        },
        "view_detection": {
            "view": "unknown",
            "confidence": 0.0,
            "reason": message,
        },
        "analysis": {},
        "guides": {"all": []},
        "debug": {
            "depth_used": False,
        },
    }