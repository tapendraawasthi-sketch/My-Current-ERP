"""Tool registry port — planner never executes tools."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.value_objects import ToolRequirement


class ToolRegistryPort(ABC):
    @abstractmethod
    def detect_requirements(
        self,
        *,
        intent: str,
        module: str,
        message: str,
    ) -> tuple[ToolRequirement, ...]:
        """Detect tool requirements from intent analysis."""
