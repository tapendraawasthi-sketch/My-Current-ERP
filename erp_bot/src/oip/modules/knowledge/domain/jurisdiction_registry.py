"""Registry-based jurisdiction packs — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import Jurisdiction


@dataclass(frozen=True)
class JurisdictionPack:
    code: str
    name: str
    jurisdiction: Jurisdiction
    accounting_standard: str | None = None
    enabled: bool = True


class JurisdictionRegistry:
    def __init__(self) -> None:
        self._packs: dict[str, JurisdictionPack] = {}

    def register(self, pack: JurisdictionPack) -> None:
        self._packs[pack.code] = pack

    def get(self, code: str) -> JurisdictionPack | None:
        return self._packs.get(code)

    def list_packs(self) -> tuple[JurisdictionPack, ...]:
        return tuple(self._packs[k] for k in sorted(self._packs.keys()))

    def is_valid(self, code: str) -> bool:
        pack = self.get(code)
        return pack is not None and pack.enabled


def create_default_jurisdiction_registry() -> JurisdictionRegistry:
    registry = JurisdictionRegistry()
    packs = (
        JurisdictionPack("nepal", "Nepal", Jurisdiction.NEPAL, "NFRS"),
        JurisdictionPack("india", "India", Jurisdiction.INDIA, "Ind AS"),
        JurisdictionPack("ifrs", "IFRS", Jurisdiction.IFRS, "IFRS"),
        JurisdictionPack("ias", "IAS", Jurisdiction.IAS, "IAS"),
        JurisdictionPack("nfrs", "NFRS", Jurisdiction.NFRS, "NFRS"),
        JurisdictionPack("custom", "Custom Jurisdiction Pack", Jurisdiction.CUSTOM),
    )
    for pack in packs:
        registry.register(pack)
    return registry
