from __future__ import annotations

from typing import Any, Dict
import cv2
import numpy as np


def draw_snapshot_overlay(image_bgr: np.ndarray, payload: Dict[str, Any]) -> np.ndarray:
    canvas = image_bgr.copy()
    pose = payload.get("pose", {})
    landmarks = pose.get("landmarks", []) or []
    connections = pose.get("connections", []) or []
    guides = payload.get("guides", {}) or {}

    lm_by_index = {
        int(lm.get("index")): lm
        for lm in landmarks
        if lm.get("index") is not None
    }

    for a, b in connections:
        p1 = lm_by_index.get(int(a))
        p2 = lm_by_index.get(int(b))
        if not p1 or not p2:
            continue
        v1 = float(p1.get("visibility", 1.0))
        v2 = float(p2.get("visibility", 1.0))
        if min(v1, v2) < 0.45:
            continue
        pt1 = (int(round(float(p1["x"]))), int(round(float(p1["y"]))))
        pt2 = (int(round(float(p2["x"]))), int(round(float(p2["y"]))))
        cv2.line(canvas, pt1, pt2, (0, 255, 120), 3, cv2.LINE_AA)

    for lm in landmarks:
        if float(lm.get("visibility", 1.0)) < 0.45:
            continue
        pt = (int(round(float(lm["x"]))), int(round(float(lm["y"]))))
        cv2.circle(canvas, pt, 8, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.circle(canvas, pt, 5, (70, 70, 255), -1, cv2.LINE_AA)

    guide_items = []
    guide_items.extend(guides.get("all", []) or [])
    analysis = payload.get("analysis", {}) or {}
    for key, item in analysis.items():
        if isinstance(item, dict) and item.get("enabled"):
            guide_items.extend(guides.get(key, []) or [])

    for guide in guide_items:
        shape = guide.get("shape")
        if shape == "line" and guide.get("p1") and guide.get("p2"):
            p1 = guide["p1"]
            p2 = guide["p2"]
            pt1 = (int(round(float(p1["x"]))), int(round(float(p1["y"]))))
            pt2 = (int(round(float(p2["x"]))), int(round(float(p2["y"]))))
            cv2.line(canvas, pt1, pt2, (40, 40, 255), 2, cv2.LINE_AA)
        elif shape == "point" and guide.get("p"):
            p = guide["p"]
            pt = (int(round(float(p["x"]))), int(round(float(p["y"]))))
            cv2.circle(canvas, pt, 7, (40, 40, 255), -1, cv2.LINE_AA)

    return canvas