"""Memory Runtime domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class MemoryStoredEvent(DomainEvent):
    event_type: str = "oip.memory.memory.stored.v1"


class MemoryUpdatedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.updated.v1"


class MemoryMergedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.merged.v1"


class MemoryArchivedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.archived.v1"


class MemoryExpiredEvent(DomainEvent):
    event_type: str = "oip.memory.memory.expired.v1"


class MemoryRecalledEvent(DomainEvent):
    event_type: str = "oip.memory.memory.recalled.v1"


class MemoryPromotedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.promoted.v1"


class MemoryDemotedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.demoted.v1"


class MemoryConsolidatedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.consolidated.v1"


class MemoryDeletedEvent(DomainEvent):
    event_type: str = "oip.memory.memory.deleted.v1"


def build_memory_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    memory_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, memory_id),
        payload={"memory_id": memory_id, **payload},
    )
