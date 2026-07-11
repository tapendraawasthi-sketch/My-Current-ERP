"""Default execution budget adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ...application.ports.execution_budget_port import ExecutionBudgetPort
from ...domain.entities import ExecutionBudget
from ...domain.value_objects import ContextBudget, PlanningPolicy, TaskProfile


class DefaultExecutionBudgetAdapter(ExecutionBudgetPort):
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
        complexity_multiplier = {"low": 1.0, "medium": 1.2, "high": 1.5}.get(task_profile.complexity, 1.2)
        total_tokens = min(
            int(context_budget.total_tokens * complexity_multiplier),
            policy.max_tokens,
        )
        total_latency = min(
            int(1500 + total_tokens * 2 * complexity_multiplier),
            policy.max_latency_ms,
        )
        cost_per_token = 10 if policy.name.value == "low_cost" else 25
        total_cost = min(total_tokens * cost_per_token, policy.max_cost_micros or total_tokens * cost_per_token)
        return ExecutionBudget(
            budget_id=str(uuid.uuid4()),
            plan_id=plan_id,
            tenant_id=tenant_id,
            total_tokens=total_tokens,
            total_latency_ms=total_latency,
            total_cost_micros=total_cost,
            context_budget=context_budget,
            created_at=datetime.now(timezone.utc),
        )
