"""Domain events — facts emitted by aggregates (Constitution: events are facts)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..shared.ids import CorrelationId, EventId, TenantId, new_event_id


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DomainEvent(BaseModel):
    """Base domain event — subclass per event type."""

    model_config = ConfigDict(frozen=True)

    event_id: EventId = Field(default_factory=new_event_id)
    event_type: str
    schema_version: int = 1
    occurred_at: datetime = Field(default_factory=utc_now)
    tenant_id: TenantId
    partition_key: str
    correlation_id: CorrelationId
    causation_id: EventId | None = None
    idempotency_key: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **data: Any) -> None:
        if not data.get("idempotency_key"):
            data["idempotency_key"] = str(data.get("event_id", new_event_id()))
        super().__init__(**data)


class DomainEventEnvelope(BaseModel):
    """Serializable envelope for outbox and event bus transport."""

    model_config = ConfigDict(frozen=True)

    event: DomainEvent

    @property
    def event_type(self) -> str:
        return self.event.event_type

    @property
    def partition_key(self) -> str:
        return self.event.partition_key


def make_partition_key(tenant_id: str, company_id: str | None, aggregate_id: str) -> str:
    company = company_id or "_"
    return f"{tenant_id}:{company}:{aggregate_id}"
