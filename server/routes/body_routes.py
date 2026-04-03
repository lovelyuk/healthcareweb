from __future__ import annotations

import logging
import threading
from typing import Any

from fastapi import APIRouter, Body, Query

# REALSENSE_DEPENDENCY: get_latest_frame_snapshot() → RealSense color+depth frame 반환
# - 웹캡 전환 시 color만 반환, depth는 None으로 변경 필요
from core.camera_manager import get_latest_frame_snapshot
from core.pose_engine import evaluate_pose_quality, extract_pose_landmarks
from core.storage_manager import APP_DATA_DIR, save_capture_artifacts
from core.supabase_service import create_session, ensure_subject, save_result, upload_file
from modules.bodycheck_analyzer import (
    analyze_side_bundle,
    build_analysis_by_view,
    build_front_analysis,
)
from modules.anthropometry_estimator import estimate_anthropometry_from_frame
from modules.smpl_model_builder import build_star_viewer_model
from schemas.body_schema import build_body_response, build_empty_body_response


LOG_DIR = APP_DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "body_routes.log"

logger = logging.getLogger("body_routes")
if not logger.handlers:
    logger.setLevel(logging.INFO)

    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    try:
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        logger.warning("file logging disabled: %s", e)

logger.info("body_routes module loaded from %s", __file__)

router = APIRouter(prefix="/api/body", tags=["body"])

ANALYSIS_LOCK = threading.Lock()
LATEST_ANALYSIS_PAYLOAD: dict[str, Any] | None = None
LATEST_VIEW_TYPE = "unknown"
LAST_ANALYZE_ERROR: str | None = None
AI_SUMMARY_FALLBACK = "요약 생성에 실패했습니다. 기존 BodyCheck 분석 결과를 확인해 주세요."


def _payload_ok(payload: dict[str, Any]) -> bool:
    quality = payload.get("quality") or {}
    pose = payload.get("pose") or {}
    return bool(quality.get("capture_ok")) and bool(pose.get("detected"))


def _view_to_storage_name(requested_view: str, detected_view: str) -> str:
    if requested_view == "front":
        return "front"
    if requested_view == "side":
        if detected_view in ("left_side", "right_side"):
            return detected_view
        return "right_side"
    if detected_view in ("front", "left_side", "right_side"):
        return detected_view
    return requested_view or "unknown"


def _merge_body_analysis(front_payload: dict[str, Any], side_payload: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    merged.update(front_payload.get("analysis") or {})
    merged.update(side_payload.get("analysis") or {})
    return merged


def _build_combined_payload(front_payload: dict[str, Any], side_payload: dict[str, Any]) -> dict[str, Any]:
    merged_analysis = _merge_body_analysis(front_payload, side_payload)

    # The 3D viewer model is optional. Missing STAR assets should not break save flow.
    gender = "male"
    body_model = None
    body_model_error = None
    try:
        body_model = build_star_viewer_model(merged_analysis, gender=gender)
    except Exception as e:
        body_model_error = str(e)
        logger.warning("body model build skipped: %s", e)

    payload = {
        "module": "body",
        "mode": "workflow_complete",
        "requested_view": "front+side",
        "front": front_payload,
        "side": side_payload,
        "analysis": merged_analysis,
        "body_model": body_model,
        "summary": {
            "front_view": (front_payload.get("view_detection") or {}).get("view", "unknown"),
            "side_view": (side_payload.get("view_detection") or {}).get("view", "unknown"),
            "front_capture_ok": (front_payload.get("quality") or {}).get("capture_ok", False),
            "side_capture_ok": (side_payload.get("quality") or {}).get("capture_ok", False),
        },
    }

    if body_model_error:
        payload["body_model_error"] = body_model_error

    return payload


def _defer_ai_summary(payload: dict[str, Any]) -> dict[str, Any]:
    payload["ai_summary"] = None
    return payload


# REALSENSE_DEPENDENCY: depth_image 사용 (build_body_response에 has_depth 전달)
# - 웹캡 전환 시 depth_image=None → has_depth=False로 응답
def build_response_from_image(color_image, depth_image, requested_view: str = "auto") -> dict[str, Any]:
    _, landmarks = extract_pose_landmarks(color_image)
    pose_quality = evaluate_pose_quality(landmarks)
    analysis, guides, view_info = build_analysis_by_view(landmarks)

    if requested_view == "front" and landmarks:
        analysis, guides = build_front_analysis(landmarks)
        view_info = {
            "view": "front",
            "confidence": float(view_info.get("confidence", 0.8)),
            "reason": "forced by request",
        }
    elif requested_view == "side" and landmarks:
        side_view = view_info["view"] if view_info["view"] in ("left_side", "right_side") else "right_side"
        analysis, guides = analyze_side_bundle(landmarks, side_view)
        view_info = {
            "view": side_view,
            "confidence": float(view_info.get("confidence", 0.8)),
            "reason": "forced by request",
        }

    payload = build_body_response(
        color_image=color_image,
        depth_image=depth_image,
        landmarks=landmarks,
        pose_quality=pose_quality,
        analysis=analysis,
        guides=guides,
        view_info=view_info,
        requested_view=requested_view,
    )

    # REALSENSE_DEPENDENCY: depth_image 사용 → 웹캡 전환 시 None fallback 필요
    anthropometry = estimate_anthropometry_from_frame(
        landmarks=landmarks,
        depth_image=depth_image,  # REALSENSE_DEPENDENCY: RealSense depth 기반 측정
        frame_width=color_image.shape[1],
        frame_height=color_image.shape[0],
        view=view_info.get("view", requested_view),
    )
    if anthropometry:
        payload["analysis"].update(anthropometry)
        payload["anthropometry"] = anthropometry

    if requested_view in ("front", "side"):
        detected_view = (payload.get("view_detection") or {}).get("view", "unknown")
        storage_view = _view_to_storage_name(requested_view, detected_view)

        payload["captures"] = save_capture_artifacts(
            color_image=color_image,
            payload=payload,
            requested_view=storage_view,
            module_name="bodycheck",
        )
        payload["captures"]["requested_view"] = requested_view
        payload["captures"]["detected_view"] = detected_view
        payload["captures"]["storage_view"] = storage_view

    return payload


def refresh_latest_analysis(requested_view: str = "auto") -> dict[str, Any]:
    global LATEST_ANALYSIS_PAYLOAD, LATEST_VIEW_TYPE, LAST_ANALYZE_ERROR

    # REALSENSE_DEPENDENCY: get_latest_frame_snapshot() → (color, depth) 반환
    # - 웹캡 전환 시 depth_image는 None이 될 수 있음
    color_image, depth_image = get_latest_frame_snapshot()
    if color_image is None:
        payload = build_empty_body_response("frame not ready")
        with ANALYSIS_LOCK:
            LATEST_ANALYSIS_PAYLOAD = payload
            LATEST_VIEW_TYPE = "unknown"
            LAST_ANALYZE_ERROR = None
        return payload

    try:
        payload = build_response_from_image(color_image, depth_image, requested_view=requested_view)
        with ANALYSIS_LOCK:
            LATEST_ANALYSIS_PAYLOAD = payload
            LATEST_VIEW_TYPE = payload.get("view_detection", {}).get("view", "unknown")
            LAST_ANALYZE_ERROR = None
        return payload
    except Exception as e:
        logger.exception("body analysis failed")
        with ANALYSIS_LOCK:
            LAST_ANALYZE_ERROR = str(e)
        return build_empty_body_response(str(e))


@router.get("/live")
def get_live_body(view: str = Query("auto")):
    logger.info("GET /api/body/live called view=%s", view)
    return refresh_latest_analysis(view)


@router.get("/latest")
def get_latest_body():
    logger.info("GET /api/body/latest called")
    with ANALYSIS_LOCK:
        if LATEST_ANALYSIS_PAYLOAD is not None:
            return LATEST_ANALYSIS_PAYLOAD
    return build_empty_body_response("latest payload not available")


@router.post("/analyze")
def analyze_body(view: str = Query("auto")):
    """
    정면/측면 단일 분석.
    - front / side 요청 시 로컬 artifact 생성
    - Supabase 저장은 하지 않음
    - 최종 저장은 /complete 에서 1세션으로 처리
    """
    logger.info("POST /api/body/analyze called view=%s", view)

    payload = refresh_latest_analysis(view)
    payload["cloud"] = {
        "ok": False,
        "saved": False,
        "reason": "not_saved_yet",
        "message": "body workflow complete 후 /api/body/complete 에서 1세션으로 저장됩니다.",
    }
    return _defer_ai_summary(payload)


@router.post("/viewer-model")
def build_viewer_model(payload: dict[str, Any] = Body(...)):
    logger.info("POST /api/body/viewer-model called")
    analysis = payload.get("analysis") or {}
    gender = str(payload.get("gender") or "male").lower()

    model = build_star_viewer_model(analysis, gender=gender)
    if not model:
        return {
            "ok": False,
            "error": "Required anthropometry metrics are missing",
            "required": [
                "height",
                "shoulder_width",
                "pelvis_width",
                "arm_length",
                "leg_length",
                "torso_length",
                "torso_depth",
            ],
        }

    return model


@router.post("/complete")
def complete_body_workflow(request: dict[str, Any] = Body(...)):
    """
    front + side 결과를 받아서
    subjects 1개 / sessions 1개 / results 1개 로 저장한다.
    """
    logger.info("POST /api/body/complete called")

    subject_no = (request.get("subject_no") or "").strip()
    name = request.get("name")
    gender = request.get("gender")
    birth_date = request.get("birth_date")
    notes = request.get("notes")

    front_payload = request.get("front_payload")
    side_payload = request.get("side_payload")

    if not subject_no:
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "subject_no is required"},
        }

    if not isinstance(front_payload, dict) or not isinstance(side_payload, dict):
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "front_payload and side_payload are required"},
        }

    if not _payload_ok(front_payload):
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "front_payload is not valid"},
        }

    if not _payload_ok(side_payload):
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "side_payload is not valid"},
        }

    front_captures = front_payload.get("captures") or {}
    side_captures = side_payload.get("captures") or {}
    required_capture_keys = ["raw_path", "overlay_path", "analysis_path"]

    if not all(k in front_captures for k in required_capture_keys):
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "front captures missing"},
        }

    if not all(k in side_captures for k in required_capture_keys):
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": "side captures missing"},
        }

    combined_payload = _build_combined_payload(front_payload, side_payload)

    try:
        subject = ensure_subject(
            subject_no=subject_no,
            name=name,
            gender=gender,
            birth_date=birth_date,
        )
        logger.info("subject ensured id=%s", subject["id"])

        local_session_id = front_captures.get("session_id") or side_captures.get("session_id")

        session = create_session(
            subject_id=subject["id"],
            local_session_id=local_session_id,
            session_type="body",
            notes=notes,
        )
        logger.info("body session created id=%s", session["id"])

        session_id = session["id"]

        front_raw_url = upload_file(front_captures["raw_path"], f"bodycheck/{session_id}/front_raw.jpg")
        front_overlay_url = upload_file(front_captures["overlay_path"], f"bodycheck/{session_id}/front_overlay.jpg")
        front_analysis_url = upload_file(front_captures["analysis_path"], f"bodycheck/{session_id}/front_analysis.json")

        side_raw_url = upload_file(side_captures["raw_path"], f"bodycheck/{session_id}/side_raw.jpg")
        side_overlay_url = upload_file(side_captures["overlay_path"], f"bodycheck/{session_id}/side_overlay.jpg")
        side_analysis_url = upload_file(side_captures["analysis_path"], f"bodycheck/{session_id}/side_analysis.json")

        db_row = save_result(
            session_id=session_id,
            module_name="body",
            test_type="front_side_workflow",
            result_payload=combined_payload.get("analysis", {}),
            analysis_payload=combined_payload,
            artifacts={
                "front": {
                    "raw_public_url": front_raw_url,
                    "overlay_public_url": front_overlay_url,
                    "analysis_public_url": front_analysis_url,
                    "requested_view": front_captures.get("requested_view", "front"),
                    "detected_view": front_captures.get("detected_view", "front"),
                    "local_paths": {
                        "raw_path": front_captures["raw_path"],
                        "overlay_path": front_captures["overlay_path"],
                        "analysis_path": front_captures["analysis_path"],
                    },
                },
                "side": {
                    "raw_public_url": side_raw_url,
                    "overlay_public_url": side_overlay_url,
                    "analysis_public_url": side_analysis_url,
                    "requested_view": side_captures.get("requested_view", "side"),
                    "detected_view": side_captures.get("detected_view", "right_side"),
                    "local_paths": {
                        "raw_path": side_captures["raw_path"],
                        "overlay_path": side_captures["overlay_path"],
                        "analysis_path": side_captures["analysis_path"],
                    },
                },
            },
        )
        logger.info("body result saved id=%s", db_row["id"])

        cloud = {
            "ok": True,
            "subject_id": subject["id"],
            "session_id": session_id,
            "result_id": db_row["id"],
            "front_raw_public_url": front_raw_url,
            "front_overlay_public_url": front_overlay_url,
            "front_analysis_public_url": front_analysis_url,
            "side_raw_public_url": side_raw_url,
            "side_overlay_public_url": side_overlay_url,
            "side_analysis_public_url": side_analysis_url,
        }

        combined_payload["cloud"] = cloud
        combined_payload["ok"] = True
        return combined_payload

    except Exception as e:
        logger.exception("body complete save failed")
        return {
            "ok": False,
            "cloud": {"ok": False, "reason": str(e)},
        }
