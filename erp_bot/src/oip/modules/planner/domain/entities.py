"""Planner domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ....integration.contracts.execution_intent import ExecutionIntent
from .value_objects import (
    ContextBudget,
    ExecutionMode,
    ExecutionPriority,
    ExecutionStepType,
    FallbackPolicy,
    PlanStatus,
    PlanningPolicyName,
    SkillRequirement,
    TaskProfile,
    ToolRequirement,
)


class ExecutionGoal(BaseModel):
    model_config = ConfigDict(frozen=True)

    objective: str
    success_criteria: tuple[str, ...] = Field(default_factory=tuple)
    output_type: str = "actions"
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExecutionConstraint(BaseModel):
    model_config = ConfigDict(frozen=True)

    constraint_id: str
    plan_id: str
    tenant_id: str
    max_latency_ms: int | None = None
    max_tokens: int | None = None
    max_cost_micros: int | None = None
    offline_only: bool = False
    provider_restrictions: tuple[str, ...] = Field(default_factory=tuple)
    tool_restrictions: tuple[str, ...] = Field(default_factory=tuple)
    knowledge_restrictions: tuple[str, ...] = Field(default_factory=tuple)
    fiscal_restrictions: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ExecutionBudget(BaseModel):
    model_config = ConfigDict(frozen=True)

    budget_id: str
    plan_id: str
    tenant_id: str
    total_tokens: int = 0
    total_latency_ms: int = 0
    total_cost_micros: int = 0
    context_budget: ContextBudget = Field(default_factory=ContextBudget)
    created_at: datetime


class ExecutionStep(BaseModel):
    model_config = ConfigDict(frozen=True)

    step_id: str
    plan_id: str
    tenant_id: str
    sequence_no: int
    step_type: ExecutionStepType
    name: str
    payload: dict[str, Any] = Field(default_factory=dict)
    depends_on: tuple[str, ...] = Field(default_factory=tuple)
    estimated_tokens: int = 0
    estimated_latency_ms: int = 0
    created_at: datetime


class ExecutionPlan(BaseModel):
    model_config = ConfigDict(frozen=True)

    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    module: str
    intent: str
    execution_intent: ExecutionIntent | None = None
    execution_mode: ExecutionMode
    priority: ExecutionPriority
    status: PlanStatus
    policy_name: PlanningPolicyName
    task_profile: TaskProfile
    goal: ExecutionGoal
    estimated_tokens: int = 0
    estimated_latency_ms: int = 0
    estimated_cost_micros: int = 0
    knowledge_required: bool = False
    memory_required: bool = False
    tool_requirements: tuple[ToolRequirement, ...] = Field(default_factory=tuple)
    skills: tuple[SkillRequirement, ...] = Field(default_factory=tuple)
    steps: tuple[ExecutionStep, ...] = Field(default_factory=tuple)
    constraints: ExecutionConstraint | None = None
    budget: ExecutionBudget | None = None
    stop_conditions: tuple[str, ...] = Field(default_factory=tuple)
    fallback_policy: FallbackPolicy = Field(default_factory=FallbackPolicy)
    context_budget: ContextBudget = Field(default_factory=ContextBudget)
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None = None
    expired_at: datetime | None = None
    cancelled_at: datetime | None = None
    archived_at: datetime | None = None


class ExecutionResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    plan_id: str
    request_id: str
    status: str
    completed_steps: int = 0
    total_steps: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
