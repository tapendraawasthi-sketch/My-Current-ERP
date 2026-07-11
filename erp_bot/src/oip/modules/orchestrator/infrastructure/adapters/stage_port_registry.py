"""Registry mapping stage names to WorkflowStagePort implementations."""

from __future__ import annotations

from ...application.ports.workflow_stage_port import WorkflowStagePort


class StagePortRegistry:
    def __init__(self) -> None:
        self._stages: dict[str, WorkflowStagePort] = {}

    def register(self, stage: WorkflowStagePort) -> None:
        self._stages[stage.name] = stage

    def get(self, name: str) -> WorkflowStagePort | None:
        return self._stages.get(name)

    def ordered(self, names: tuple[str, ...]) -> tuple[WorkflowStagePort, ...]:
        return tuple(self._stages[n] for n in names if n in self._stages)

    def all_names(self) -> tuple[str, ...]:
        return tuple(sorted(self._stages.keys()))
