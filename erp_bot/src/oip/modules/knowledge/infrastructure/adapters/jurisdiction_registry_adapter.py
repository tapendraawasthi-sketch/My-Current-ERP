"""Jurisdiction registry port adapter."""

from __future__ import annotations

from ...application.ports.knowledge_ports import JurisdictionRegistryPort
from ...domain.jurisdiction_registry import JurisdictionRegistry, create_default_jurisdiction_registry


class JurisdictionRegistryAdapter(JurisdictionRegistryPort):
    def __init__(self, registry: JurisdictionRegistry | None = None) -> None:
        self._registry = registry or create_default_jurisdiction_registry()

    def is_valid(self, code: str) -> bool:
        return self._registry.is_valid(code)

    def list_packs(self) -> tuple[dict[str, str], ...]:
        return tuple(
            {
                "code": pack.code,
                "name": pack.name,
                "jurisdiction": pack.jurisdiction.value,
                "accounting_standard": pack.accounting_standard or "",
            }
            for pack in self._registry.list_packs()
        )
