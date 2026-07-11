"""Planner domain events — outbox only."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class ExecutionPlanCreatedEvent(DomainEvent):
    event_type: str = "oip.planner.execution_plan.created.v1"


class ExecutionPlanValidatedEvent(DomainEvent):
    event_type: str = "oip.planner.execution_plan.validated.v1"


class ExecutionPlanExpiredEvent(DomainEvent):
    event_type: str = "oip.planner.execution_plan.expired.v1"


class ExecutionPlanCancelledEvent(DomainEvent):
    event_type: str = "oip.planner.execution_plan.cancelled.v1"


class ExecutionPlanArchivedEvent(DomainEvent):
    event_type: str = "oip.planner.execution_plan.archived.v1"


def build_plan_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    plan_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, plan_id),
        payload={"plan_id": plan_id, **payload},
    )
