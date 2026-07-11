"""Planning policy port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.value_objects import PlanningPolicy, PlanningPolicyName


class PlanningPolicyPort(ABC):
    @abstractmethod
    def resolve(self, *, policy_name: PlanningPolicyName, module: str) -> PlanningPolicy:
        """Resolve planning policy for module context."""
