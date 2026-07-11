"""Normalize request message."""

from __future__ import annotations

import re

from .context import PlanningContext


class NormalizeStage:
    name = "normalize"

    async def run(self, context: PlanningContext) -> PlanningContext:
        message = context.request.message.strip()
        message = re.sub(r"\s+", " ", message)
        context.normalized_message = message
        return context
