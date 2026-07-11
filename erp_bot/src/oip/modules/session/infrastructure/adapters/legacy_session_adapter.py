"""Legacy session context adapter."""

from __future__ import annotations

from typing import Any


class LegacySessionContextAdapter:
    """Reads ERP session context from legacy bridges (strangler)."""

    def load_context(self, user_id: str) -> dict[str, Any]:
        try:
            from src.bridges.session_data import get_session_context

            return get_session_context(user_id) or {}
        except Exception:
            return {}
