"""Planning pipeline orchestrator."""

from __future__ import annotations

from .context import PlanningContext
from .stage import PlanningStage
from ..dto.planning_request import PlanningRequestDto


class PlanningPipeline:
    def __init__(self, stages: tuple[PlanningStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(self, request: PlanningRequestDto) -> PlanningContext:
        context = PlanningContext(request=request)
        for stage in self._stages:
            context = await stage.run(context)
        return context
