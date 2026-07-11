"""Quality Gate queries."""

from __future__ import annotations

from ....application.queries import Query
from ....shared.ids import EvaluationId, ExecutionId, RequestId


class GetEvaluationQuery(Query):
    query_type: str = "oip.query.quality_gate.get_evaluation.v1"
    evaluation_id: EvaluationId


class GetDecisionQuery(Query):
    query_type: str = "oip.query.quality_gate.get_decision.v1"
    evaluation_id: EvaluationId


class GetFindingsQuery(Query):
    query_type: str = "oip.query.quality_gate.get_findings.v1"
    evaluation_id: EvaluationId


class QualityMetricsQuery(Query):
    query_type: str = "oip.query.quality_gate.get_metrics.v1"
    metric_date: str | None = None


class SearchEvaluationsQuery(Query):
    query_type: str = "oip.query.quality_gate.search_evaluations.v1"
    request_id: RequestId | None = None
    conversation_id: str | None = None
    company_id: str | None = None
    execution_id: ExecutionId | None = None
    decision: str | None = None
    limit: int = 50
