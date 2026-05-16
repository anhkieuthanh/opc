import json
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
            debug=lambda *args, **kwargs: None,
        )
    )

from nanobot.config.loader import load_config
from nanobot.config.schema import Config


def test_runtime_mode_defaults_to_full() -> None:
    cfg = Config()
    assert cfg.runtime.mode == "full"
    assert cfg.runtime.worker_channel_allowlist == []
    assert cfg.is_worker_mode is False


def test_runtime_mode_accepts_camel_aliases() -> None:
    cfg = Config.model_validate(
        {
            "runtime": {
                "mode": "worker",
                "workerChannelAllowlist": ["websocket", "telegram"],
            }
        }
    )
    assert cfg.runtime.mode == "worker"
    assert cfg.runtime.worker_channel_allowlist == ["websocket", "telegram"]
    assert cfg.is_worker_mode is True


def test_load_config_migrates_legacy_worker_runtime_keys(tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "runtime": {
                    "workerMode": True,
                    "allowedChannels": ["websocket"],
                }
            }
        ),
        encoding="utf-8",
    )

    cfg = load_config(config_path)

    assert cfg.runtime.mode == "worker"
    assert cfg.runtime.worker_channel_allowlist == ["websocket"]
