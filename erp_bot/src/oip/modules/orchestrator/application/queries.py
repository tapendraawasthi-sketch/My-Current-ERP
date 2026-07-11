"""Orchestrator queries."""

from __future__ import annotations

from ....application.queries import Query


class GetWorkflowQuery(Query):
    query_type: str = "oip.query.orchestrator.get_workflow.v1"
    workflow_id: str


class ListWorkflowsQuery(Query):
    query_type: str = "oip.query.orchestrator.list_workflows.v1"
    state: str | None = None
    limit: int = 50


class GetWorkflowTimelineQuery(Query):
    query_type: str = "oip.query.orchestrator.get_timeline.v1"
    workflow_id: str


class WorkflowMetricsQuery(Query):
    query_type: str = "oip.query.orchestrator.get_metrics.v1"
    metric_date: str | None = None
