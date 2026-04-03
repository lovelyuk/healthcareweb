from __future__ import annotations

from datetime import datetime
from typing import Any
import numpy as np


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def safe_grade(abs_value: float, mild: float, moderate: float) -> str:
    if abs_value < mild:
        return "normal"
    if abs_value < moderate:
        return "mild"
    return "moderate"


def to_jsonable(value: Any) -> Any:
    import math
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [to_jsonable(v) for v in value]
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        val = value.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    return value


def make_disabled_result(view: str, message: str):
    return {
        "enabled": False,
        "view": view,
        "value": None,
        "unit": None,
        "type": "unknown",
        "grade": "unknown",
        "confidence": 0.0,
        "summary": message,
    }


def make_line(name, p1, p2, style="dashed-red"):
    return {
        "name": name,
        "shape": "line",
        "style": style,
        "p1": {"x": round(float(p1["x"]), 2), "y": round(float(p1["y"]), 2)},
        "p2": {"x": round(float(p2["x"]), 2), "y": round(float(p2["y"]), 2)},
    }


def make_point(name, p, style="solid-red"):
    return {
        "name": name,
        "shape": "point",
        "style": style,
        "p": {"x": round(float(p["x"]), 2), "y": round(float(p["y"]), 2)},
    }