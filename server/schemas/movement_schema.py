from __future__ import annotations

from utils.common_utils import now_iso


def build_movement_response(*, session_id: str, test_type: str, result: dict, saved: dict | None = None) -> dict:
    return {
        "ok": True,
        "module": "movement",
        "session_id": session_id,
        "timestamp": now_iso(),
        "test_type": test_type,
        "result": result,
        "saved": saved or {},
    }