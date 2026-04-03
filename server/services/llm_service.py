from __future__ import annotations

import json
from typing import Any

import requests


# LOCAL_SERVER_DEPENDENCY: Ollama AI service URL (로컬 서버 주소)
# - Vercel 배포 시 cloud AI service로 교체 필요
OLLAMA_URL = "http://localhost:11434"  # LOCAL_SERVER_DEPENDENCY
DEFAULT_MODEL = "gemma2"


def build_dummy_bodycheck_summary_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "module": "body",
        "timestamp": "2026-03-30T10:00:00Z",
        "requested_view": "front",
        "status": "warning",
        "view_detection": {
            "view": "front",
            "confidence": 0.98,
            "reason": "dummy_test_payload",
        },
        "quality": {
            "capture_ok": True,
            "pose_ok": True,
            "body_in_frame": True,
            "confidence": 0.96,
            "missing_points": [],
        },
        "analysis": {
            "shoulder_balance": {
                "enabled": True,
                "view": "front",
                "value": 12.4,
                "unit": "px",
                "type": "right_shift",
                "grade": "mild",
                "confidence": 0.92,
                "summary": "어깨 중심이 약간 오른쪽으로 치우친 경향이 관찰됩니다.",
            },
            "pelvic_balance": {
                "enabled": True,
                "view": "front",
                "value": 9.1,
                "unit": "deg",
                "type": "left_high",
                "grade": "mild",
                "confidence": 0.91,
                "summary": "골반 높이가 좌우로 약간 불균형한 상태로 보입니다.",
            },
            "head_tilt": {
                "enabled": True,
                "view": "front",
                "value": 6.3,
                "unit": "deg",
                "type": "left_tilt",
                "grade": "mild",
                "confidence": 0.9,
                "summary": "머리가 왼쪽으로 소폭 기울어진 경향이 관찰됩니다.",
            },
        },
    }


def _collect_highlights(bodycheck_result: dict[str, Any]) -> dict[str, Any]:
    analysis = bodycheck_result.get("analysis") or {}
    findings: list[dict[str, Any]] = []

    for key, item in analysis.items():
        if not isinstance(item, dict) or not item.get("enabled"):
            continue

        finding = {
            "metric": key,
            "grade": item.get("grade"),
            "type": item.get("type"),
            "value": item.get("value"),
            "unit": item.get("unit"),
            "summary": item.get("summary"),
            "confidence": item.get("confidence"),
        }

        if item.get("grade") in {"mild", "moderate", "severe"}:
            findings.append(finding)

    if not findings:
        for key, item in analysis.items():
            if not isinstance(item, dict) or not item.get("enabled"):
                continue
            findings.append(
                {
                    "metric": key,
                    "grade": item.get("grade"),
                    "type": item.get("type"),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "summary": item.get("summary"),
                    "confidence": item.get("confidence"),
                }
            )

    return {
        "module": bodycheck_result.get("module"),
        "timestamp": bodycheck_result.get("timestamp"),
        "requested_view": bodycheck_result.get("requested_view"),
        "detected_view": (bodycheck_result.get("view_detection") or {}).get("view"),
        "quality": bodycheck_result.get("quality"),
        "findings": findings,
    }


def _build_prompt(bodycheck_result: dict[str, Any]) -> str:
    compact_payload = _collect_highlights(bodycheck_result)
    compact_json = json.dumps(compact_payload, ensure_ascii=False, indent=2)

    return (
        "당신은 자세 분석 결과를 환자 친화적으로 정리하는 전문가다.\n"
        "아래 JSON은 BodyCheck 분석 결과의 핵심 요약이다.\n"
        "다음 규칙으로 한국어 요약을 작성하라.\n"
        "1. 4문장 이내로 작성한다.\n"
        "2. 정상보다 주의가 필요한 항목을 우선 설명한다.\n"
        "3. 불확실한 진단 표현은 피하고, '경향', '불균형', '관찰됨' 같은 표현을 사용한다.\n"
        "4. 의료적 확정 진단처럼 쓰지 않는다.\n"
        "5. findings가 비어 있거나 모두 normal/unknown이면 전반적으로 큰 이상 소견이 적다고 설명한다.\n\n"
        f"BodyCheck JSON:\n{compact_json}\n\n"
        "요약:"
    )


def _candidate_urls(ollama_url: str) -> list[str]:
    normalized = ollama_url.rstrip("/")
    if normalized.endswith("/api/generate") or normalized.endswith("/v1/chat/completions"):
        return [normalized]
    return [f"{normalized}/api/generate", f"{normalized}/v1/chat/completions"]


def _request_generate(endpoint: str, model: str, prompt: str, timeout: int) -> str:
    if endpoint.endswith("/api/generate"):
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
            },
        }
        response = requests.post(endpoint, json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        return (data.get("response") or "").strip()

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "temperature": 0.3,
    }
    response = requests.post(endpoint, json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return (message.get("content") or "").strip()


def summarize_bodycheck_result(
    bodycheck_result: dict[str, Any],
    *,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
    timeout: int = 60,
) -> str:
    prompt = _build_prompt(bodycheck_result)
    errors: list[str] = []

    for endpoint in _candidate_urls(ollama_url):
        try:
            summary = _request_generate(endpoint, model, prompt, timeout)
            if summary:
                return summary
            errors.append(f"{endpoint}: empty response")
        except requests.RequestException as exc:
            errors.append(f"{endpoint}: {exc}")

    raise RuntimeError("Failed to get summary from Ollama. " + " | ".join(errors))
