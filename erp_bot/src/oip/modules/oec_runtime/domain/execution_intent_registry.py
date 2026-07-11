"""Map ExecutionIntent / ERP command types to OEC connector operations — no switches."""

from __future__ import annotations

from dataclasses import dataclass

from ....integration.contracts.erp_commands import ErpCommandType
from ....integration.contracts.execution_intent import ExecutionIntent
from .value_objects import CapabilityDomain


@dataclass(frozen=True)
class IntentConnectorOperation:
    intent_type: str
    erp_command_type: str
    capability_domain: CapabilityDomain
    connector_operation: str
    mutating: bool


class ExecutionIntentConnectorRegistry:
    def __init__(self) -> None:
        self._by_intent: dict[str, IntentConnectorOperation] = {}
        self._by_command: dict[str, IntentConnectorOperation] = {}

    def register(self, operation: IntentConnectorOperation) -> None:
        self._by_intent[operation.intent_type] = operation
        self._by_command[operation.erp_command_type] = operation

    def resolve_from_intent(self, intent: ExecutionIntent) -> IntentConnectorOperation:
        if intent.intent_type in self._by_intent:
            return self._by_intent[intent.intent_type]
        if intent.erp_command_type and intent.erp_command_type in self._by_command:
            return self._by_command[intent.erp_command_type]
        return self._by_intent["general_query"]

    def resolve_from_command_type(self, command_type: str) -> IntentConnectorOperation | None:
        return self._by_command.get(command_type)

    def resolve_capability_domain(self, *, command_type: str, intent: ExecutionIntent | None = None) -> CapabilityDomain:
        if intent is not None:
            return self.resolve_from_intent(intent).capability_domain
        mapping = self.resolve_from_command_type(command_type)
        return mapping.capability_domain if mapping else CapabilityDomain.ACCOUNTING


def create_default_execution_intent_connector_registry() -> ExecutionIntentConnectorRegistry:
    registry = ExecutionIntentConnectorRegistry()
    definitions = (
        ("journal_entry", ErpCommandType.POST_JOURNAL_ENTRY, CapabilityDomain.ACCOUNTING, "execute_command", True),
        ("report_generation", ErpCommandType.GENERATE_FINANCIAL_REPORT, CapabilityDomain.ACCOUNTING, "execute_query", False),
        ("vat_calculation", ErpCommandType.CALCULATE_VAT, CapabilityDomain.ACCOUNTING, "execute_query", False),
        ("ledger_balance_query", ErpCommandType.QUERY_LEDGER_BALANCE, CapabilityDomain.ACCOUNTING, "execute_query", False),
        ("workflow_approval", ErpCommandType.APPROVE_PENDING_ACTION, CapabilityDomain.GOVERNMENT, "execute_command", True),
        ("general_query", ErpCommandType.QUERY_LEDGER_BALANCE, CapabilityDomain.CRM, "execute_query", False),
    )
    for intent_type, cmd, domain, op, mutating in definitions:
        registry.register(
            IntentConnectorOperation(
                intent_type=intent_type,
                erp_command_type=cmd.value,
                capability_domain=domain,
                connector_operation=op,
                mutating=mutating,
            )
        )
    return registry
