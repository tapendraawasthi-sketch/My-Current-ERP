"""Default tool registry adapter — detection only, no execution."""

from __future__ import annotations

from typing import Callable

from ...application.ports.tool_registry_port import ToolRegistryPort
from ...domain.value_objects import ToolRequirement


class DefaultToolRegistryAdapter(ToolRegistryPort):
    def __init__(self) -> None:
        self._detectors: dict[str, Callable[[str, str], tuple[ToolRequirement, ...] | None]] = {}

        def register(intent: str, detector: Callable[[str, str], tuple[ToolRequirement, ...] | None]) -> None:
            self._detectors[intent] = detector

        register(
            "sales_entry",
            lambda message, module: (
                ToolRequirement(tool_id="erp.sales.invoice", purpose="draft_sales_invoice"),
                ToolRequirement(tool_id="erp.inventory.adjust", purpose="update_stock"),
                ToolRequirement(tool_id="erp.journal.draft", purpose="draft_journal_entry"),
            ),
        )
        register(
            "purchase_entry",
            lambda message, module: (
                ToolRequirement(tool_id="erp.purchase.invoice", purpose="draft_purchase_invoice"),
                ToolRequirement(tool_id="erp.inventory.adjust", purpose="update_stock"),
                ToolRequirement(tool_id="erp.journal.draft", purpose="draft_journal_entry"),
            ),
        )
        register(
            "ledger_balance_query",
            lambda message, module: (
                ToolRequirement(tool_id="erp.ledger.balance", purpose="fetch_party_balance"),
            ),
        )
        register(
            "journal_entry",
            lambda message, module: (
                ToolRequirement(tool_id="erp.journal.draft", purpose="draft_journal_entry"),
                ToolRequirement(tool_id="erp.fiscal.period_guard", purpose="validate_period"),
            ),
        )
        register(
            "report_generation",
            lambda message, module: (
                ToolRequirement(tool_id="erp.report.generate", purpose="generate_report"),
            ),
        )

    def detect_requirements(
        self,
        *,
        intent: str,
        module: str,
        message: str,
    ) -> tuple[ToolRequirement, ...]:
        detector = self._detectors.get(intent)
        if detector is None:
            return ()
        return detector(message, module) or ()
