"""Router queries."""

from __future__ import annotations

from pydantic import Field

from ....application.queries import Query
from ....shared.ids import PlanId, RequestId, RouteId
from ..domain.value_objects import RouteStatus


class GetRouteDecisionQuery(Query):
    query_type: str = "oip.query.router.get_route.v1"
    route_id: RouteId


class GetRoutesQuery(Query):
    query_type: str = "oip.query.router.get_routes.v1"
    plan_id: PlanId | None = None
    request_id: RequestId | None = None
    limit: int = Field(default=50, ge=1, le=200)


class GetProviderHealthQuery(Query):
    query_type: str = "oip.query.router.get_provider_health.v1"
    provider_id: str | None = None


class GetRoutingMetricsQuery(Query):
    query_type: str = "oip.query.router.get_metrics.v1"
    metric_date: str | None = None


class SearchRoutesQuery(Query):
    query_type: str = "oip.query.router.search_routes.v1"
    company_id: str | None = None
    conversation_id: str | None = None
    request_id: RequestId | None = None
    plan_id: PlanId | None = None
    provider_id: str | None = None
    status: RouteStatus | None = None
    limit: int = Field(default=50, ge=1, le=200)
