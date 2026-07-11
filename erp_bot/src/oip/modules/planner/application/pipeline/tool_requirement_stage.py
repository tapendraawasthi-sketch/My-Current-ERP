"""Tool requirement detection stage."""

from __future__ import annotations

from ..ports.tool_registry_port import ToolRegistryPort
from .context import PlanningContext


class ToolRequirementStage:
    name = "tool_requirement_detection"

    def __init__(self, tool_registry: ToolRegistryPort) -> None:
        self._tool_registry = tool_registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        context.tool_requirements = self._tool_registry.detect_requirements(
            intent=context.intent,
            module=context.request.module,
            message=context.normalized_message,
        )
        return context
