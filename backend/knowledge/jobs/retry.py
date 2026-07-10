"""Retry policy for failed ingestion jobs."""

from __future__ import annotations

from backend.knowledge.config import RETRY_BASE_DELAY_SEC


def compute_retry_delay(attempt: int, *, base_delay: float = RETRY_BASE_DELAY_SEC) -> float:
    """Exponential backoff delay in seconds."""
    return min(base_delay * (2 ** max(0, attempt - 1)), 3600.0)
