"""Stage port instrumentation — trace workflow stages without modifying runtime internals."""

from __future__ import annotations

from typing import Any

from ...modules.orchestrator.application.dto.stage_result import StageResult
from ...modules.orchestrator.application.dto.workflow_context import WorkflowContext
from ...modules.orchestrator.application.ports.workflow_stage_port import WorkflowStagePort
from ...modules.orchestrator.infrastructure.adapters.stage_port_registry import StagePortRegistry
from .tracing import span


class TracedStageAdapter(WorkflowStagePort):
    def __init__(self, inner: WorkflowStagePort) -> None:
        self._inner = inner

    @property
    def name(self) -> str:
        return self._inner.name

    async def validate(self, context: WorkflowContext) -> StageResult:
        with span(f"stage.{self.name}.validate", stage=self.name):
            return await self._inner.validate(context)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        with span(f"stage.{self.name}", stage=self.name):
            return await self._inner.execute(context)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        with span(f"stage.{self.name}.rollback", stage=self.name):
            return await self._inner.rollback(context)

    def metrics(self) -> dict[str, Any]:
        return self._inner.metrics()

    def supports_retry(self) -> bool:
        return self._inner.supports_retry()


def instrument_stage_registry(registry: StagePortRegistry) -> StagePortRegistry:
    traced = StagePortRegistry()
    for name in registry.all_names():
        port = registry.get(name)
        if port is not None:
            traced.register(TracedStageAdapter(port))
    return traced
