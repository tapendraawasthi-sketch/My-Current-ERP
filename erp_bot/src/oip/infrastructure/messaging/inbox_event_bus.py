"""Inbox-aware event bus — exactly-once consumer processing."""

from __future__ import annotations

from collections import defaultdict
from typing import Callable, DefaultDict, List

from ...application.ports.outbound.event_publisher_port import EventHandler
from ...application.ports.outbound.inbox_port import InboxPort
from ...domain.events import DomainEventEnvelope
from ..observability.metrics import get_metrics_registry
from ..observability.tracing import span


class InboxAwareEventBus:
    """Wraps handler registration with inbox deduplication."""

    def __init__(self, inbox: InboxPort, consumer_group: str = "oip-default") -> None:
        self._inbox = inbox
        self._consumer_group = consumer_group
        self._handlers: DefaultDict[str, List[EventHandler]] = defaultdict(list)
        self._middleware: list = []

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        async def wrapped(envelope: DomainEventEnvelope) -> None:
            idempotency_key = f"{event_type}:{envelope.event.correlation_id}:{envelope.event.event_id}"
            if await self._inbox.is_processed(
                consumer_group=self._consumer_group,
                idempotency_key=idempotency_key,
            ):
                get_metrics_registry().inc_counter(
                    "oip_inbox_duplicates_total",
                    consumer_group=self._consumer_group,
                )
                return
            with span("event.consume", event_type=event_type):
                await handler(envelope)
            await self._inbox.mark_processed(
                consumer_group=self._consumer_group,
                idempotency_key=idempotency_key,
                event_type=event_type,
            )

        self._handlers[event_type].append(wrapped)

    def use(self, middleware: Callable) -> None:
        self._middleware.append(middleware)

    async def publish(self, envelope: DomainEventEnvelope) -> None:
        current = envelope
        for mw in self._middleware:
            current = await mw(current)
        handlers = self._handlers.get(current.event_type, [])
        for handler in handlers:
            await handler(current)
