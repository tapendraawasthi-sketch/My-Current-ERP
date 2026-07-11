"""Router domain events — outbox only."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from ....domain.events import DomainEvent, make_partition_key
from ....shared.ids import CorrelationId, TenantId


class RouteDecisionCreatedEvent(DomainEvent):
    event_type: str = "oip.router.route_decision.created.v1"


class RouteApprovedEvent(DomainEvent):
    event_type: str = "oip.router.route.approved.v1"


class RouteRejectedEvent(DomainEvent):
    event_type: str = "oip.router.route.rejected.v1"


class RouteExpiredEvent(DomainEvent):
    event_type: str = "oip.router.route.expired.v1"


class RouteArchivedEvent(DomainEvent):
    event_type: str = "oip.router.route.archived.v1"


def build_route_event(
    event_cls: type[DomainEvent],
    *,
    tenant_id: str,
    correlation_id: str,
    company_id: str | None,
    route_id: str,
    payload: dict[str, Any],
) -> DomainEvent:
    return event_cls(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, route_id),
        payload={"route_id": route_id, **payload},
    )
