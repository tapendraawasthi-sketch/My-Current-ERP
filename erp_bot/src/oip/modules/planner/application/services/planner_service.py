"""Planner application service — produces immutable ExecutionPlan."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....domain.events import DomainEventEnvelope
from ...domain.entities import ExecutionBudget, ExecutionConstraint, ExecutionGoal, ExecutionPlan, ExecutionStep
from ...domain.value_objects import ExecutionMode, ExecutionPriority
from ...domain.events import (
    ExecutionPlanArchivedEvent,
    ExecutionPlanCancelledEvent,
    ExecutionPlanCreatedEvent,
    ExecutionPlanExpiredEvent,
    ExecutionPlanValidatedEvent,
    build_plan_event,
)
from ...domain.value_objects import ContextBudget, FallbackPolicy, PlanStatus, TaskProfile
from ..dto.planning_request import PlanningRequestDto
from ..pipeline.pipeline import PlanningPipeline
from ..ports.execution_plan_repository_port import ExecutionPlanRepositoryPort
from ..ports.planner_port import PlannerPort
from ..read_models.execution_plan_read_model import (
    ExecutionPlanReadModel,
    ExecutionStepReadModel,
    PlannerMetricsReadModel,
    to_plan_read_model,
    to_step_read_models,
)
from .....infrastructure.observability.logging import log_event

_OIP_CHAT_DEBUG = os.getenv("OIP_CHAT_DEBUG", "false").lower() in {"1", "true", "yes"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PlannerService(PlannerPort):
    def __init__(
        self,
        *,
        pipeline: PlanningPipeline,
        repository: ExecutionPlanRepositoryPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service

    async def create_plan(self, request: PlanningRequestDto) -> ExecutionPlan:
        context = await self._pipeline.execute(request)
        now = _utc_now()
        plan_id = str(uuid.uuid4())

        constraints = self._finalize_constraints(context.constraints, plan_id)
        budget = self._finalize_budget(context.budget, plan_id)
        steps = self._finalize_steps(context.steps, plan_id)

        estimated_tokens = sum(step.estimated_tokens for step in steps)
        estimated_latency = sum(step.estimated_latency_ms for step in steps)
        if budget:
            estimated_tokens = max(estimated_tokens, budget.total_tokens)
            estimated_latency = max(estimated_latency, budget.total_latency_ms)

        policy = context.policy
        task_profile = context.task_profile or TaskProfile(
            intent=context.intent,
            module=request.module,
        )
        goal = context.goal or ExecutionGoal(objective=f"Fulfill intent: {context.intent}")
        context_budget = context.context_budget or ContextBudget()

        plan = ExecutionPlan(
            plan_id=plan_id,
            request_id=request.request_id,
            tenant_id=request.tenant_id,
            company_id=request.company_id,
            conversation_id=request.conversation_id,
            correlation_id=request.correlation_id,
            module=request.module,
            intent=context.intent,
            execution_intent=context.execution_intent,
            execution_mode=policy.execution_mode if policy else ExecutionMode.INTERACTIVE,
            priority=policy.priority if policy else ExecutionPriority.NORMAL,
            status=PlanStatus.DRAFT,
            policy_name=request.policy_name,
            task_profile=task_profile,
            goal=goal,
            estimated_tokens=estimated_tokens,
            estimated_latency_ms=estimated_latency,
            estimated_cost_micros=budget.total_cost_micros if budget else 0,
            knowledge_required=context.knowledge_required,
            memory_required=context.memory_required,
            tool_requirements=context.tool_requirements,
            skills=context.skills,
            steps=steps,
            constraints=constraints,
            budget=budget,
            stop_conditions=context.stop_conditions,
            fallback_policy=FallbackPolicy(),
            context_budget=context_budget,
            created_at=now,
            updated_at=now,
        )

        await self._repository.save(plan)
        await self._emit(
            ExecutionPlanCreatedEvent,
            plan,
            {"intent": plan.intent, "step_count": len(plan.steps), "execution_intent": plan.execution_intent.model_dump(mode="json") if plan.execution_intent else None},
        )
        await self._repository.increment_metrics(
            tenant_id=plan.tenant_id,
            metric="plans_created",
            estimated_latency_ms=plan.estimated_latency_ms,
            estimated_tokens=plan.estimated_tokens,
        )
        await self._record_lineage(plan, request)
        await self._audit_mutation(plan, "planner.plan.created")
        if _OIP_CHAT_DEBUG:
            log_event(
                "oip.planner.output",
                plan_id=plan.plan_id,
                intent=plan.intent,
                user_message=plan.goal.metadata.get("user_message") if plan.goal else None,
                execution_intent_type=plan.execution_intent.intent_type if plan.execution_intent else plan.intent,
            )
        return plan

    async def validate_plan(self, *, tenant_id: str, plan_id: str) -> ExecutionPlan:
        plan = await self._require_plan(tenant_id, plan_id)
        if plan.status not in {PlanStatus.DRAFT, PlanStatus.ACTIVE}:
            return plan
        now = _utc_now()
        validated = plan.model_copy(
            update={"status": PlanStatus.VALIDATED, "validated_at": now, "updated_at": now}
        )
        await self._repository.save(validated)
        await self._emit(ExecutionPlanValidatedEvent, validated, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="plans_validated")
        await self._audit_mutation(validated, "planner.plan.validated")
        return validated

    async def cancel_plan(self, *, tenant_id: str, plan_id: str, reason: str = "") -> ExecutionPlan:
        plan = await self._require_plan(tenant_id, plan_id)
        if plan.status in {PlanStatus.CANCELLED, PlanStatus.ARCHIVED}:
            return plan
        now = _utc_now()
        cancelled = plan.model_copy(
            update={"status": PlanStatus.CANCELLED, "cancelled_at": now, "updated_at": now}
        )
        await self._repository.save(cancelled)
        await self._emit(ExecutionPlanCancelledEvent, cancelled, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="plans_cancelled")
        await self._audit_mutation(cancelled, "planner.plan.cancelled", {"reason": reason})
        return cancelled

    async def expire_plan(self, *, tenant_id: str, plan_id: str) -> ExecutionPlan:
        plan = await self._require_plan(tenant_id, plan_id)
        if plan.status == PlanStatus.EXPIRED:
            return plan
        now = _utc_now()
        expired = plan.model_copy(
            update={"status": PlanStatus.EXPIRED, "expired_at": now, "updated_at": now}
        )
        await self._repository.save(expired)
        await self._emit(ExecutionPlanExpiredEvent, expired, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="plans_expired")
        await self._audit_mutation(expired, "planner.plan.expired")
        return expired

    async def archive_plan(self, *, tenant_id: str, plan_id: str) -> ExecutionPlan:
        plan = await self._require_plan(tenant_id, plan_id)
        if plan.status == PlanStatus.ARCHIVED:
            return plan
        now = _utc_now()
        archived = plan.model_copy(
            update={"status": PlanStatus.ARCHIVED, "archived_at": now, "updated_at": now}
        )
        await self._repository.save(archived)
        await self._emit(ExecutionPlanArchivedEvent, archived, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="plans_archived")
        await self._audit_mutation(archived, "planner.plan.archived")
        return archived

    async def get_plan_read_model(self, *, tenant_id: str, plan_id: str) -> ExecutionPlanReadModel | None:
        plan = await self._repository.get_by_id(tenant_id=tenant_id, plan_id=plan_id)
        return to_plan_read_model(plan) if plan else None

    async def get_steps_read_model(self, *, tenant_id: str, plan_id: str) -> list[ExecutionStepReadModel]:
        plan = await self._repository.get_by_id(tenant_id=tenant_id, plan_id=plan_id)
        if plan is None:
            return []
        return to_step_read_models(plan)

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> PlannerMetricsReadModel:
        return await self._repository.get_metrics(tenant_id=tenant_id, metric_date=metric_date)

    async def _require_plan(self, tenant_id: str, plan_id: str) -> ExecutionPlan:
        plan = await self._repository.get_by_id(tenant_id=tenant_id, plan_id=plan_id)
        if plan is None:
            raise ValueError(f"Execution plan not found: {plan_id}")
        return plan

    async def _emit(self, event_cls, plan: ExecutionPlan, payload: dict) -> None:
        event = build_plan_event(
            event_cls,
            tenant_id=plan.tenant_id,
            correlation_id=plan.correlation_id,
            company_id=plan.company_id,
            plan_id=plan.plan_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _audit_mutation(self, plan: ExecutionPlan, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=plan.tenant_id,
            request_id=plan.request_id,
            correlation_id=plan.correlation_id,
            event_name=event_name,
            payload_redacted={"plan_id": plan.plan_id, "status": plan.status.value, **(extra or {})},
        )

    async def _record_lineage(self, plan: ExecutionPlan, request: PlanningRequestDto) -> None:
        planner_node = await self._lineage.append_node(
            tenant_id=plan.tenant_id,
            request_id=plan.request_id,
            node_type="Planner",
            payload={"intent": plan.intent, "policy": plan.policy_name.value},
        )
        plan_node = await self._lineage.append_node(
            tenant_id=plan.tenant_id,
            request_id=plan.request_id,
            node_type="ExecutionPlan",
            parent_node_id=planner_node.node_id,
            payload={"plan_id": plan.plan_id, "step_count": len(plan.steps)},
        )
        for step in plan.steps:
            await self._lineage.append_node(
                tenant_id=plan.tenant_id,
                request_id=plan.request_id,
                node_type="ExecutionStep",
                parent_node_id=plan_node.node_id,
                payload={
                    "plan_id": plan.plan_id,
                    "step_id": step.step_id,
                    "step_type": step.step_type.value,
                    "sequence_no": step.sequence_no,
                },
            )

    @staticmethod
    def _finalize_constraints(
        constraints: ExecutionConstraint | None,
        plan_id: str,
    ) -> ExecutionConstraint | None:
        if constraints is None:
            return None
        return constraints.model_copy(update={"plan_id": plan_id})

    @staticmethod
    def _finalize_budget(budget: ExecutionBudget | None, plan_id: str) -> ExecutionBudget | None:
        if budget is None:
            return None
        return budget.model_copy(update={"plan_id": plan_id})

    @staticmethod
    def _finalize_steps(steps: tuple[ExecutionStep, ...], plan_id: str) -> tuple[ExecutionStep, ...]:
        return tuple(step.model_copy(update={"plan_id": plan_id}) for step in steps)
