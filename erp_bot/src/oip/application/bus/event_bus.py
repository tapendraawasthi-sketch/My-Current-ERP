"""Domain event bus — in-process pub/sub backed by outbox dispatcher."""

from __future__ import annotations

from collections import defaultdict
from typing import Awaitable, Callable, DefaultDict, List

from ...domain.events import DomainEventEnvelope
from ...application.ports.outbound.event_publisher_port import EventHandler

EventMiddleware = Callable[[DomainEventEnvelope], Awaitable[DomainEventEnvelope]]


class EventBus:
    def __init__(self) -> None:
        self._handlers: DefaultDict[str, List[EventHandler]] = defaultdict(list)
        self._middleware: List[EventMiddleware] = []

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    def use(self, middleware: EventMiddleware) -> None:
        self._middleware.append(middleware)

    async def publish(self, envelope: DomainEventEnvelope) -> None:
        current = envelope
        for mw in self._middleware:
            current = await mw(current)
        handlers = self._handlers.get(current.event_type, [])
        for handler in handlers:
            await handler(current)
