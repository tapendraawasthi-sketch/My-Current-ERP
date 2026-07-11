"""Registry-based workflow stage resolution — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import RollbackPolicy, WorkflowStageName


@dataclass(frozen=True)
class StageDefinition:
    name: WorkflowStageName
    order: int
    rollback_policy: RollbackPolicy
    supports_retry: bool = True


class WorkflowStageRegistry:
    def __init__(self) -> None:
        self._stages: dict[str, StageDefinition] = {}

    def register(self, definition: StageDefinition) -> None:
        self._stages[definition.name.value] = definition

    def get(self, name: WorkflowStageName | str) -> StageDefinition | None:
        key = name.value if isinstance(name, WorkflowStageName) else name
        return self._stages.get(key)

    def ordered_stages(self) -> tuple[StageDefinition, ...]:
        return tuple(sorted(self._stages.values(), key=lambda s: s.order))

    def stage_names(self) -> tuple[str, ...]:
        return tuple(s.name.value for s in self.ordered_stages())


def create_default_stage_registry() -> WorkflowStageRegistry:
    registry = WorkflowStageRegistry()
    definitions = (
        StageDefinition(WorkflowStageName.VALIDATION, 10, RollbackPolicy.NONE, False),
        StageDefinition(WorkflowStageName.CONVERSATION, 20, RollbackPolicy.APPEND_FAILURE),
        StageDefinition(WorkflowStageName.SESSION, 30, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.PLANNING, 40, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.ROUTING, 50, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.KNOWLEDGE, 55, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.MEMORY_STORE, 57, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.EXECUTION, 60, RollbackPolicy.CANCEL),
        StageDefinition(WorkflowStageName.MEMORY_UPDATE, 65, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.QUALITY, 70, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.ACTION, 80, RollbackPolicy.COMPENSATE),
        StageDefinition(WorkflowStageName.MEMORY_CONSOLIDATION, 85, RollbackPolicy.NONE),
        StageDefinition(WorkflowStageName.STREAMING, 90, RollbackPolicy.CLOSE_STREAM, False),
        StageDefinition(WorkflowStageName.FINALIZE, 100, RollbackPolicy.NONE, False),
        StageDefinition(WorkflowStageName.PERSISTENCE, 110, RollbackPolicy.NONE, False),
        StageDefinition(WorkflowStageName.PUBLICATION, 120, RollbackPolicy.NONE, False),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
