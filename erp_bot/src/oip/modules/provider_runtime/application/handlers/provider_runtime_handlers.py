"""Provider Runtime command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    ArchiveExecutionCommand,
    CancelExecutionCommand,
    CheckpointExecutionCommand,
    RetryExecutionCommand,
    StartExecutionCommand,
    TimeoutExecutionCommand,
)
from ..projectors.execution_projectors import ExecutionProjector
from ..queries import (
    ExecutionMetricsQuery,
    GetExecutionArtifactsQuery,
    GetExecutionQuery,
    GetExecutionStatusQuery,
    GetExecutionUsageQuery,
    SearchExecutionsQuery,
)
from ..services.provider_runtime_service import ProviderRuntimeService


class StartExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: StartExecutionCommand) -> dict[str, Any]:
        execution = await self._service.start_execution(
            route_id=str(command.route_id),
            tenant_id=str(command.tenant_id),
            execution_policy=command.execution_policy,
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class CancelExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: CancelExecutionCommand) -> dict[str, Any]:
        execution = await self._service.cancel_execution(
            tenant_id=str(command.tenant_id),
            execution_id=str(command.execution_id),
            reason=command.reason,
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class RetryExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: RetryExecutionCommand) -> dict[str, Any]:
        execution = await self._service.retry_execution(
            tenant_id=str(command.tenant_id),
            execution_id=str(command.execution_id),
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class TimeoutExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: TimeoutExecutionCommand) -> dict[str, Any]:
        execution = await self._service.timeout_execution(
            tenant_id=str(command.tenant_id),
            execution_id=str(command.execution_id),
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class CheckpointExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: CheckpointExecutionCommand) -> dict[str, Any]:
        execution = await self._service.checkpoint_execution(
            tenant_id=str(command.tenant_id),
            execution_id=str(command.execution_id),
            state_snapshot=command.state_snapshot,
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class ArchiveExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: ArchiveExecutionCommand) -> dict[str, Any]:
        execution = await self._service.archive_execution(
            tenant_id=str(command.tenant_id),
            execution_id=str(command.execution_id),
        )
        read_model = self._projector.project(execution)
        return read_model.model_dump(mode="json") if read_model else {}


class GetExecutionHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: GetExecutionQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            execution_id=str(query.execution_id),
        )
        return read_model.model_dump(mode="json") if read_model else None


class GetExecutionStatusHandler:
    def __init__(self, service: ProviderRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: GetExecutionStatusQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            execution_id=str(query.execution_id),
        )
        if read_model is None:
            return None
        return {"execution_id": read_model.execution_id, "status": read_model.status, "success": read_model.success}


class GetExecutionUsageHandler:
    def __init__(self, repository) -> None:
        self._repository = repository
        self._projector = ExecutionProjector()

    async def __call__(self, query: GetExecutionUsageQuery) -> dict[str, Any] | None:
        execution = await self._repository.get_by_id(
            tenant_id=str(query.tenant_id),
            execution_id=str(query.execution_id),
        )
        usage = self._projector.project_usage(execution)
        return usage.model_dump(mode="json") if usage else None


class GetExecutionArtifactsHandler:
    def __init__(self, repository) -> None:
        self._repository = repository
        self._projector = ExecutionProjector()

    async def __call__(self, query: GetExecutionArtifactsQuery) -> list[dict[str, Any]]:
        execution = await self._repository.get_by_id(
            tenant_id=str(query.tenant_id),
            execution_id=str(query.execution_id),
        )
        artifacts = self._projector.project_artifacts(execution)
        return [a.model_dump(mode="json") for a in artifacts]


class ExecutionMetricsHandler:
    def __init__(self, repository) -> None:
        self._repository = repository

    async def __call__(self, query: ExecutionMetricsQuery) -> dict[str, Any]:
        metrics = await self._repository.get_metrics(
            tenant_id=str(query.tenant_id),
            metric_date=query.metric_date,
        )
        return metrics.model_dump(mode="json")


class SearchExecutionsHandler:
    def __init__(self, repository) -> None:
        self._repository = repository
        self._projector = ExecutionProjector()

    async def __call__(self, query: SearchExecutionsQuery) -> list[dict[str, Any]]:
        executions = await self._repository.search(
            tenant_id=str(query.tenant_id),
            route_id=str(query.route_id) if query.route_id else None,
            plan_id=query.plan_id,
            request_id=str(query.request_id) if query.request_id else None,
            conversation_id=query.conversation_id,
            company_id=query.company_id,
            provider_id=query.provider_id,
            status=query.status,
            limit=query.limit,
        )
        return [self._projector.project(e).model_dump(mode="json") for e in executions if self._projector.project(e)]
