from __future__ import annotations

from datetime import datetime
from pathlib import Path


CURRENT_SESSION_ID = None


def make_session_id():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def get_or_create_session_id(requested_view: str) -> str:
    global CURRENT_SESSION_ID
    if requested_view == "front" or not CURRENT_SESSION_ID:
        CURRENT_SESSION_ID = make_session_id()
    return CURRENT_SESSION_ID


def get_session_dir(base_dir: Path, module_name: str, session_id: str) -> Path:
    session_dir = base_dir / module_name / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir