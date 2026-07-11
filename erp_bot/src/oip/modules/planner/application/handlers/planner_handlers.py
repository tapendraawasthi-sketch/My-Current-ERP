"""Planner command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    ArchiveExecutionPlanCommand,
    CancelExecutionPlanCommand,
    CreateExecutionPlanCommand,
    ExpireExecutionPlanCommand,
    ValidateExecutionPlanCommand,
)
from ..dto.planning_request import PlanningRequestDto
from ..queries import (
    GetExecutionPlanQuery,
    GetExecutionStatusQuery,
    GetExecutionStepsQuery,
    GetPlannerMetricsQuery,
    SearchExecutionPlansQuery,
)
from ..read_models.execution_plan_read_model import to_plan_read_model, to_step_read_models
from ..services.planner_service import PlannerService
from ...domain.value_objects import PlanningPolicyName


class CreateExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, command: CreateExecutionPlanCommand) -> dict[str, Any]:
        request = PlanningRequestDto(
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            tenant_id=str(command.tenant_id),
            company_id=command.company_id,
            branch_id=command.branch_id,
            user_id=command.user_id,
            session_id=command.session_id,
            conversation_id=command.conversation_id,
            module=command.module,
            language=command.language,
            message=command.message,
            policy_name=command.policy_name,
        )
        plan = await self._planner.create_plan(request)
        return to_plan_read_model(plan).model_dump(mode="json")


class ValidateExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, command: ValidateExecutionPlanCommand) -> dict[str, Any]:
        plan = await self._planner.validate_plan(
            tenant_id=str(command.tenant_id),
            plan_id=str(command.plan_id),
        )
        return to_plan_read_model(plan).model_dump(mode="json")


class CancelExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, command: CancelExecutionPlanCommand) -> dict[str, Any]:
        plan = await self._planner.cancel_plan(
            tenant_id=str(command.tenant_id),
            plan_id=str(command.plan_id),
            reason=command.reason,
        )
        return to_plan_read_model(plan).model_dump(mode="json")


class ExpireExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, command: ExpireExecutionPlanCommand) -> dict[str, Any]:
        plan = await self._planner.expire_plan(
            tenant_id=str(command.tenant_id),
            plan_id=str(command.plan_id),
        )
        return to_plan_read_model(plan).model_dump(mode="json")


class ArchiveExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, command: ArchiveExecutionPlanCommand) -> dict[str, Any]:
        plan = await self._planner.archive_plan(
            tenant_id=str(command.tenant_id),
            plan_id=str(command.plan_id),
        )
        return to_plan_read_model(plan).model_dump(mode="json")


class GetExecutionPlanHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, query: GetExecutionPlanQuery) -> dict[str, Any] | None:
        read_model = await self._planner.get_plan_read_model(
            tenant_id=str(query.tenant_id),
            plan_id=str(query.plan_id),
        )
        return read_model.model_dump(mode="json") if read_model else None


class GetExecutionStepsHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, query: GetExecutionStepsQuery) -> list[dict[str, Any]]:
        steps = await self._planner.get_steps_read_model(
            tenant_id=str(query.tenant_id),
            plan_id=str(query.plan_id),
        )
        return [step.model_dump(mode="json") for step in steps]


class GetExecutionStatusHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, query: GetExecutionStatusQuery) -> dict[str, Any] | None:
        read_model = await self._planner.get_plan_read_model(
            tenant_id=str(query.tenant_id),
            plan_id=str(query.plan_id),
        )
        if read_model is None:
            return None
        return {
            "plan_id": read_model.plan_id,
            "status": read_model.status,
            "step_count": read_model.step_count,
            "estimated_latency_ms": read_model.estimated_latency_ms,
        }


class SearchExecutionPlansHandler:
    def __init__(self, repository) -> None:
        self._repository = repository

    async def __call__(self, query: SearchExecutionPlansQuery) -> list[dict[str, Any]]:
        plans = await self._repository.search(
            tenant_id=str(query.tenant_id),
            company_id=query.company_id,
            conversation_id=query.conversation_id,
            request_id=str(query.request_id) if query.request_id else None,
            status=query.status,
            limit=query.limit,
        )
        return [to_plan_read_model(plan).model_dump(mode="json") for plan in plans]


class GetPlannerMetricsHandler:
    def __init__(self, planner: PlannerService) -> None:
        self._planner = planner

    async def __call__(self, query: GetPlannerMetricsQuery) -> dict[str, Any]:
        metrics = await self._planner.get_metrics(
            tenant_id=str(query.tenant_id),
            metric_date=query.metric_date,
        )
        return metrics.model_dump(mode="json")
