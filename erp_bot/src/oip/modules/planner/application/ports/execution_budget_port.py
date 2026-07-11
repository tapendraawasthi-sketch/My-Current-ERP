"""Execution budget port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.entities import ExecutionBudget
from ...domain.value_objects import ContextBudget, PlanningPolicy, TaskProfile


class ExecutionBudgetPort(ABC):
    @abstractmethod
    def allocate(
        self,
        *,
        plan_id: str,
        tenant_id: str,
        policy: PlanningPolicy,
        task_profile: TaskProfile,
        context_budget: ContextBudget,
        message_token_estimate: int,
    ) -> ExecutionBudget:
        """Allocate execution budget dynamically based on capabilities."""
