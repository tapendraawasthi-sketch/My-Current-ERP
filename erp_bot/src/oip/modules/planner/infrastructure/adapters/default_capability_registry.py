"""Default capability registry adapter."""

from __future__ import annotations

from ...application.ports.capability_registry_port import CapabilityRegistryPort


class DefaultCapabilityRegistryAdapter(CapabilityRegistryPort):
    _CAPABILITIES: dict[str, dict[str, bool]] = {
        "ledger_balance_query": {"tools": True, "knowledge": False, "memory": True},
        "journal_entry": {"tools": True, "knowledge": True, "memory": True},
        "report_generation": {"tools": True, "knowledge": True, "memory": True},
        "accounting_education": {"tools": False, "knowledge": True, "memory": False},
        "general_query": {"tools": False, "knowledge": True, "memory": True},
    }

    def analyze(self, *, intent: str, module: str, message: str) -> dict:
        base = dict(self._CAPABILITIES.get(intent, {"tools": False, "knowledge": True, "memory": True}))
        base["module"] = module
        base["message_length"] = len(message)
        return base
