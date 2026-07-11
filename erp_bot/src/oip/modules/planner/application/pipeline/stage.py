"""Planning pipeline stage protocol."""

from __future__ import annotations

from typing import Protocol

from .context import PlanningContext


class PlanningStage(Protocol):
    name: str

    async def run(self, context: PlanningContext) -> PlanningContext:
        """Execute one independently testable planning stage."""
