"""Registry-based authority hierarchy — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import AuthorityLevel, KnowledgeAuthority


@dataclass(frozen=True)
class AuthorityDefinition:
    level: AuthorityLevel
    rank: int
    name: str


class AuthorityRegistry:
    def __init__(self) -> None:
        self._authorities: dict[str, AuthorityDefinition] = {}

    def register(self, definition: AuthorityDefinition) -> None:
        self._authorities[definition.level.value] = definition

    def get(self, level: AuthorityLevel | str) -> AuthorityDefinition | None:
        key = level.value if isinstance(level, AuthorityLevel) else level
        return self._authorities.get(key)

    def rank(self, level: AuthorityLevel) -> int:
        definition = self.get(level)
        return definition.rank if definition else 0

    def dominates(self, higher: AuthorityLevel, lower: AuthorityLevel) -> bool:
        return self.rank(higher) > self.rank(lower)

    def ordered_levels(self) -> tuple[AuthorityLevel, ...]:
        return tuple(
            d.level for d in sorted(self._authorities.values(), key=lambda x: x.rank, reverse=True)
        )

    def list_authorities(self) -> tuple[KnowledgeAuthority, ...]:
        return tuple(
            KnowledgeAuthority(
                authority_id=f"auth-{d.level.value}",
                level=d.level,
                name=d.name,
                rank=d.rank,
            )
            for d in sorted(self._authorities.values(), key=lambda x: x.rank, reverse=True)
        )


def create_default_authority_registry() -> AuthorityRegistry:
    registry = AuthorityRegistry()
    definitions = (
        AuthorityDefinition(AuthorityLevel.GOVERNMENT, 100, "Government"),
        AuthorityDefinition(AuthorityLevel.ACCOUNTING_STANDARDS, 90, "Accounting Standards"),
        AuthorityDefinition(AuthorityLevel.COMPANY_POLICY, 80, "Company Policy"),
        AuthorityDefinition(AuthorityLevel.APPROVED_INTERNAL, 70, "Approved Internal Knowledge"),
        AuthorityDefinition(AuthorityLevel.VERIFIED_USER, 60, "Verified User Documents"),
        AuthorityDefinition(AuthorityLevel.WORKING, 40, "Working Documents"),
        AuthorityDefinition(AuthorityLevel.CONVERSATION_MEMORY, 20, "Conversation Memory"),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
