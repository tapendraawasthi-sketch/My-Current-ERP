"""Orchestrator CQRS handlers."""

from __future__ import annotations

from typing import Any

from .....application.dto.intelligence_request import IntelligenceRequestDto
from ..commands import ArchiveWorkflowCommand, CancelWorkflowCommand, RecoverWorkflowsCommand, StartWorkflowCommand
from ..projectors.orchestrator_projectors import WorkflowMetricsProjector, WorkflowProjector, WorkflowTimelineProjector
from ..queries import GetWorkflowQuery, GetWorkflowTimelineQuery, ListWorkflowsQuery, WorkflowMetricsQuery
from ..services.orchestrator_service import OrchestratorService
from ...infrastructure.persistence.orchestrator_sqlite import SqliteWorkflowRepositoryAdapter


class StartWorkflowHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service
        self._projector = WorkflowProjector()

    async def __call__(self, command: StartWorkflowCommand) -> dict[str, Any]:
        dto = IntelligenceRequestDto(
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            idempotency_key=command.idempotency_key,
            tenant_id=str(command.tenant_id),
            company_id=command.company_id,
            branch_id=command.branch_id,
            user_id=command.user_id,
            session_id=command.session_id,
            conversation_id=command.conversation_id or command.session_id,
            module=command.module,
            language=command.language,
            question=command.message,
            metadata=command.metadata,
        )
        workflow = await self._service.start_workflow(
            request=dto, execution_mode=command.execution_mode
        )
        return self._projector.project(workflow).model_dump(mode="json")


class CancelWorkflowHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service
        self._projector = WorkflowProjector()

    async def __call__(self, command: CancelWorkflowCommand) -> dict[str, Any]:
        workflow = await self._service.cancel_workflow(
            tenant_id=str(command.tenant_id),
            workflow_id=command.workflow_id,
            reason=command.reason,
        )
        return self._projector.project(workflow).model_dump(mode="json")


class ArchiveWorkflowHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service
        self._projector = WorkflowProjector()

    async def __call__(self, command: ArchiveWorkflowCommand) -> dict[str, Any]:
        workflow = await self._service.archive_workflow(
            tenant_id=str(command.tenant_id),
            workflow_id=command.workflow_id,
        )
        return self._projector.project(workflow).model_dump(mode="json")


class RecoverWorkflowsHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service
        self._projector = WorkflowProjector()

    async def __call__(self, command: RecoverWorkflowsCommand) -> list[dict[str, Any]]:
        workflows = await self._service.recover_workflows(tenant_id=str(command.tenant_id))
        return [self._projector.project(w).model_dump(mode="json") for w in workflows]


class GetWorkflowHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service

    async def __call__(self, query: GetWorkflowQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_workflow(
            tenant_id=str(query.tenant_id), workflow_id=query.workflow_id
        )
        return read_model.model_dump(mode="json") if read_model else None


class ListWorkflowsHandler:
    def __init__(self, repository: SqliteWorkflowRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = WorkflowProjector()

    async def __call__(self, query: ListWorkflowsQuery) -> list[dict[str, Any]]:
        workflows = await self._repository.list_workflows(
            tenant_id=str(query.tenant_id),
            state=query.state,
            limit=query.limit,
        )
        return [self._projector.project(w).model_dump(mode="json") for w in workflows]


class GetWorkflowTimelineHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service

    async def __call__(self, query: GetWorkflowTimelineQuery) -> dict[str, Any] | None:
        timeline = await self._service.get_timeline(
            tenant_id=str(query.tenant_id), workflow_id=query.workflow_id
        )
        return timeline.model_dump(mode="json") if timeline else None


class WorkflowMetricsHandler:
    def __init__(self, service: OrchestratorService) -> None:
        self._service = service
        self._projector = WorkflowMetricsProjector()

    async def __call__(self, query: WorkflowMetricsQuery) -> dict[str, Any]:
        metrics = await self._service.get_metrics(tenant_id=str(query.tenant_id))
        return self._projector.project(metrics).model_dump(mode="json")
