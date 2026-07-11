"""Authority registry port adapter."""

from __future__ import annotations

from ...application.ports.knowledge_ports import AuthorityRegistryPort
from ...domain.authority_registry import AuthorityRegistry, create_default_authority_registry


class AuthorityRegistryAdapter(AuthorityRegistryPort):
    def __init__(self, registry: AuthorityRegistry | None = None) -> None:
        self._registry = registry or create_default_authority_registry()

    def rank(self, level: str) -> int:
        from ...domain.value_objects import AuthorityLevel

        try:
            auth_level = AuthorityLevel(level)
        except ValueError:
            return 0
        return self._registry.rank(auth_level)

    def dominates(self, higher: str, lower: str) -> bool:
        from ...domain.value_objects import AuthorityLevel

        try:
            return self._registry.dominates(AuthorityLevel(higher), AuthorityLevel(lower))
        except ValueError:
            return False

    def ordered_levels(self) -> tuple[str, ...]:
        return tuple(level.value for level in self._registry.ordered_levels())
