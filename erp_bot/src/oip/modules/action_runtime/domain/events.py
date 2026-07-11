"""Action Runtime domain events — outbox only."""

from __future__ import annotations

from typing import Any

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class ActionProposedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.proposed.v1"


class ActionValidatedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.validated.v1"


class ActionApprovedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.approved.v1"


class ActionRejectedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.rejected.v1"


class ActionExecutionStartedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.execution_started.v1"


class ActionExecutedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.executed.v1"


class ActionCompensatedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.compensated.v1"


class ActionFailedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.failed.v1"


class ActionCancelledEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.cancelled.v1"


class ActionArchivedEvent(DomainEvent):
    event_type: str = "oip.action_runtime.action.archived.v1"


def build_action_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    action_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, action_id),
        payload={"action_id": action_id, **payload},
    )
