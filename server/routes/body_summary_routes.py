from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from schemas.body_summary import BodySummaryRequest, BodySummaryResponse
from services.llm_service import build_dummy_bodycheck_summary_payload, summarize_bodycheck_result


router = APIRouter(prefix="/api/body", tags=["body"])

FALLBACK_SUMMARY = "요약 생성 중 오류가 발생했습니다. 원본 BodyCheck 결과를 기반으로 직접 확인해 주세요."


@router.post("/summary", response_model=BodySummaryResponse)
def summarize_body(payload: BodySummaryRequest) -> BodySummaryResponse:
    bodycheck_result: dict[str, Any] = payload.root

    try:
        summary = summarize_bodycheck_result(bodycheck_result)
        return BodySummaryResponse(success=True, summary=summary)
    except Exception as exc:
        return BodySummaryResponse(
            success=False,
            summary=FALLBACK_SUMMARY,
            error=str(exc),
        )


@router.get("/summary/test", response_model=BodySummaryResponse)
def summarize_body_test() -> BodySummaryResponse:
    dummy_payload = build_dummy_bodycheck_summary_payload()

    try:
        summary = summarize_bodycheck_result(dummy_payload)
        return BodySummaryResponse(success=True, dummy=True, summary=summary)
    except Exception as exc:
        return BodySummaryResponse(
            success=False,
            dummy=True,
            summary=FALLBACK_SUMMARY,
            error=str(exc),
        )
