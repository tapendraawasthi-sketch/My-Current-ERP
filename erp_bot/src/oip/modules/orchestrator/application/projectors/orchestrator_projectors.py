"""Orchestrator read model projectors."""

from __future__ import annotations

from ...domain.entities import WorkflowExecution
from ...domain.value_objects import StageMetrics
from ..read_models.orchestrator_read_models import (
    WorkflowMetricsReadModel,
    WorkflowReadModel,
    WorkflowTimelineEntry,
    WorkflowTimelineReadModel,
)


class WorkflowProjector:
    def project(self, workflow: WorkflowExecution) -> WorkflowReadModel:
        return WorkflowReadModel(
            workflow_id=workflow.workflow_id,
            request_id=workflow.request_id,
            conversation_id=workflow.conversation_id,
            session_id=workflow.session_id,
            tenant_id=workflow.tenant_id,
            company_id=workflow.company_id,
            execution_mode=workflow.execution_mode.value,
            workflow_state=workflow.workflow_state.value,
            current_stage=workflow.current_stage.value if workflow.current_stage else None,
            completed_stages=workflow.completed_stages,
            failed_stage=workflow.failed_stage,
            module=workflow.module,
            started_at=workflow.started_at.isoformat(),
            updated_at=workflow.updated_at.isoformat(),
            completed_at=workflow.completed_at.isoformat() if workflow.completed_at else None,
            snapshots=workflow.snapshots,
        )


class WorkflowTimelineProjector:
    def project(
        self,
        workflow: WorkflowExecution,
        stages: tuple[StageMetrics, ...],
    ) -> WorkflowTimelineReadModel:
        entries = tuple(
            WorkflowTimelineEntry(
                stage=s.stage,
                status=s.status.value,
                started_at=s.started_at,
                completed_at=s.completed_at,
                duration_ms=s.duration_ms,
                retry_count=s.retry_count,
                error=s.metadata.get("error", ""),
            )
            for s in stages
        )
        return WorkflowTimelineReadModel(
            workflow_id=workflow.workflow_id,
            request_id=workflow.request_id,
            workflow_state=workflow.workflow_state.value,
            entries=entries,
        )


class WorkflowMetricsProjector:
    def project(self, metrics: WorkflowMetricsReadModel) -> WorkflowMetricsReadModel:
        return metrics
