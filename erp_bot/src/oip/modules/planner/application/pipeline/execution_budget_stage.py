"""Execution budget allocation stage."""

from __future__ import annotations

from ..ports.execution_budget_port import ExecutionBudgetPort
from ..ports.skill_registry_port import SkillRegistryPort
from .context import PlanningContext


class ExecutionBudgetStage:
    name = "execution_budget"

    def __init__(
        self,
        budget_port: ExecutionBudgetPort,
        skill_registry: SkillRegistryPort,
    ) -> None:
        self._budget_port = budget_port
        self._skill_registry = skill_registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        context.skills = self._skill_registry.resolve_skills(
            intent=context.intent,
            module=context.request.module,
        )
        if context.policy is None or context.context_budget is None or context.task_profile is None:
            return context
        context.budget = self._budget_port.allocate(
            plan_id="pending",
            tenant_id=context.request.tenant_id,
            policy=context.policy,
            task_profile=context.task_profile,
            context_budget=context.context_budget,
            message_token_estimate=context.context_budget.user_input_tokens,
        )
        return context
