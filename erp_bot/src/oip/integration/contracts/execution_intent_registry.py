"""Registry mapping planner intent types to ExecutionIntent — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .erp_commands import ErpCommandType
from .execution_intent import ExecutionIntent, IntentDomain, IntentOperation, IntentRiskLevel


@dataclass(frozen=True)
class ExecutionIntentDefinition:
    source_intent: str
    template: ExecutionIntent


class ExecutionIntentRegistry:
    def __init__(self) -> None:
        self._definitions: dict[str, ExecutionIntentDefinition] = {}

    def register(self, definition: ExecutionIntentDefinition) -> None:
        self._definitions[definition.source_intent] = definition

    def resolve(
        self,
        *,
        source_intent: str,
        confidence: float = 0.5,
        metadata: dict | None = None,
    ) -> ExecutionIntent:
        definition = self._definitions.get(source_intent) or self._definitions["general_query"]
        base = definition.template
        merged_meta = {**base.metadata, **(metadata or {})}
        return base.model_copy(update={"confidence": confidence, "metadata": merged_meta})

    def list_source_intents(self) -> tuple[str, ...]:
        return tuple(sorted(self._definitions.keys()))


def _intent(
    source: str,
    *,
    domain: IntentDomain,
    operation: IntentOperation,
    risk: IntentRiskLevel,
    mutating: bool,
    approval_required: bool = False,
    erp_command_type: ErpCommandType | None = None,
    action_type: str | None = None,
    capabilities: tuple[str, ...] = (),
    permissions: tuple[str, ...] = (),
) -> ExecutionIntentDefinition:
    return ExecutionIntentDefinition(
        source_intent=source,
        template=ExecutionIntent(
            intent_type=source,
            domain=domain,
            operation=operation,
            risk_level=risk,
            mutating=mutating,
            read_only=not mutating,
            approval_required=approval_required,
            erp_command_type=erp_command_type.value if erp_command_type else None,
            action_type=action_type,
            required_capabilities=capabilities,
            required_permissions=permissions,
            confidence=0.5,
            metadata={"source_intent": source},
        ),
    )


def create_default_execution_intent_registry() -> ExecutionIntentRegistry:
    registry = ExecutionIntentRegistry()
    definitions = (
        _intent(
            "sales_entry",
            domain=IntentDomain.ACCOUNTING,
            operation=IntentOperation.MUTATE,
            risk=IntentRiskLevel.HIGH,
            mutating=True,
            approval_required=True,
            erp_command_type=ErpCommandType.POST_JOURNAL_ENTRY,
            action_type="journal_entry",
            capabilities=("Accounting", "Inventory", "ReadWrite"),
            permissions=("erp:write", "journal:post", "inventory:adjust"),
        ),
        _intent(
            "purchase_entry",
            domain=IntentDomain.ACCOUNTING,
            operation=IntentOperation.MUTATE,
            risk=IntentRiskLevel.HIGH,
            mutating=True,
            approval_required=True,
            erp_command_type=ErpCommandType.POST_JOURNAL_ENTRY,
            action_type="journal_entry",
            capabilities=("Accounting", "Inventory", "ReadWrite"),
            permissions=("erp:write", "journal:post", "inventory:adjust"),
        ),
        _intent(
            "journal_entry",
            domain=IntentDomain.ACCOUNTING,
            operation=IntentOperation.MUTATE,
            risk=IntentRiskLevel.HIGH,
            mutating=True,
            approval_required=True,
            erp_command_type=ErpCommandType.POST_JOURNAL_ENTRY,
            action_type="journal_entry",
            capabilities=("Accounting", "ReadWrite"),
            permissions=("erp:write", "journal:post"),
        ),
        _intent(
            "report_generation",
            domain=IntentDomain.REPORTING,
            operation=IntentOperation.QUERY,
            risk=IntentRiskLevel.MEDIUM,
            mutating=False,
            erp_command_type=ErpCommandType.GENERATE_FINANCIAL_REPORT,
            action_type="report_generation",
            capabilities=("Accounting", "ReadOnly"),
            permissions=("erp:read", "report:generate"),
        ),
        _intent(
            "vat_calculation",
            domain=IntentDomain.TAX,
            operation=IntentOperation.ANALYZE,
            risk=IntentRiskLevel.MEDIUM,
            mutating=False,
            erp_command_type=ErpCommandType.CALCULATE_VAT,
            action_type="vat_calculation",
            capabilities=("Accounting", "ReadOnly"),
            permissions=("erp:read", "tax:calculate"),
        ),
        _intent(
            "ledger_balance_query",
            domain=IntentDomain.ACCOUNTING,
            operation=IntentOperation.QUERY,
            risk=IntentRiskLevel.LOW,
            mutating=False,
            erp_command_type=ErpCommandType.QUERY_LEDGER_BALANCE,
            action_type="ledger_balance_query",
            capabilities=("Accounting", "ReadOnly"),
            permissions=("erp:read", "ledger:query"),
        ),
        _intent(
            "workflow_approval",
            domain=IntentDomain.WORKFLOW,
            operation=IntentOperation.APPROVE,
            risk=IntentRiskLevel.HIGH,
            mutating=True,
            approval_required=True,
            erp_command_type=ErpCommandType.APPROVE_PENDING_ACTION,
            action_type="approval",
            capabilities=("Accounting", "ReadWrite"),
            permissions=("erp:write", "approval:execute"),
        ),
        _intent(
            "accounting_education",
            domain=IntentDomain.GENERAL,
            operation=IntentOperation.EDUCATE,
            risk=IntentRiskLevel.LOW,
            mutating=False,
            capabilities=("Accounting", "ReadOnly"),
            permissions=("erp:read",),
        ),
        _intent(
            "general_query",
            domain=IntentDomain.GENERAL,
            operation=IntentOperation.QUERY,
            risk=IntentRiskLevel.LOW,
            mutating=False,
            capabilities=("Accounting", "ReadOnly"),
            permissions=("erp:read",),
        ),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
