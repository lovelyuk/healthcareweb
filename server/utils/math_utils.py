from __future__ import annotations

from typing import Optional
import math


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def round_or_none(v: Optional[float], digits: int = 2) -> Optional[float]:
    return None if v is None else round(float(v), digits)


def mid_point(a, b):
    return {
        "x": (float(a["x"]) + float(b["x"])) / 2.0,
        "y": (float(a["y"]) + float(b["y"])) / 2.0,
    }


def signed_horizontal_offset(a, b):
    return float(a["x"]) - float(b["x"])


def distance(a, b):
    return math.sqrt(
        (float(a["x"]) - float(b["x"])) ** 2 +
        (float(a["y"]) - float(b["y"])) ** 2
    )