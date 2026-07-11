"""Memory store pipeline orchestrator."""

from __future__ import annotations

from .context import StorePipelineContext
from .stages import MemoryStage


class MemoryStorePipeline:
    def __init__(self, stages: tuple[MemoryStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(self, context: StorePipelineContext) -> StorePipelineContext:
        for stage in self._stages:
            context = await stage.run(context)
        return context
