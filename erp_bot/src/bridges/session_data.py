"""Per-session ledger snapshot pushed from the frontend Dexie bridge."""

from __future__ import annotations

import threading
from typing import Any

_lock = threading.Lock()
_SESSION_CONTEXT: dict[str, dict[str, Any]] = {}


def set_session_context(session_id: str, context: dict[str, Any] | None) -> None:
    """Store Dexie snapshot for a session (from frontend)."""
    if not session_id or not context:
        return
    with _lock:
        existing = _SESSION_CONTEXT.get(session_id, {})
        existing.update(context)
        _SESSION_CONTEXT[session_id] = existing


def get_session_context(session_id: str) -> dict[str, Any]:
    """Return latest session snapshot."""
    with _lock:
        return dict(_SESSION_CONTEXT.get(session_id, {}))


def clear_session_context(session_id: str) -> None:
    with _lock:
        _SESSION_CONTEXT.pop(session_id, None)
