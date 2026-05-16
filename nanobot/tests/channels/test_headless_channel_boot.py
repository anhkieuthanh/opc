from types import SimpleNamespace
from unittest.mock import patch
import sys
import types
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2] / "nanobot"
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
            bind=lambda *args, **kwargs: types.SimpleNamespace(
                info=lambda *a, **k: None,
                warning=lambda *a, **k: None,
                exception=lambda *a, **k: None,
            ),
            debug=lambda *args, **kwargs: None,
        )
    )

from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.channels.manager import ChannelManager
from nanobot.config.schema import ChannelsConfig


class _FakeChannel(BaseChannel):
    name = "fakechannel"
    display_name = "Fake Channel"

    @classmethod
    def default_config(cls):
        return {"enabled": False, "allowFrom": ["*"]}

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False

    async def send(self, msg) -> None:
        return None


def _build_manager_config(*, worker_mode: bool, allowlist: list[str]):
    return SimpleNamespace(
        runtime=SimpleNamespace(
            mode="worker" if worker_mode else "full",
            worker_channel_allowlist=allowlist,
        ),
        channels=ChannelsConfig.model_validate(
            {
                "fakechannel": {"enabled": True, "allowFrom": ["*"]},
            }
        ),
        providers=SimpleNamespace(
            groq=SimpleNamespace(api_key="", api_base=""),
            openai=SimpleNamespace(api_key="", api_base=""),
        ),
    )


def _init_manager(config) -> ChannelManager:
    mgr = ChannelManager.__new__(ChannelManager)
    mgr.config = config
    mgr.bus = MessageBus()
    mgr.channels = {}
    mgr._dispatch_task = None
    mgr._origin_reply_fingerprints = {}
    return mgr


def test_worker_mode_skips_non_allowlisted_channels() -> None:
    config = _build_manager_config(worker_mode=True, allowlist=[])
    manager = _init_manager(config)
    with patch("nanobot.channels.registry.discover_all", return_value={"fakechannel": _FakeChannel}):
        manager._init_channels()

    assert "fakechannel" not in manager.channels


def test_worker_mode_keeps_allowlisted_channels() -> None:
    config = _build_manager_config(worker_mode=True, allowlist=["fakechannel"])
    manager = _init_manager(config)
    with patch("nanobot.channels.registry.discover_all", return_value={"fakechannel": _FakeChannel}):
        manager._init_channels()

    assert "fakechannel" in manager.channels


def test_full_mode_preserves_existing_channel_boot_behavior() -> None:
    config = _build_manager_config(worker_mode=False, allowlist=[])
    manager = _init_manager(config)
    with patch("nanobot.channels.registry.discover_all", return_value={"fakechannel": _FakeChannel}):
        manager._init_channels()

    assert "fakechannel" in manager.channels
