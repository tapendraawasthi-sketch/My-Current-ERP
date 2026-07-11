"""Execution pipeline orchestrator."""

from __future__ import annotations

from .context import ExecutionPipelineContext
from .stages import ExecutionStage
from ....router.domain.entities import RouteDecision
from ...domain.value_objects import ExecutionPolicyName


class ExecutionPipeline:
    def __init__(self, stages: tuple[ExecutionStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(
        self,
        *,
        route: RouteDecision,
        policy_name: ExecutionPolicyName,
        execution,
        streaming_enabled: bool = True,
    ) -> ExecutionPipelineContext:
        context = ExecutionPipelineContext(
            route=route,
            policy_name=policy_name,
            execution=execution,
            streaming_enabled=streaming_enabled,
        )
        for stage in self._stages:
            context = await stage.run(context)
        return context
