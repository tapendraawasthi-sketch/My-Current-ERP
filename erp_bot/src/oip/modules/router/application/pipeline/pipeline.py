"""Routing pipeline orchestrator."""

from __future__ import annotations

from .context import RoutingContext
from .stages import RoutingStage
from ....planner.domain.entities import ExecutionPlan
from ...domain.value_objects import RoutingPolicyName


class RoutingPipeline:
    def __init__(self, stages: tuple[RoutingStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(
        self,
        *,
        plan: ExecutionPlan,
        routing_policy: RoutingPolicyName,
        edition: str,
        deployment_mode: str,
    ) -> RoutingContext:
        context = RoutingContext(
            plan=plan,
            routing_policy_name=routing_policy,
            edition=edition,
            deployment_mode=deployment_mode,
        )
        for stage in self._stages:
            context = await stage.run(context)
        return context
