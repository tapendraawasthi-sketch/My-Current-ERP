"""Event publisher port — dispatches domain events after outbox commit."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Awaitable, Callable

from ....domain.events import DomainEventEnvelope

EventHandler = Callable[[DomainEventEnvelope], Awaitable[None]]


class EventPublisherPort(ABC):
    @abstractmethod
    async def publish(self, envelope: DomainEventEnvelope) -> None:
        """Publish a single event to subscribers."""

    @abstractmethod
    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register async handler for event type."""
