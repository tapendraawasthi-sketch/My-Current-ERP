"""Knowledge requirement detection stage."""

from __future__ import annotations

from .context import PlanningContext


class KnowledgeRequirementStage:
    name = "knowledge_requirement_detection"

    async def run(self, context: PlanningContext) -> PlanningContext:
        profile = context.task_profile
        context.knowledge_required = bool(
            profile and (profile.requires_knowledge or context.intent == "accounting_education")
        )
        return context
