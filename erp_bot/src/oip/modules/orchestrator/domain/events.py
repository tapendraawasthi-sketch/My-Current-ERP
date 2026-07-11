"""Orchestrator domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class WorkflowStartedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.started.v1"


class StageStartedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.stage.started.v1"


class StageCompletedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.stage.completed.v1"


class StageFailedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.stage.failed.v1"


class WorkflowRetryScheduledEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.retry_scheduled.v1"


class WorkflowRolledBackEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.rolled_back.v1"


class WorkflowCompletedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.completed.v1"


class WorkflowFailedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.failed.v1"


class WorkflowCancelledEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.cancelled.v1"


class WorkflowArchivedEvent(DomainEvent):
    event_type: str = "oip.orchestrator.workflow.archived.v1"


def build_orchestrator_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    workflow_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, workflow_id),
        payload={"workflow_id": workflow_id, **payload},
    )
