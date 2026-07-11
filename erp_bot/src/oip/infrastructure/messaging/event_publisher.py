"""In-process event publisher implementing EventPublisherPort."""

from __future__ import annotations

from ...application.bus.event_bus import EventBus
from ...application.ports.outbound.event_publisher_port import EventHandler, EventPublisherPort
from ...domain.events import DomainEventEnvelope


class InProcessEventPublisher(EventPublisherPort):
    def __init__(self, event_bus: EventBus) -> None:
        self._bus = event_bus

    async def publish(self, envelope: DomainEventEnvelope) -> None:
        await self._bus.publish(envelope)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._bus.subscribe(event_type, handler)
