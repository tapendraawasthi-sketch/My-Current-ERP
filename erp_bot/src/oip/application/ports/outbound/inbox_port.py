"""Inbox port — idempotent event consumption."""

from __future__ import annotations

from abc import ABC, abstractmethod


class InboxPort(ABC):
    @abstractmethod
    async def is_processed(self, *, consumer_group: str, idempotency_key: str) -> bool:
        """Check if event was already handled."""

    @abstractmethod
    async def mark_processed(
        self,
        *,
        consumer_group: str,
        idempotency_key: str,
        event_type: str,
    ) -> None:
        """Record successful processing."""
