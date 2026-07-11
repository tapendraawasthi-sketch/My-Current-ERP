"""Streaming Runtime domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class StreamOpenedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.stream.opened.v1"


class StreamClosedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.stream.closed.v1"


class ChunkPublishedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.chunk.published.v1"


class ReplayStartedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.replay.started.v1"


class ReplayCompletedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.replay.completed.v1"


class HeartbeatSentEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.heartbeat.sent.v1"


class TransportFailedEvent(DomainEvent):
    event_type: str = "oip.streaming_runtime.transport.failed.v1"


def build_streaming_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    stream_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, stream_id),
        payload={"stream_id": stream_id, **payload},
    )
