"""Transactional outbox port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Sequence

from pydantic import BaseModel, ConfigDict

from ....domain.events import DomainEventEnvelope


class OutboxMessage(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    envelope: DomainEventEnvelope
    created_at: datetime
    published_at: datetime | None = None
    attempts: int = 0


class OutboxPort(ABC):
    @abstractmethod
    async def enqueue(self, envelope: DomainEventEnvelope) -> str:
        """Add event to outbox (caller manages transaction scope)."""

    @abstractmethod
    async def fetch_unpublished(self, *, limit: int = 100) -> Sequence[OutboxMessage]:
        """Poll unpublished messages."""

    @abstractmethod
    async def mark_published(self, message_id: str) -> None:
        """Mark message as successfully published."""

    @abstractmethod
    async def mark_failed(self, message_id: str, error: str) -> None:
        """Increment attempts and record error."""
