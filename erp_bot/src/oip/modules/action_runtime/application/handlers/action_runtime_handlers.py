"""Action Runtime handlers."""

from __future__ import annotations

from typing import Any

from .....integration.contracts.execution_intent import ExecutionIntent
from ..commands import ApproveActionCommand, CancelActionCommand, ProposeActionCommand, RejectActionCommand
from ..projectors.action_runtime_projectors import ActionExecutionProjector, ActionMetricsProjector
from ..queries import ActionMetricsQuery, GetActionQuery, SearchActionsQuery
from ..services.action_runtime_service import ActionRuntimeService
from ...infrastructure.persistence.action_sqlite import SqliteActionRepositoryAdapter


class ProposeActionHandler:
    def __init__(self, service: ActionRuntimeService) -> None:
        self._service = service
        self._projector = ActionExecutionProjector()

    async def __call__(self, command: ProposeActionCommand) -> dict[str, Any]:
        execution_intent = ExecutionIntent.from_dict(command.metadata.get("execution_intent"))
        action = await self._service.propose_action(
            evaluation_id=str(command.evaluation_id),
            tenant_id=str(command.tenant_id),
            execution_intent=execution_intent,
            action_type=command.action_type or None,
            payload=command.payload,
            user_id=command.user_id,
            idempotency_key=command.idempotency_key or None,
            auto_execute=command.auto_execute,
            runtime_context=command.metadata.get("runtime_context"),
        )
        read_model = self._projector.project(action)
        return read_model.model_dump(mode="json") if read_model else {}


class ApproveActionHandler:
    def __init__(self, service: ActionRuntimeService) -> None:
        self._service = service
        self._projector = ActionExecutionProjector()

    async def __call__(self, command: ApproveActionCommand) -> dict[str, Any]:
        action = await self._service.approve_action(
            tenant_id=str(command.tenant_id),
            action_id=str(command.action_id),
            approver_id=command.approver_id,
        )
        read_model = self._projector.project(action)
        return read_model.model_dump(mode="json") if read_model else {}


class RejectActionHandler:
    def __init__(self, service: ActionRuntimeService) -> None:
        self._service = service
        self._projector = ActionExecutionProjector()

    async def __call__(self, command: RejectActionCommand) -> dict[str, Any]:
        action = await self._service.reject_action(
            tenant_id=str(command.tenant_id),
            action_id=str(command.action_id),
            approver_id=command.approver_id,
            reason=command.reason,
        )
        read_model = self._projector.project(action)
        return read_model.model_dump(mode="json") if read_model else {}


class CancelActionHandler:
    def __init__(self, service: ActionRuntimeService) -> None:
        self._service = service
        self._projector = ActionExecutionProjector()

    async def __call__(self, command: CancelActionCommand) -> dict[str, Any]:
        action = await self._service.cancel_action(
            tenant_id=str(command.tenant_id),
            action_id=str(command.action_id),
            reason=command.reason,
        )
        read_model = self._projector.project(action)
        return read_model.model_dump(mode="json") if read_model else {}


class GetActionHandler:
    def __init__(self, service: ActionRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: GetActionQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            action_id=str(query.action_id),
        )
        return read_model.model_dump(mode="json") if read_model else None


class ActionMetricsHandler:
    def __init__(self, repository: SqliteActionRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = ActionMetricsProjector()

    async def __call__(self, query: ActionMetricsQuery) -> dict[str, Any]:
        metrics = await self._repository.get_metrics(tenant_id=str(query.tenant_id), metric_date=query.metric_date)
        return self._projector.project(metrics).model_dump(mode="json")


class SearchActionsHandler:
    def __init__(self, repository: SqliteActionRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = ActionExecutionProjector()

    async def __call__(self, query: SearchActionsQuery) -> list[dict[str, Any]]:
        actions = await self._repository.search(
            tenant_id=str(query.tenant_id),
            execution_id=str(query.execution_id) if query.execution_id else None,
            evaluation_id=str(query.evaluation_id) if query.evaluation_id else None,
            request_id=str(query.request_id) if query.request_id else None,
            status=query.status,
            limit=query.limit,
        )
        return [
            rm.model_dump(mode="json")
            for a in actions
            if (rm := self._projector.project(a)) is not None
        ]
