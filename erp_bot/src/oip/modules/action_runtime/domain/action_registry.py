"""Registry-based action type catalog — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from ....integration.contracts.erp_commands import ErpCommandType
from .value_objects import ActionRuntimeType


@dataclass(frozen=True)
class ActionTypeDefinition:
    action_type: ActionRuntimeType
    erp_command_type: ErpCommandType
    requires_approval: bool = False
    approval_role: str = "manager"
    reversible: bool = True
    description: str = ""


class ActionTypeRegistry:
    """Central registry for action type → ERP command mapping."""

    def __init__(self) -> None:
        self._definitions: dict[str, ActionTypeDefinition] = {}

    def register(self, definition: ActionTypeDefinition) -> None:
        self._definitions[definition.action_type.value] = definition

    def get(self, action_type: str | ActionRuntimeType) -> ActionTypeDefinition | None:
        key = action_type.value if isinstance(action_type, ActionRuntimeType) else action_type
        return self._definitions.get(key)

    def require(self, action_type: str | ActionRuntimeType) -> ActionTypeDefinition:
        definition = self.get(action_type)
        if definition is None:
            raise ValueError(f"Unknown action type: {action_type}")
        return definition

    def list_types(self) -> tuple[str, ...]:
        return tuple(sorted(self._definitions.keys()))

    def resolve_erp_command_type(self, action_type: str | ActionRuntimeType) -> ErpCommandType:
        return self.require(action_type).erp_command_type


def create_default_action_registry() -> ActionTypeRegistry:
    registry = ActionTypeRegistry()
    entries = (
        (ActionRuntimeType.JOURNAL_ENTRY, ErpCommandType.POST_JOURNAL_ENTRY, True, "finance"),
        (ActionRuntimeType.REPORT_GENERATION, ErpCommandType.GENERATE_FINANCIAL_REPORT, False, "manager"),
        (ActionRuntimeType.VAT_CALCULATION, ErpCommandType.CALCULATE_VAT, False, "manager"),
        (ActionRuntimeType.LEDGER_BALANCE_QUERY, ErpCommandType.QUERY_LEDGER_BALANCE, False, "manager"),
        (ActionRuntimeType.APPROVAL, ErpCommandType.APPROVE_PENDING_ACTION, True, "administrator"),
        (ActionRuntimeType.INVOICE, ErpCommandType.POST_JOURNAL_ENTRY, True, "manager"),
        (ActionRuntimeType.RECEIPT, ErpCommandType.POST_JOURNAL_ENTRY, False, "manager"),
        (ActionRuntimeType.PAYMENT, ErpCommandType.POST_JOURNAL_ENTRY, True, "finance"),
        (ActionRuntimeType.INVENTORY_ADJUSTMENT, ErpCommandType.POST_JOURNAL_ENTRY, True, "manager"),
        (ActionRuntimeType.STOCK_TRANSFER, ErpCommandType.POST_JOURNAL_ENTRY, True, "manager"),
        (ActionRuntimeType.PAYROLL_POSTING, ErpCommandType.POST_JOURNAL_ENTRY, True, "administrator"),
        (ActionRuntimeType.ASSET_POSTING, ErpCommandType.POST_JOURNAL_ENTRY, True, "finance"),
        (ActionRuntimeType.TAX_SUBMISSION, ErpCommandType.POST_JOURNAL_ENTRY, True, "administrator"),
        (ActionRuntimeType.BANK_RECONCILIATION, ErpCommandType.POST_JOURNAL_ENTRY, True, "finance"),
        (ActionRuntimeType.CUSTOMER_CREATION, ErpCommandType.POST_JOURNAL_ENTRY, False, "manager"),
        (ActionRuntimeType.VENDOR_CREATION, ErpCommandType.POST_JOURNAL_ENTRY, False, "manager"),
        (ActionRuntimeType.CUSTOM_ACTION, ErpCommandType.POST_JOURNAL_ENTRY, True, "administrator"),
    )
    for action_type, cmd_type, requires_approval, role in entries:
        registry.register(
            ActionTypeDefinition(
                action_type=action_type,
                erp_command_type=cmd_type,
                requires_approval=requires_approval,
                approval_role=role,
                description=action_type.value.replace("_", " ").title(),
            )
        )
    return registry
