"""ExecutionIntent assembly — registry-based, no switches."""

from __future__ import annotations

from .....integration.contracts.execution_intent_registry import ExecutionIntentRegistry
from .context import PlanningContext


class ExecutionIntentAssemblyStage:
    name = "execution_intent_assembly"

    def __init__(self, registry: ExecutionIntentRegistry) -> None:
        self._registry = registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        confidence = context.task_profile.confidence if context.task_profile else 0.5
        context.execution_intent = self._registry.resolve(
            source_intent=context.intent,
            confidence=confidence,
            metadata={
                "module": context.request.module,
                "request_id": context.request.request_id,
            },
        )
        return context
