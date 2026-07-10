"""Dynamic Scheduler — executes goal tree steps in dependency order."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

StepHandler = Callable[[dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass
class ScheduleResult:
    ok: bool
    step_results: dict[str, dict[str, Any]] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


class DynamicScheduler:
    """Parallel execution where deps allow; sequential otherwise."""

    def __init__(self) -> None:
        self._handlers: dict[str, StepHandler] = {}

    def register(self, capability_id: str, handler: StepHandler) -> None:
        self._handlers[capability_id] = handler

    async def execute(self, steps: list[dict[str, Any]], ctx: dict[str, Any]) -> ScheduleResult:
        completed: set[str] = set()
        results: dict[str, dict[str, Any]] = {}
        errors: list[str] = []
        pending = {s["id"]: s for s in steps}

        while pending:
            ready = [
                sid
                for sid, step in pending.items()
                if all(d in completed for d in step.get("deps", []))
            ]
            if not ready:
                errors.append("Deadlock or missing dependency in execution graph")
                break

            async def run_step(step_id: str) -> tuple[str, dict[str, Any] | None, str | None]:
                step = pending[step_id]
                cap = step.get("capability", "")
                handler = self._handlers.get(cap)
                if not handler:
                    return step_id, {"skipped": True, "capability": cap}, None
                try:
                    out = await handler(step, ctx)
                    return step_id, out, None
                except Exception as exc:
                    return step_id, None, str(exc)

            batch = await asyncio.gather(*[run_step(sid) for sid in ready])
            for step_id, out, err in batch:
                if err:
                    errors.append(f"{step_id}: {err}")
                elif out:
                    results[step_id] = out
                completed.add(step_id)
                pending.pop(step_id, None)

        return ScheduleResult(ok=len(errors) == 0, step_results=results, errors=errors)


scheduler = DynamicScheduler()
