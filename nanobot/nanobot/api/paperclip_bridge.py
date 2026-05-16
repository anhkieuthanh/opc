"""Dedicated Paperclip bridge endpoint for Nanobot worker dispatches."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from aiohttp import web
from loguru import logger

PAPERCLIP_BRIDGE_PATH = "/paperclip/dispatch"
PAPERCLIP_BRIDGE_AUTH_HEADER = "X-Paperclip-Bridge-Token"
PAPERCLIP_BRIDGE_SESSION_PREFIX = "paperclip"
PAPERCLIP_BRIDGE_CHANNEL = "paperclip_bridge"

REQUIRED_FIELDS = (
    "dispatch_id",
    "idempotency_key",
    "company_id",
    "issue_id",
    "run_id",
    "worker_id",
    "role",
    "objective",
    "instructions",
    "requested_at",
)
REQUIRED_TEXT_FIELDS = (
    "objective",
    "instructions",
)


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _result_output_text(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "content"):
        return str(getattr(value, "content") or "")
    return str(value)


def _result_payload(response: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"output_text": _result_output_text(response)}
    media = getattr(response, "media", None)
    metadata = getattr(response, "metadata", None)
    buttons = getattr(response, "buttons", None)
    if media:
        result["artifacts"] = media
    if metadata:
        result["metadata"] = metadata
    if buttons:
        result["actions"] = buttons
    return result


def _success_payload(
    *,
    dispatch_id: str,
    run_id: str,
    session_key: str,
    response: Any,
) -> dict[str, Any]:
    result = _result_payload(response)
    summary = result["output_text"].strip() or "Nanobot completed the Paperclip dispatch."
    return {
        "dispatch_id": dispatch_id,
        "run_id": run_id,
        "status": "succeeded",
        "completed_at": _utc_now(),
        "summary": summary,
        "result": result,
        "worker_trace_ref": session_key,
    }


def _failure_payload(
    *,
    status: str,
    summary: str,
    code: str,
    message: str,
    retryable: bool,
    dispatch_id: str | None = None,
    run_id: str | None = None,
    session_key: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "dispatch_id": dispatch_id,
        "run_id": run_id,
        "status": status,
        "failed_at": _utc_now(),
        "summary": summary,
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
        },
    }
    if details:
        payload["error"]["details"] = details
    if session_key:
        payload["worker_trace_ref"] = session_key
    return payload


def _bridge_error_response(
    *,
    http_status: int,
    status: str,
    summary: str,
    code: str,
    message: str,
    retryable: bool,
    dispatch_id: str | None = None,
    run_id: str | None = None,
    session_key: str | None = None,
    details: dict[str, Any] | None = None,
) -> web.Response:
    return web.json_response(
        _failure_payload(
            status=status,
            summary=summary,
            code=code,
            message=message,
            retryable=retryable,
            dispatch_id=dispatch_id,
            run_id=run_id,
            session_key=session_key,
            details=details,
        ),
        status=http_status,
    )


def _extract_bearer_token(auth_value: str | None) -> str | None:
    if not auth_value:
        return None
    if not auth_value.lower().startswith("bearer "):
        return None
    token = auth_value[7:].strip()
    return token or None


def _request_token(request: web.Request) -> str | None:
    return request.headers.get(PAPERCLIP_BRIDGE_AUTH_HEADER) or _extract_bearer_token(
        request.headers.get("Authorization")
    )


def _require_bridge_token(request: web.Request) -> str | None:
    token = request.app.get("paperclip_bridge_token")
    if token is None:
        logger.warning("Paperclip bridge called without configured bridge token")
        return None
    return str(token).strip() or None


def _validate_payload(payload: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(payload, dict):
        return None, {"payload": "Request body must be a JSON object."}

    errors: dict[str, str] = {}
    for field in REQUIRED_FIELDS:
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            errors[field] = f"{field} is required."

    for field in REQUIRED_TEXT_FIELDS:
        value = payload.get(field)
        if isinstance(value, str) and not value.strip():
            errors[field] = f"{field} must not be empty."

    if errors:
        return None, errors

    normalized = dict(payload)
    for field in REQUIRED_FIELDS:
        normalized[field] = normalized[field].strip()
    return normalized, None


async def handle_paperclip_dispatch(request: web.Request) -> web.Response:
    """POST /paperclip/dispatch — execute one authenticated Paperclip worker dispatch."""
    configured_token = _require_bridge_token(request)
    if not configured_token:
        return _bridge_error_response(
            http_status=503,
            status="failed",
            summary="Paperclip bridge is not configured.",
            code="bridge_not_configured",
            message="Set a Paperclip bridge token before serving this endpoint.",
            retryable=False,
        )

    request_token = _request_token(request)
    if request_token != configured_token:
        return _bridge_error_response(
            http_status=401,
            status="failed",
            summary="Paperclip bridge authentication failed.",
            code="bridge_auth_failed",
            message=(
                f"Provide the shared bridge token via {PAPERCLIP_BRIDGE_AUTH_HEADER} "
                "or Authorization: Bearer <token>."
            ),
            retryable=False,
        )

    try:
        raw_payload = await request.json()
    except Exception:
        return _bridge_error_response(
            http_status=400,
            status="failed",
            summary="Paperclip bridge payload was not valid JSON.",
            code="invalid_json",
            message="Request body must be valid JSON.",
            retryable=False,
        )

    payload, errors = _validate_payload(raw_payload)
    dispatch_id = raw_payload.get("dispatch_id") if isinstance(raw_payload, dict) else None
    run_id = raw_payload.get("run_id") if isinstance(raw_payload, dict) else None
    if errors:
        return _bridge_error_response(
            http_status=400,
            status="failed",
            summary="Paperclip bridge payload validation failed.",
            code="invalid_dispatch_payload",
            message="Dispatch payload is missing required bridge fields.",
            retryable=False,
            dispatch_id=dispatch_id if isinstance(dispatch_id, str) else None,
            run_id=run_id if isinstance(run_id, str) else None,
            details={"fields": errors},
        )

    assert payload is not None
    dispatch_id = payload["dispatch_id"]
    run_id = payload["run_id"]
    session_key = f"{PAPERCLIP_BRIDGE_SESSION_PREFIX}:{run_id}"
    session_locks: dict[str, asyncio.Lock] = request.app["session_locks"]
    session_lock = session_locks.setdefault(session_key, asyncio.Lock())
    timeout_s = float(request.app.get("request_timeout", 120.0))
    agent_loop = request.app["agent_loop"]

    execution_input = payload["instructions"].strip()
    objective = payload["objective"].strip()
    if objective and objective not in execution_input:
        execution_input = f"{objective}\n\n{execution_input}"

    logger.info(
        "Paperclip bridge dispatch_id={} run_id={} worker_id={}",
        dispatch_id,
        run_id,
        payload["worker_id"],
    )

    try:
        async with session_lock:
            response = await asyncio.wait_for(
                agent_loop.process_direct(
                    content=execution_input,
                    session_key=session_key,
                    channel=PAPERCLIP_BRIDGE_CHANNEL,
                    chat_id=dispatch_id,
                ),
                timeout=timeout_s,
            )
    except asyncio.TimeoutError:
        return _bridge_error_response(
            http_status=504,
            status="failed",
            summary="Paperclip bridge request timed out.",
            code="dispatch_timeout",
            message=f"Nanobot did not complete the dispatch within {timeout_s}s.",
            retryable=True,
            dispatch_id=dispatch_id,
            run_id=run_id,
            session_key=session_key,
        )
    except Exception as exc:
        logger.exception("Paperclip bridge dispatch failed for run {}", run_id)
        return _bridge_error_response(
            http_status=500,
            status="failed",
            summary="Nanobot failed to execute the Paperclip dispatch.",
            code="dispatch_execution_failed",
            message=str(exc) or "Nanobot raised an execution error.",
            retryable=True,
            dispatch_id=dispatch_id,
            run_id=run_id,
            session_key=session_key,
        )

    return web.json_response(
        _success_payload(
            dispatch_id=dispatch_id,
            run_id=run_id,
            session_key=session_key,
            response=response,
        )
    )


def register_paperclip_bridge(app: web.Application) -> None:
    """Mount the Paperclip bridge route onto an aiohttp app."""
    app.router.add_post(PAPERCLIP_BRIDGE_PATH, handle_paperclip_dispatch)
