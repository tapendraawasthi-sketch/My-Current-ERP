"""Planner queries."""

from __future__ import annotations

from pydantic import Field

from ....application.queries import Query
from ....shared.ids import PlanId, RequestId
from ..domain.value_objects import PlanStatus


class GetExecutionPlanQuery(Query):
    query_type: str = "oip.query.planner.get_plan.v1"
    plan_id: PlanId


class GetExecutionStepsQuery(Query):
    query_type: str = "oip.query.planner.get_steps.v1"
    plan_id: PlanId


class GetExecutionStatusQuery(Query):
    query_type: str = "oip.query.planner.get_status.v1"
    plan_id: PlanId


class SearchExecutionPlansQuery(Query):
    query_type: str = "oip.query.planner.search_plans.v1"
    company_id: str | None = None
    conversation_id: str | None = None
    request_id: RequestId | None = None
    status: PlanStatus | None = None
    limit: int = Field(default=50, ge=1, le=200)


class GetPlannerMetricsQuery(Query):
    query_type: str = "oip.query.planner.get_metrics.v1"
    metric_date: str | None = None
