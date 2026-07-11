"""Action Runtime queries."""

from __future__ import annotations

from ....application.queries import Query
from ....shared.ids import ActionId, EvaluationId, ExecutionId, RequestId


class GetActionQuery(Query):
    query_type: str = "oip.query.action_runtime.get_action.v1"
    action_id: ActionId


class ActionMetricsQuery(Query):
    query_type: str = "oip.query.action_runtime.get_metrics.v1"
    metric_date: str | None = None


class SearchActionsQuery(Query):
    query_type: str = "oip.query.action_runtime.search_actions.v1"
    execution_id: ExecutionId | None = None
    evaluation_id: EvaluationId | None = None
    request_id: RequestId | None = None
    status: str | None = None
    limit: int = 50
