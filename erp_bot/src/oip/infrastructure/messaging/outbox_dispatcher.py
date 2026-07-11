"""Enhanced outbox dispatcher — retries, DLQ, metrics."""

from __future__ import annotations

from ...application.bus.event_bus import EventBus
from ...application.ports.outbound.outbox_port import OutboxPort
from ..observability.logging import log_event
from ..observability.metrics import get_metrics_registry
from ..persistence.outbox_sqlite import SqliteOutboxAdapter


class OutboxDispatcher:
    def __init__(
        self,
        outbox: OutboxPort,
        event_bus: EventBus,
        *,
        max_attempts: int = 5,
    ) -> None:
        self._outbox = outbox
        self._event_bus = event_bus
        self._max_attempts = max_attempts

    async def dispatch_pending(self, *, limit: int = 100) -> int:
        metrics = get_metrics_registry()
        messages = await self._outbox.fetch_unpublished(limit=limit)
        published = 0
        for message in messages:
            if message.attempts >= self._max_attempts:
                if isinstance(self._outbox, SqliteOutboxAdapter):
                    await self._outbox.move_to_dead_letter(message.id)
                metrics.inc_counter("oip_outbox_failed_total")
                continue
            try:
                await self._event_bus.publish(message.envelope)
                await self._outbox.mark_published(message.id)
                published += 1
                metrics.inc_counter("oip_outbox_published_total")
                log_event(
                    "outbox.published",
                    message_id=message.id,
                    event_type=message.envelope.event_type,
                )
            except Exception as exc:
                await self._outbox.mark_failed(message.id, str(exc))
                metrics.inc_counter("oip_outbox_failed_total")
                metrics.inc_counter("oip_retries_total", component="outbox")
                log_event("outbox.failed", message_id=message.id, error=str(exc))
        if isinstance(self._outbox, SqliteOutboxAdapter):
            stats = await self._outbox.get_queue_stats()
            metrics.set_gauge("oip_outbox_queue_depth", stats["unpublished"])
            metrics.set_gauge("oip_outbox_dlq_depth", stats["dead_letter"])
        return published

    async def replay_dead_letter(self, *, limit: int = 50) -> int:
        if not isinstance(self._outbox, SqliteOutboxAdapter):
            return 0
        return await self._outbox.replay_from_dead_letter(limit=limit)
