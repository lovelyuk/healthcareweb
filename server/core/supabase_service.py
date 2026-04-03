from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any

from core.supabase_client import get_supabase

BUCKET_NAME = os.getenv("SUPABASE_BUCKET", "bodycheck-artifacts")


def ensure_subject(
    subject_no: str,
    name: str | None = None,
    gender: str | None = None,
    birth_date: str | None = None,
) -> dict:
    supabase = get_supabase()
    response = (
        supabase.table("subjects")
        .upsert(
            {
                "subject_no": subject_no,
                "name": name,
                "gender": gender,
                "birth_date": birth_date,
            },
            on_conflict="subject_no",
        )
        .execute()
    )
    return response.data[0]


def create_session(
    subject_id: str,
    local_session_id: str | None = None,
    session_type: str = "scan",
    notes: str | None = None,
) -> dict:
    supabase = get_supabase()
    response = (
        supabase.table("sessions")
        .insert(
            {
                "subject_id": subject_id,
                "local_session_id": local_session_id,
                "session_type": session_type,
                "notes": notes,
            }
        )
        .execute()
    )
    return response.data[0]


def save_result(
    session_id: str,
    module_name: str,
    test_type: str | None,
    result_payload: dict[str, Any],
    analysis_payload: dict[str, Any],
    artifacts: dict[str, Any] | None = None,
) -> dict:
    supabase = get_supabase()
    response = (
        supabase.table("results")
        .insert(
            {
                "session_id": session_id,
                "module_name": module_name,
                "test_type": test_type,
                "result_payload": result_payload,
                "analysis_payload": analysis_payload,
                "artifacts": artifacts or {},
            }
        )
        .execute()
    )
    return response.data[0]


def upload_file(local_path: str | Path, remote_path: str, upsert: bool = True) -> str:
    supabase = get_supabase()
    path = Path(local_path)
    content_type, _ = mimetypes.guess_type(path.name)

    with path.open("rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=remote_path,
            file=f,
            file_options={
                "content-type": content_type or "application/octet-stream",
                "upsert": "true" if upsert else "false",
            },
        )

    return supabase.storage.from_(BUCKET_NAME).get_public_url(remote_path)


def get_subject_history(subject_id: str, limit: int = 100) -> list[dict]:
    supabase = get_supabase()
    response = (
        supabase.table("sessions")
        .select("*, results(*)")
        .eq("subject_id", subject_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


def get_subject_by_subject_no(subject_no: str) -> dict | None:
    supabase = get_supabase()
    response = (
        supabase.table("subjects")
        .select("*")
        .eq("subject_no", subject_no)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def delete_result(result_id: str) -> bool:
    supabase = get_supabase()
    response = (
        supabase.table("results")
        .delete()
        .eq("id", result_id)
        .execute()
    )
    return len(response.data) > 0