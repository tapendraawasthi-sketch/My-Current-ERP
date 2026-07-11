"""Provider Runtime queries."""

from __future__ import annotations

from ....application.queries import Query
from ....shared.ids import ExecutionId, RequestId, RouteId


class GetExecutionQuery(Query):
    query_type: str = "oip.query.provider_runtime.get_execution.v1"
    execution_id: ExecutionId


class GetExecutionStatusQuery(Query):
    query_type: str = "oip.query.provider_runtime.get_status.v1"
    execution_id: ExecutionId


class GetExecutionUsageQuery(Query):
    query_type: str = "oip.query.provider_runtime.get_usage.v1"
    execution_id: ExecutionId


class GetExecutionArtifactsQuery(Query):
    query_type: str = "oip.query.provider_runtime.get_artifacts.v1"
    execution_id: ExecutionId


class ExecutionMetricsQuery(Query):
    query_type: str = "oip.query.provider_runtime.get_metrics.v1"
    metric_date: str | None = None


class SearchExecutionsQuery(Query):
    query_type: str = "oip.query.provider_runtime.search_executions.v1"
    route_id: RouteId | None = None
    plan_id: str | None = None
    request_id: RequestId | None = None
    conversation_id: str | None = None
    company_id: str | None = None
    provider_id: str | None = None
    status: str | None = None
    limit: int = 50
