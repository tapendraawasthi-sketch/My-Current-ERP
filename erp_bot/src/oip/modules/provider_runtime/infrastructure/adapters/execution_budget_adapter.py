"""Execution budget adapter."""

from __future__ import annotations

import uuid

from ...application.ports.execution_ports import ExecutionBudgetPort
from ...domain.value_objects import ExecutionBudget


class DefaultExecutionBudgetAdapter(ExecutionBudgetPort):
    async def allocate(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        max_tokens: int,
        max_cost_micros: int,
        max_latency_ms: int,
    ) -> ExecutionBudget:
        return ExecutionBudget(
            budget_id=str(uuid.uuid4()),
            execution_id=execution_id,
            tenant_id=tenant_id,
            allocated_tokens=max_tokens,
            allocated_cost_micros=max_cost_micros,
            allocated_latency_ms=max_latency_ms,
            remaining_tokens=max_tokens,
            remaining_cost_micros=max_cost_micros,
        )

    async def validate(self, *, budget: ExecutionBudget) -> bool:
        return not budget.exceeded and budget.remaining_tokens >= 0 and budget.remaining_cost_micros >= 0
