from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Query

# REALSENSE_DEPENDENCY: get_latest_frame_snapshot() → RealSense color+depth frame
# - ROM은 2D landmark 기반 (depth 불필요) → 웹캡 전환 시 depth=None으로 동작 가능
from core.camera_manager import get_latest_frame_snapshot
from core.pose_engine import extract_pose_landmarks
from core.session_manager import get_or_create_session_id
from core.storage_manager import save_capture_artifacts
from core.supabase_service import (
    create_session,
    ensure_subject,
    save_result,
    upload_file,
)
from modules.rom_analyzer import analyze_rom_from_landmarks
from schemas.rom_schema import build_rom_response


from core.storage_manager import APP_DATA_DIR

LOG_DIR = APP_DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "rom_routes.log"

logger = logging.getLogger("rom_routes")

if not logger.handlers:
    logger.setLevel(logging.INFO)

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    console_handler = logging.StreamHandler()

    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)


logger.info("rom_routes module loaded from %s", __file__)

router = APIRouter(prefix="/api/rom", tags=["rom"])


@router.get("/live")
def get_live_rom(
    test_type: str = Query("shoulder_flexion"),
    side: str | None = Query("right"),
):
    logger.info("GET /api/rom/live called")

    color, depth = get_latest_frame_snapshot()
    if color is None:
        logger.warning("camera frame not available")
        return {"ok": False, "reason": "no camera frame"}

    _, landmarks = extract_pose_landmarks(color)
    result = analyze_rom_from_landmarks(landmarks, test_type=test_type, side=side)
    session_id = get_or_create_session_id("front")

    return build_rom_response(
        session_id=session_id,
        test_type=test_type,
        result={
            **result,
            "depth_used": depth is not None,
        },
        saved=None,
    )


@router.post("/analyze")
def analyze_rom(
    test_type: str = Query("shoulder_flexion"),
    side: str | None = Query("right"),
    subject_no: str = Query(..., description="피검자 고유번호"),
    name: str | None = Query(None),
    gender: str | None = Query(None),
    birth_date: str | None = Query(None),
    notes: str | None = Query(None),
):
    logger.info("POST /api/rom/analyze called")
    logger.info("subject_no=%s test_type=%s side=%s", subject_no, test_type, side)

    color, depth = get_latest_frame_snapshot()
    if color is None:
        logger.error("camera frame not available")
        return {"ok": False, "reason": "no camera frame"}

    _, landmarks = extract_pose_landmarks(color)

    result = analyze_rom_from_landmarks(
        landmarks,
        test_type=test_type,
        side=side,
    )

    local_session_id = get_or_create_session_id("front")

    payload = build_rom_response(
        session_id=local_session_id,
        test_type=test_type,
        result={
            **result,
            "depth_used": depth is not None,
        },
        saved=None,
    )

    logger.info("analysis completed")

    saved = save_capture_artifacts(
        color_image=color,
        payload=payload,
        requested_view="front",
        module_name="rom",
    )

    payload["saved"] = saved

    logger.info("artifacts saved locally")
    logger.info("saved=%s", saved)

    cloud = {
        "ok": False,
        "reason": None,
    }

    try:
        logger.info("creating subject")

        subject = ensure_subject(
            subject_no=subject_no,
            name=name,
            gender=gender,
            birth_date=birth_date,
        )

        logger.info("subject created id=%s", subject["id"])

        session = create_session(
            subject_id=subject["id"],
            local_session_id=local_session_id,
            session_type="rom",
            notes=notes,
        )

        logger.info("session created id=%s", session["id"])

        raw_url = upload_file(
            saved["raw_path"],
            f'rom/{session["id"]}/front_raw.jpg',
        )

        overlay_url = upload_file(
            saved["overlay_path"],
            f'rom/{session["id"]}/front_overlay.jpg',
        )

        analysis_url = upload_file(
            saved["analysis_path"],
            f'rom/{session["id"]}/front_analysis.json',
        )

        logger.info("files uploaded to supabase")

        db_row = save_result(
            session_id=session["id"],
            module_name="rom",
            test_type=test_type,
            result_payload=payload.get("result", {}),
            analysis_payload=payload,
            artifacts={
                "raw_public_url": raw_url,
                "overlay_public_url": overlay_url,
                "analysis_public_url": analysis_url,
                "requested_view": "front",
                "local_paths": {
                    "raw_path": saved["raw_path"],
                    "overlay_path": saved["overlay_path"],
                    "analysis_path": saved["analysis_path"],
                },
            },
        )

        logger.info("result saved id=%s", db_row["id"])

        cloud = {
            "ok": True,
            "subject_id": subject["id"],
            "session_id": session["id"],
            "result_id": db_row["id"],
            "raw_public_url": raw_url,
            "overlay_public_url": overlay_url,
            "analysis_public_url": analysis_url,
        }

    except Exception as e:
        logger.exception("Supabase save failed")
        cloud = {
            "ok": False,
            "reason": str(e),
        }

    payload["cloud"] = cloud
    logger.info("final payload keys=%s", list(payload.keys()))
    return payload