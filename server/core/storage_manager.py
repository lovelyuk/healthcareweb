from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict

import cv2

from core.overlay_renderer import draw_snapshot_overlay
from core.session_manager import get_or_create_session_id, get_session_dir
from utils.common_utils import to_jsonable


def get_app_data_dir() -> Path:
    local_appdata = os.environ.get("LOCALAPPDATA")
    return Path(local_appdata) / "BodyCheckAgent" if local_appdata else Path.home() / ".bodycheckagent"


APP_DATA_DIR = get_app_data_dir()
DATA_DIR = APP_DATA_DIR / "data"
FRAMES_DIR = APP_DATA_DIR / "frames"
SESSIONS_DIR = APP_DATA_DIR / "sessions"

for d in [DATA_DIR, FRAMES_DIR, SESSIONS_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def save_capture_artifacts(
    color_image,
    payload: Dict[str, Any],
    requested_view: str,
    module_name: str = "bodycheck",
) -> Dict[str, Any]:
    session_id = get_or_create_session_id(requested_view)
    session_dir = get_session_dir(SESSIONS_DIR, module_name, session_id)

    raw_name = f"{requested_view}_raw.jpg"
    overlay_name = f"{requested_view}_overlay.jpg"
    json_name = f"{requested_view}_analysis.json"

    raw_path = session_dir / raw_name
    overlay_path = session_dir / overlay_name
    json_path = session_dir / json_name

    overlay_image = draw_snapshot_overlay(color_image, payload)

    cv2.imwrite(str(raw_path), color_image)
    cv2.imwrite(str(overlay_path), overlay_image)

    # Save module-specific latest frames
    latest_raw = FRAMES_DIR / f"latest_{module_name}_{requested_view}_raw.jpg"
    latest_overlay = FRAMES_DIR / f"latest_{module_name}_{requested_view}_overlay.jpg"
    cv2.imwrite(str(latest_raw), color_image)
    cv2.imwrite(str(latest_overlay), overlay_image)

    # Legacy support / Default latest (primarily for bodycheck/anthropometry)
    # Only update generic "latest" if module is bodycheck to avoid conflicts
    if module_name == "bodycheck":
        default_raw = FRAMES_DIR / f"latest_{requested_view}_raw.jpg"
        default_overlay = FRAMES_DIR / f"latest_{requested_view}_overlay.jpg"
        cv2.imwrite(str(default_raw), color_image)
        cv2.imwrite(str(default_overlay), overlay_image)

        # Alias for side views (legacy)
        if requested_view in ("left_side", "right_side", "side"):
            alias_raw = FRAMES_DIR / "latest_side_raw.jpg"
            alias_overlay = FRAMES_DIR / "latest_side_overlay.jpg"
            cv2.imwrite(str(alias_raw), color_image)
            cv2.imwrite(str(alias_overlay), overlay_image)
        
        # Module-specific side alias
        alias_mod_raw = FRAMES_DIR / f"latest_{module_name}_side_raw.jpg"
        alias_mod_overlay = FRAMES_DIR / f"latest_{module_name}_side_overlay.jpg"
        cv2.imwrite(str(alias_mod_raw), color_image)
        cv2.imwrite(str(alias_mod_overlay), overlay_image)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(to_jsonable(payload), f, ensure_ascii=False, indent=2)

    return {
        "session_id": session_id,
        "module_name": module_name,
        "requested_view": requested_view,
        "raw_path": str(raw_path),
        "overlay_path": str(overlay_path),
        "raw_url": f"/frames/sessions/{module_name}/{session_id}/{raw_name}",
        "overlay_url": f"/frames/sessions/{module_name}/{session_id}/{overlay_name}",
        "latest_raw_url": f"/frames/latest_{requested_view}_raw.jpg",
        "latest_overlay_url": f"/frames/latest_{requested_view}_overlay.jpg",
        "analysis_json_url": f"/frames/sessions/{module_name}/{session_id}/{json_name}",
        "analysis_path": str(json_path),
    }