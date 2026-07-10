"""Gateway scheduler — execute goal tree steps via DynamicScheduler."""

from __future__ import annotations

import logging
from typing import Any

from .agents.goal_tree import GoalTree
from .capabilities.runtime import capability_runtime
from .contracts.intelligence_contract import ObserveContext
from .kernel.kernel import KernelContext
from .kernel.scheduler import scheduler

logger = logging.getLogger(__name__)

_handlers_registered = False


def _ensure_handlers() -> None:
    global _handlers_registered
    if _handlers_registered:
        return

    async def _cap_handler(step: dict[str, Any], ctx: dict[str, Any]) -> dict[str, Any]:
        cap_id = step.get("capability", "")
        impl = capability_runtime.get(cap_id)
        if not impl:
            return {"skipped": True, "capability": cap_id, "ok": False}

        obs_ctx = ObserveContext(
            session_id=ctx.get("session_id", "scheduler"),
            channel="scheduler",
            raw_input={"message": ctx.get("message", "")},
            tenant_id=ctx.get("tenant_id"),
            company_id=ctx.get("company_id"),
            user_id=ctx.get("user_id"),
            metadata={
                "balance": ctx.get("balance"),
                "payload": step.get("payload", ctx.get("payload", {})),
            },
        )
        explanation, cap_trace = await capability_runtime.run(
            cap_id, obs_ctx, ctx.get("message", ""),
        )
        return {
            "ok": bool(explanation.summary),
            "capability": cap_id,
            "summary": explanation.summary,
            "confidence": explanation.confidence,
            "trace": cap_trace,
        }

    # Register handler for all known capabilities
    from .kernel.kernel import get_kernel

    for desc in get_kernel().registry.list_all():
        scheduler.register(desc.id, _cap_handler)

    _handlers_registered = True


async def execute_goal_tree(
    goal_tree: GoalTree,
    ctx: KernelContext,
    message: str,
) -> dict[str, Any]:
    """Run goal tree steps through DynamicScheduler."""
    if not goal_tree.steps:
        return {"ok": False, "skipped": True, "reason": "empty_goal_tree"}

    _ensure_handlers()
    sched_ctx = {
        "session_id": ctx.session_id,
        "tenant_id": ctx.tenant_id,
        "company_id": ctx.company_id,
        "user_id": ctx.user_id,
        "balance": ctx.balance,
        "message": message,
        "goal": goal_tree.goal,
    }
    result = await scheduler.execute(goal_tree.steps, sched_ctx)

    summaries = [
        r.get("summary", "")
        for r in result.step_results.values()
        if r.get("summary") and not r.get("skipped")
    ]
    caps_used = [
        r.get("capability", "")
        for r in result.step_results.values()
        if r.get("capability") and not r.get("skipped")
    ]

    return {
        "ok": result.ok and bool(summaries),
        "step_results": result.step_results,
        "errors": result.errors,
        "summaries": summaries,
        "capabilities_used": caps_used,
        "answer": " → ".join(summaries) if summaries else None,
    }
