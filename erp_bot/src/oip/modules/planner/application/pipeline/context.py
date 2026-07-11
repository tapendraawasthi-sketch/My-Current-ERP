"""Planning pipeline context — mutable between stages, frozen plan at end."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .....integration.contracts.execution_intent import ExecutionIntent
from ...domain.entities import ExecutionBudget, ExecutionConstraint, ExecutionGoal, ExecutionStep
from ...domain.value_objects import (
    ContextBudget,
    PlanningPolicy,
    SkillRequirement,
    TaskProfile,
    ToolRequirement,
)
from ..dto.planning_request import PlanningRequestDto


@dataclass
class PlanningContext:
    request: PlanningRequestDto
    normalized_message: str = ""
    intent: str = "general_query"
    task_profile: TaskProfile | None = None
    goal: ExecutionGoal | None = None
    policy: PlanningPolicy | None = None
    constraints: ExecutionConstraint | None = None
    tool_requirements: tuple[ToolRequirement, ...] = field(default_factory=tuple)
    skills: tuple[SkillRequirement, ...] = field(default_factory=tuple)
    knowledge_required: bool = False
    memory_required: bool = False
    context_budget: ContextBudget | None = None
    budget: ExecutionBudget | None = None
    steps: tuple[ExecutionStep, ...] = field(default_factory=tuple)
    capability_analysis: dict[str, Any] = field(default_factory=dict)
    stop_conditions: tuple[str, ...] = field(default_factory=tuple)
    execution_intent: ExecutionIntent | None = None
