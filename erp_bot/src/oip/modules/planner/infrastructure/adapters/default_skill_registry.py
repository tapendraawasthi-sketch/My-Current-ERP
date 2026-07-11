"""Default skill registry adapter."""

from __future__ import annotations

from typing import Callable

from ...application.ports.skill_registry_port import SkillRegistryPort
from ...domain.value_objects import SkillRequirement


class DefaultSkillRegistryAdapter(SkillRegistryPort):
    def __init__(self) -> None:
        self._resolvers: dict[str, Callable[[str], tuple[SkillRequirement, ...]]] = {
            "ledger_balance_query": lambda module: (
                SkillRequirement(skill_id="accounting.ledger_read", purpose="balance_lookup"),
            ),
            "journal_entry": lambda module: (
                SkillRequirement(skill_id="accounting.double_entry", purpose="journal_composition"),
                SkillRequirement(skill_id="nepal.tax.vat", purpose="tax_validation"),
            ),
            "report_generation": lambda module: (
                SkillRequirement(skill_id="accounting.reporting", purpose="report_synthesis"),
            ),
            "accounting_education": lambda module: (
                SkillRequirement(skill_id="accounting.explain", purpose="concept_explanation"),
            ),
            "general_query": lambda module: (
                SkillRequirement(skill_id="conversation.general", purpose="general_assistance"),
            ),
        }

    def resolve_skills(self, *, intent: str, module: str) -> tuple[SkillRequirement, ...]:
        resolver = self._resolvers.get(intent) or self._resolvers["general_query"]
        return resolver(module)
