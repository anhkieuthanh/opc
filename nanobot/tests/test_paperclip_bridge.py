"""Contract-focused tests for the Paperclip bridge endpoint."""

from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "nanobot"
if "nanobot" not in sys.modules:
    pkg = types.ModuleType("nanobot")
    pkg.__path__ = [str(PACKAGE_ROOT)]
    sys.modules["nanobot"] = pkg
if "loguru" not in sys.modules:
    sys.modules["loguru"] = types.SimpleNamespace(
        logger=types.SimpleNamespace(
            info=lambda *args, **kwargs: None,
            warning=lambda *args, **kwargs: None,
            exception=lambda *args, **kwargs: None,
            disable=lambda *args, **kwargs: None,
            enable=lambda *args, **kwargs: None,
            add=lambda *args, **kwargs: 0,
            remove=lambda *args, **kwargs: None,
        )
    )

from nanobot.api.paperclip_bridge import PAPERCLIP_BRIDGE_AUTH_HEADER, PAPERCLIP_BRIDGE_PATH
from nanobot.api.server import create_app
from nanobot.bus.events import OutboundMessage

try:
    from aiohttp.test_utils import TestClient, TestServer

    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False


def _bridge_payload(**overrides):
    payload = {
        "dispatch_id": "dispatch-123",
        "idempotency_key": "idem-123",
        "company_id": "company-123",
        "issue_id": "issue-123",
        "issue_key": "ISSUE-123",
        "run_id": "run-123",
        "worker_id": "worker-123",
        "role": "writer",
        "objective": "Write a short summary",
        "instructions": "Summarize the provided context in two paragraphs.",
        "requested_at": "2026-05-16T00:00:00Z",
    }
    payload.update(overrides)
    return payload


def _run(coro):
    return asyncio.run(coro)


def _make_agent(response=None, side_effect=None) -> MagicMock:
    agent = MagicMock()
    agent.process_direct = AsyncMock(return_value=response, side_effect=side_effect)
    agent._connect_mcp = AsyncMock()
    agent.close_mcp = AsyncMock()
    return agent


def _create_bridge_app(agent):
    return create_app(
        agent,
        model_name="test-model",
        request_timeout=10.0,
        include_chat_api=False,
        enable_paperclip_bridge=True,
        paperclip_bridge_token="secret-token",
    )


@pytest.mark.skipif(not HAS_AIOHTTP, reason="aiohttp not installed")
def test_bridge_rejects_missing_auth() -> None:
    async def _test() -> None:
        client = TestClient(TestServer(_create_bridge_app(_make_agent(response="ignored"))))
        await client.start_server()
        try:
            resp = await client.post(PAPERCLIP_BRIDGE_PATH, json=_bridge_payload())

            assert resp.status == 401
            body = await resp.json()
            assert body["status"] == "failed"
            assert body["error"]["code"] == "bridge_auth_failed"
        finally:
            await client.close()

    _run(_test())


@pytest.mark.skipif(not HAS_AIOHTTP, reason="aiohttp not installed")
def test_bridge_rejects_invalid_payload() -> None:
    async def _test() -> None:
        agent = _make_agent(response="ignored")
        client = TestClient(TestServer(_create_bridge_app(agent)))
        await client.start_server()
        try:
            resp = await client.post(
                PAPERCLIP_BRIDGE_PATH,
                json=_bridge_payload(run_id=""),
                headers={PAPERCLIP_BRIDGE_AUTH_HEADER: "secret-token"},
            )

            assert resp.status == 400
            body = await resp.json()
            assert body["dispatch_id"] == "dispatch-123"
            assert body["status"] == "failed"
            assert body["error"]["code"] == "invalid_dispatch_payload"
            assert "run_id" in body["error"]["details"]["fields"]
            agent.process_direct.assert_not_awaited()
        finally:
            await client.close()

    _run(_test())


@pytest.mark.skipif(not HAS_AIOHTTP, reason="aiohttp not installed")
def test_bridge_executes_one_dispatch_and_shapes_success() -> None:
    async def _test() -> None:
        response = OutboundMessage(
            channel="paperclip_bridge",
            chat_id="dispatch-123",
            content="Summary delivered.",
            media=["artifact://summary.md"],
            metadata={"render_as": "text", "source": "nanobot"},
        )
        agent = _make_agent(response=response)
        client = TestClient(TestServer(_create_bridge_app(agent)))
        await client.start_server()
        try:
            resp = await client.post(
                PAPERCLIP_BRIDGE_PATH,
                json=_bridge_payload(),
                headers={PAPERCLIP_BRIDGE_AUTH_HEADER: "secret-token"},
            )

            assert resp.status == 200
            body = await resp.json()
            assert body["dispatch_id"] == "dispatch-123"
            assert body["run_id"] == "run-123"
            assert body["status"] == "succeeded"
            assert body["summary"] == "Summary delivered."
            assert body["worker_trace_ref"] == "paperclip:run-123"
            assert body["result"]["output_text"] == "Summary delivered."
            assert body["result"]["artifacts"] == ["artifact://summary.md"]
            assert body["result"]["metadata"]["source"] == "nanobot"
            agent.process_direct.assert_awaited_once_with(
                content="Write a short summary\n\nSummarize the provided context in two paragraphs.",
                session_key="paperclip:run-123",
                channel="paperclip_bridge",
                chat_id="dispatch-123",
            )
        finally:
            await client.close()

    _run(_test())


@pytest.mark.skipif(not HAS_AIOHTTP, reason="aiohttp not installed")
def test_bridge_shapes_execution_failure() -> None:
    async def _test() -> None:
        agent = _make_agent(side_effect=RuntimeError("upstream boom"))
        client = TestClient(TestServer(_create_bridge_app(agent)))
        await client.start_server()
        try:
            resp = await client.post(
                PAPERCLIP_BRIDGE_PATH,
                json=_bridge_payload(),
                headers={PAPERCLIP_BRIDGE_AUTH_HEADER: "secret-token"},
            )

            assert resp.status == 500
            body = await resp.json()
            assert body["dispatch_id"] == "dispatch-123"
            assert body["run_id"] == "run-123"
            assert body["status"] == "failed"
            assert body["error"]["code"] == "dispatch_execution_failed"
            assert body["error"]["retryable"] is True
            assert body["worker_trace_ref"] == "paperclip:run-123"
        finally:
            await client.close()

    _run(_test())
