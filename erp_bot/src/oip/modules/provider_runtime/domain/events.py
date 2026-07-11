"""Provider Runtime domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class ExecutionStartedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.started.v1"


class ExecutionStreamingStartedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.streaming_started.v1"


class ExecutionChunkProducedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.chunk_produced.v1"


class ExecutionProviderInvokedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.provider_invoked.v1"


class ExecutionCompletedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.completed.v1"


class ExecutionFailedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.failed.v1"


class ExecutionCancelledEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.cancelled.v1"


class ExecutionTimedOutEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.timed_out.v1"


class ExecutionCheckpointCreatedEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.checkpoint_created.v1"


class ExecutionArtifactStoredEvent(DomainEvent):
    event_type: str = "oip.provider_runtime.execution.artifact_stored.v1"


def build_execution_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    execution_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, execution_id),
        payload={"execution_id": execution_id, **payload},
    )
