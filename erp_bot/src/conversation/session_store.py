"""Persist conversation sessions to disk (survives server restart)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ..config import BOT_ROOT

logger = logging.getLogger(__name__)
_STORE_DIR = BOT_ROOT / "data" / "sessions"


def _path(session_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)[:120]
    return _STORE_DIR / f"{safe}.json"


def save_session_data(session_id: str, data: dict[str, Any]) -> None:
    try:
        _STORE_DIR.mkdir(parents=True, exist_ok=True)
        _path(session_id).write_text(json.dumps(data, ensure_ascii=False, default=str), encoding="utf-8")
    except Exception as exc:
        logger.warning("Session save failed %s: %s", session_id, exc)


def load_session_data(session_id: str) -> dict[str, Any] | None:
    try:
        p = _path(session_id)
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Session load failed %s: %s", session_id, exc)
        return None
