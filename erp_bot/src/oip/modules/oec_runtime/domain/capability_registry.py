"""Capability registry."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import CapabilityDomain, CapabilityMode


@dataclass(frozen=True)
class CapabilityDefinition:
    domain: CapabilityDomain
    mode: CapabilityMode
    required_command_types: tuple[str, ...] = ()


class CapabilityRegistry:
    def __init__(self) -> None:
        self._capabilities: dict[str, CapabilityDefinition] = {}

    def register(self, definition: CapabilityDefinition) -> None:
        self._capabilities[definition.domain.value] = definition

    def get(self, domain: CapabilityDomain | str) -> CapabilityDefinition | None:
        key = domain.value if isinstance(domain, CapabilityDomain) else domain
        return self._capabilities.get(key)

    def supports_command(self, domain: CapabilityDomain | str, command_type: str) -> bool:
        definition = self.get(domain)
        if definition is None:
            return False
        if not definition.required_command_types:
            return True
        return command_type in definition.required_command_types

    def all_domains(self) -> tuple[str, ...]:
        return tuple(self._capabilities.keys())


def create_default_capability_registry() -> CapabilityRegistry:
    registry = CapabilityRegistry()
    from ....integration.contracts.erp_commands import ErpCommandType

    journal = ErpCommandType.POST_JOURNAL_ENTRY.value
    report = ErpCommandType.GENERATE_FINANCIAL_REPORT.value
    vat = ErpCommandType.CALCULATE_VAT.value
    ledger = ErpCommandType.QUERY_LEDGER_BALANCE.value
    approval = ErpCommandType.APPROVE_PENDING_ACTION.value
    read_commands = (report, vat, ledger)
    write_commands = (journal, approval)
    all_accounting = write_commands + read_commands
    definitions = (
        CapabilityDefinition(CapabilityDomain.ACCOUNTING, CapabilityMode.READ_WRITE, all_accounting),
        CapabilityDefinition(CapabilityDomain.INVENTORY, CapabilityMode.READ_WRITE, (journal,)),
        CapabilityDefinition(CapabilityDomain.PAYROLL, CapabilityMode.READ_WRITE, (journal,)),
        CapabilityDefinition(CapabilityDomain.CRM, CapabilityMode.READ_ONLY, read_commands),
        CapabilityDefinition(CapabilityDomain.HR, CapabilityMode.READ_WRITE, (journal,)),
        CapabilityDefinition(CapabilityDomain.MANUFACTURING, CapabilityMode.READ_WRITE, (journal,)),
        CapabilityDefinition(CapabilityDomain.GOVERNMENT, CapabilityMode.READ_WRITE, (approval, journal)),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
