from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from core.storage_manager import APP_DATA_DIR
from core.supabase_client import get_supabase
from core.supabase_service import get_subject_by_subject_no, delete_result


LOG_DIR = APP_DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "history_routes.log"

logger = logging.getLogger("history_routes")
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

logger.info("history_routes module loaded from %s", __file__)

router = APIRouter(prefix="/api/history", tags=["history"])


def _fetch_results_for_subject(subject_id: str, limit: int = 50) -> list[dict[str, Any]]:
    supabase = get_supabase()

    sessions_resp = (
        supabase.table("sessions")
        .select("*")
        .eq("subject_id", subject_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    sessions = sessions_resp.data or []
    if not sessions:
        return []

    session_map = {s["id"]: s for s in sessions}
    session_ids = list(session_map.keys())

    results_resp = (
        supabase.table("results")
        .select("*")
        .in_("session_id", session_ids)
        .order("created_at", desc=True)
        .execute()
    )
    results = results_resp.data or []

    for row in results:
        row["session"] = session_map.get(row["session_id"])

    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return results


def _serialize_list_item(row: dict[str, Any], subject: dict[str, Any]) -> dict[str, Any]:
    session = row.get("session") or {}
    analysis_payload = row.get("analysis_payload") or {}

    return {
        "id": row.get("id"),
        "result_id": row.get("id"),
        "session_id": row.get("session_id"),
        "module_name": row.get("module_name"),
        "test_type": row.get("test_type"),
        "created_at": row.get("created_at"),
        "result_created_at": row.get("created_at"),
        "session_created_at": session.get("created_at"),
        "subject_no": subject.get("subject_no"),
        "analysis_payload": analysis_payload,
        "result_payload": row.get("result_payload") or {},
        "artifacts": row.get("artifacts") or {},
    }


def _serialize_detail(row: dict[str, Any], subject: dict[str, Any]) -> dict[str, Any]:
    session = row.get("session") or {}

    return {
        "id": row.get("id"),
        "result_id": row.get("id"),
        "session_id": row.get("session_id"),
        "module_name": row.get("module_name"),
        "test_type": row.get("test_type"),
        "created_at": row.get("created_at"),
        "result_created_at": row.get("created_at"),
        "session_created_at": session.get("created_at"),
        "subject_no": subject.get("subject_no"),
        "subject": subject,
        "session": {
            "id": session.get("id"),
            "subject_id": session.get("subject_id"),
            "local_session_id": session.get("local_session_id"),
            "session_type": session.get("session_type"),
            "notes": session.get("notes"),
            "created_at": session.get("created_at"),
            "captured_at": session.get("captured_at"),
        },
        "result_payload": row.get("result_payload") or {},
        "analysis_payload": row.get("analysis_payload") or {},
        "artifacts": row.get("artifacts") or {},
        "cloud": {
            "ok": True,
            "result_id": row.get("id"),
            "session_id": row.get("session_id"),
        },
    }


@router.get("/list")
def read_history_list(
    subject_no: str = Query(..., description="로그인 이메일/subject_no"),
    limit: int = Query(50, ge=1, le=200),
):
    logger.info("GET /api/history/list called subject_no=%s limit=%s", subject_no, limit)

    subject = get_subject_by_subject_no(subject_no)
    if not subject:
        logger.warning("subject not found subject_no=%s", subject_no)
        return {
            "ok": True,
            "subject_no": subject_no,
            "count": 0,
            "items": [],
        }

    rows = _fetch_results_for_subject(subject["id"], limit=limit)
    items = [_serialize_list_item(row, subject) for row in rows]

    return {
        "ok": True,
        "subject": subject,
        "subject_no": subject_no,
        "count": len(items),
        "items": items,
    }


@router.get("/detail/{result_id}")
def read_history_detail(result_id: str):
    logger.info("GET /api/history/detail/%s called", result_id)

    supabase = get_supabase()

    result_resp = (
        supabase.table("results")
        .select("*")
        .eq("id", result_id)
        .limit(1)
        .execute()
    )
    result_rows = result_resp.data or []
    if not result_rows:
        logger.warning("result not found result_id=%s", result_id)
        raise HTTPException(status_code=404, detail="result not found")

    row = result_rows[0]

    session_resp = (
        supabase.table("sessions")
        .select("*")
        .eq("id", row["session_id"])
        .limit(1)
        .execute()
    )
    session_rows = session_resp.data or []
    if not session_rows:
        raise HTTPException(status_code=404, detail="session not found")

    session = session_rows[0]
    row["session"] = session

    subject_resp = (
        supabase.table("subjects")
        .select("*")
        .eq("id", session["subject_id"])
        .limit(1)
        .execute()
    )
    subject_rows = subject_resp.data or []
    if not subject_rows:
        raise HTTPException(status_code=404, detail="subject not found")

    subject = subject_rows[0]
    detail = _serialize_detail(row, subject)

    return {
        "ok": True,
        "item": detail,
    }


@router.delete("/result/{result_id}")
def delete_history_item(result_id: str):
    logger.info("DELETE /api/history/result/%s called", result_id)
    success = delete_result(result_id)
    if not success:
        logger.warning("result not found or delete failed result_id=%s", result_id)
        raise HTTPException(status_code=404, detail="Result not found")
    return {"ok": True, "message": "Result deleted successfully"}


# 하위 호환용
@router.get("/by-subject-no/{subject_no}")
def read_history_by_subject_no(subject_no: str, limit: int = Query(50, ge=1, le=200)):
    return read_history_list(subject_no=subject_no, limit=limit)