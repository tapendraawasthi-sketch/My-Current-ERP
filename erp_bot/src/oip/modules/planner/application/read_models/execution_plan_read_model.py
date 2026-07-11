"""Planner read models — replay-safe projections."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ...domain.entities import ExecutionPlan


class ExecutionStepReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    step_id: str
    plan_id: str
    sequence_no: int
    step_type: str
    name: str
    depends_on: tuple[str, ...] = Field(default_factory=tuple)
    estimated_tokens: int = 0
    estimated_latency_ms: int = 0
    payload: dict[str, Any] = Field(default_factory=dict)


class ExecutionPlanReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    module: str
    intent: str
    execution_mode: str
    priority: str
    status: str
    policy_name: str
    estimated_tokens: int
    estimated_latency_ms: int
    estimated_cost_micros: int
    knowledge_required: bool
    memory_required: bool
    step_count: int
    tool_requirements: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    stop_conditions: tuple[str, ...] = Field(default_factory=tuple)
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None = None


class PlannerMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    plans_created: int = 0
    plans_validated: int = 0
    plans_cancelled: int = 0
    plans_expired: int = 0
    plans_archived: int = 0
    avg_estimated_latency_ms: float = 0.0
    avg_estimated_tokens: float = 0.0


def to_plan_read_model(plan: ExecutionPlan) -> ExecutionPlanReadModel:
    return ExecutionPlanReadModel(
        plan_id=plan.plan_id,
        request_id=plan.request_id,
        tenant_id=plan.tenant_id,
        company_id=plan.company_id,
        conversation_id=plan.conversation_id,
        correlation_id=plan.correlation_id,
        module=plan.module,
        intent=plan.intent,
        execution_mode=plan.execution_mode.value,
        priority=plan.priority.value,
        status=plan.status.value,
        policy_name=plan.policy_name.value,
        estimated_tokens=plan.estimated_tokens,
        estimated_latency_ms=plan.estimated_latency_ms,
        estimated_cost_micros=plan.estimated_cost_micros,
        knowledge_required=plan.knowledge_required,
        memory_required=plan.memory_required,
        step_count=len(plan.steps),
        tool_requirements=[t.model_dump(mode="json") for t in plan.tool_requirements],
        skills=[s.model_dump(mode="json") for s in plan.skills],
        stop_conditions=plan.stop_conditions,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        validated_at=plan.validated_at,
    )


def to_step_read_models(plan: ExecutionPlan) -> list[ExecutionStepReadModel]:
    return [
        ExecutionStepReadModel(
            step_id=step.step_id,
            plan_id=step.plan_id,
            sequence_no=step.sequence_no,
            step_type=step.step_type.value,
            name=step.name,
            depends_on=step.depends_on,
            estimated_tokens=step.estimated_tokens,
            estimated_latency_ms=step.estimated_latency_ms,
            payload=step.payload,
        )
        for step in plan.steps
    ]
