"""Action Runtime pipeline orchestrator."""

from __future__ import annotations

from .....integration.contracts.execution_intent import ExecutionIntent
from ....provider_runtime.domain.entities import ExecutionAggregate
from ....quality_gate.domain.entities import QualityEvaluation
from ...domain.entities import ActionExecution
from ...domain.value_objects import ActionRuntimeType
from .context import ActionPipelineContext
from .stages import ActionStage


class ActionRuntimePipeline:
    def __init__(self, stages: tuple[ActionStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(
        self,
        *,
        action: ActionExecution,
        execution: ExecutionAggregate,
        evaluation: QualityEvaluation,
        action_type: ActionRuntimeType,
        execution_intent: ExecutionIntent | None = None,
        runtime_context: dict | None = None,
        execute: bool = True,
    ) -> ActionPipelineContext:
        context = ActionPipelineContext(
            action=action,
            execution=execution,
            evaluation=evaluation,
            action_type=action_type,
            execution_intent=execution_intent,
            runtime_context=runtime_context or {},
            execute=execute,
        )
        for stage in self._stages:
            context = await stage.run(context)
        return context
