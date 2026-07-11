"""Context budget allocation — dynamic priority order, no fixed percentages."""

from __future__ import annotations

from ...domain.value_objects import ContextBudget
from .context import PlanningContext


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


class BudgetAllocationStage:
    name = "budget_allocation"

    async def run(self, context: PlanningContext) -> PlanningContext:
        policy = context.policy
        max_tokens = policy.max_tokens if policy else 8192
        message_tokens = _estimate_tokens(context.normalized_message)
        attachment_tokens = sum(_estimate_tokens(str(a.get("text", ""))) for a in context.request.attachments)

        profile = context.task_profile
        remaining = max_tokens

        erp_tokens = 0
        if profile and profile.requires_erp_snapshot:
            erp_tokens = min(remaining // 4, 2048)
            remaining -= erp_tokens

        knowledge_tokens = 0
        if context.knowledge_required:
            knowledge_tokens = min(remaining // 3, 1536)
            remaining -= knowledge_tokens

        conversation_tokens = min(remaining // 4, 1024)
        remaining -= conversation_tokens

        memory_tokens = 0
        if context.memory_required:
            memory_tokens = min(remaining // 4, 512)
            remaining -= memory_tokens

        attachment_budget = min(attachment_tokens, remaining // 5)
        remaining -= attachment_budget

        user_input_tokens = min(message_tokens, remaining)

        allocations = {
            "erp_snapshot": erp_tokens,
            "knowledge": knowledge_tokens,
            "conversation": conversation_tokens,
            "memory": memory_tokens,
            "attachments": attachment_budget,
            "user_input": user_input_tokens,
        }
        total = sum(allocations.values())
        context.context_budget = ContextBudget(
            erp_snapshot_tokens=erp_tokens,
            knowledge_tokens=knowledge_tokens,
            conversation_tokens=conversation_tokens,
            memory_tokens=memory_tokens,
            attachment_tokens=attachment_budget,
            user_input_tokens=user_input_tokens,
            total_tokens=total,
            allocations=allocations,
        )
        return context
