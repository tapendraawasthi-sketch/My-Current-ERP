"""Context requirement detection stage."""

from __future__ import annotations

from .context import PlanningContext


class ContextRequirementStage:
    name = "context_requirement_detection"

    async def run(self, context: PlanningContext) -> PlanningContext:
        profile = context.task_profile
        context.memory_required = bool(profile and profile.requires_memory)
        return context
