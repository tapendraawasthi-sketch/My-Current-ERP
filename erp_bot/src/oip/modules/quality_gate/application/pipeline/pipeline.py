"""Quality Gate pipeline orchestrator."""

from __future__ import annotations

from ....provider_runtime.domain.entities import ExecutionAggregate
from ....provider_runtime.domain.value_objects import ExecutionResult
from ...domain.value_objects import QualityLevel
from .context import QualityPipelineContext
from .stages import QualityStage


class QualityGatePipeline:
    def __init__(self, stages: tuple[QualityStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(
        self,
        *,
        evaluation_id: str,
        execution: ExecutionAggregate,
        execution_result: ExecutionResult,
        minimum_gate: QualityLevel,
        l3_enabled: bool,
        validation_context: dict | None = None,
    ) -> QualityPipelineContext:
        context = QualityPipelineContext(
            evaluation_id=evaluation_id,
            execution=execution,
            execution_result=execution_result,
            minimum_gate=minimum_gate,
            l3_enabled=l3_enabled,
            validation_context=validation_context or {},
        )
        for stage in self._stages:
            context = await stage.run(context)
        return context
