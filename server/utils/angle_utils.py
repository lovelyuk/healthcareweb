from __future__ import annotations

import math


def line_angle_deg(a, b):
    return math.degrees(
        math.atan2(
            float(b["y"]) - float(a["y"]),
            float(b["x"]) - float(a["x"]),
        )
    )


def vertical_deviation_deg(a, b):
    dx = float(b["x"]) - float(a["x"])
    dy = float(b["y"]) - float(a["y"])
    return math.degrees(math.atan2(dx, abs(dy) + 1e-6))