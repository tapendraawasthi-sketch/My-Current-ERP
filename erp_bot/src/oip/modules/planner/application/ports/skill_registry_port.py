"""Skill registry port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.value_objects import SkillRequirement


class SkillRegistryPort(ABC):
    @abstractmethod
    def resolve_skills(
        self,
        *,
        intent: str,
        module: str,
    ) -> tuple[SkillRequirement, ...]:
        """Resolve required skills for execution plan."""
