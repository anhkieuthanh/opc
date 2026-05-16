from unittest.mock import patch
import sys
import types
from pathlib import Path

from typer.testing import CliRunner

PACKAGE_ROOT = Path(__file__).resolve().parents[2] / "nanobot"
if "nanobot" not in sys.modules:
    pkg = types.ModuleType("nanobot")
    pkg.__path__ = [str(PACKAGE_ROOT)]
    pkg.__logo__ = "nanobot"
    pkg.__version__ = "test"
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
            bind=lambda *args, **kwargs: types.SimpleNamespace(
                info=lambda *a, **k: None,
                warning=lambda *a, **k: None,
                exception=lambda *a, **k: None,
            ),
            debug=lambda *args, **kwargs: None,
        )
    )

from nanobot.cli.commands import _set_worker_mode, app
from nanobot.config.schema import Config

runner = CliRunner()


def test_set_worker_mode_forces_worker_runtime() -> None:
    cfg = Config()
    assert cfg.runtime.mode == "full"

    _set_worker_mode(cfg, reason="test")

    assert cfg.runtime.mode == "worker"
    assert cfg.is_worker_mode is True


def test_gateway_warns_when_worker_mode_has_empty_allowlist(monkeypatch) -> None:
    cfg = Config()
    cfg.runtime.mode = "worker"
    cfg.runtime.worker_channel_allowlist = []

    seen: dict[str, object] = {}

    monkeypatch.setattr("nanobot.cli.commands._load_runtime_config", lambda *args, **kwargs: cfg)
    monkeypatch.setattr(
        "nanobot.cli.commands._run_gateway",
        lambda config, **kwargs: seen.setdefault("config", config),
    )

    result = runner.invoke(app, ["gateway"])

    assert result.exit_code == 0
    assert "Worker mode active with empty channel allowlist" in result.stdout
    assert seen["config"] is cfg


def test_serve_paperclip_bridge_forces_worker_mode(monkeypatch) -> None:
    cfg = Config()
    cfg.runtime.mode = "full"
    seen: dict[str, object] = {}

    class _FakeLoop:
        async def _connect_mcp(self) -> None:
            return None

        async def close_mcp(self) -> None:
            return None

    class _FakeApp:
        def __init__(self) -> None:
            self.on_startup = []
            self.on_cleanup = []

    def _fake_from_config(config, bus, **kwargs):
        seen["runtime_mode_at_agent_build"] = config.runtime.mode
        return _FakeLoop()

    def _fake_run_app(*_args, **_kwargs):
        raise RuntimeError("stop-run-app")

    monkeypatch.setattr("nanobot.cli.commands._load_runtime_config", lambda *args, **kwargs: cfg)
    monkeypatch.setattr("nanobot.cli.commands.sync_workspace_templates", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("nanobot.cli.commands.AgentLoop.from_config", _fake_from_config)
    monkeypatch.setattr("nanobot.bus.queue.MessageBus", lambda: object())
    monkeypatch.setattr("nanobot.session.manager.SessionManager", lambda *_args, **_kwargs: object())
    monkeypatch.setattr("nanobot.api.server.create_app", lambda *_args, **_kwargs: _FakeApp())

    with patch("aiohttp.web.run_app", _fake_run_app):
        result = runner.invoke(
            app,
            ["serve-paperclip-bridge", "--bridge-token", "token-123"],
        )

    assert result.exit_code != 0
    assert "stop-run-app" in str(result.exception)
    assert seen["runtime_mode_at_agent_build"] == "worker"
