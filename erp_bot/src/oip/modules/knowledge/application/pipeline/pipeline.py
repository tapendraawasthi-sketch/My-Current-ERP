"""Knowledge retrieval pipeline orchestrator."""

from __future__ import annotations

from .context import RetrievalPipelineContext
from .stages import KnowledgeStage


class KnowledgeRetrievalPipeline:
    def __init__(self, stages: tuple[KnowledgeStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        for stage in self._stages:
            context = await stage.run(context)
        return context
