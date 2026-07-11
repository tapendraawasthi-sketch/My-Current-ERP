"""Capability analysis stage."""

from __future__ import annotations

from ..ports.capability_registry_port import CapabilityRegistryPort
from .context import PlanningContext


class CapabilityAnalysisStage:
    name = "capability_analysis"

    def __init__(self, capabilities: CapabilityRegistryPort) -> None:
        self._capabilities = capabilities

    async def run(self, context: PlanningContext) -> PlanningContext:
        analysis = self._capabilities.analyze(
            intent=context.intent,
            module=context.request.module,
            message=context.normalized_message,
        )
        context.capability_analysis = analysis
        if context.task_profile is not None:
            profile = context.task_profile
            context.task_profile = profile.model_copy(
                update={
                    "requires_tools": profile.requires_tools or bool(analysis.get("tools")),
                    "requires_knowledge": profile.requires_knowledge
                    or bool(analysis.get("knowledge")),
                    "metadata": {**profile.metadata, "capabilities": analysis},
                }
            )
        return context
