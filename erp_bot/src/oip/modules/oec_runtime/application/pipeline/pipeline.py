"""OEC execution pipeline orchestrator."""

from __future__ import annotations

from .context import ExecutionPipelineContext
from .stages import OecStage


class OecExecutionPipeline:
    def __init__(self, stages: tuple[OecStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        for stage in self._stages:
            context = await stage.run(context)
        return context
