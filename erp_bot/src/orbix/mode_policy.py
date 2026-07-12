"""Central Orbix operating-mode policy — Ask vs Accountant.

Mode is an application-level capability gate. It does not replace RBAC;
effective permission = mode_capability AND user_role_permission AND company_policy.
The LLM is never the security authority.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal

OrbixOperatingMode = Literal["ask", "accountant"]

VALID_MODES: frozenset[str] = frozenset({"ask", "accountant"})
DEFAULT_MODE: OrbixOperatingMode = "ask"


class ToolCategory(str, Enum):
    READ = "read"
    REPORT = "report"
    ANALYSIS = "analysis"
    DRAFT = "draft"
    MUTATION = "mutation"


# Tool name → category. Unknown tools default to MUTATION (deny-by-default).
TOOL_CATEGORIES: dict[str, ToolCategory] = {
    # Read
    "query_balance": ToolCategory.READ,
    "query_ledger": ToolCategory.READ,
    "query_inventory": ToolCategory.READ,
    "search_vouchers": ToolCategory.READ,
    "erp.query.balance": ToolCategory.READ,
    "erp.query.ledger": ToolCategory.READ,
    "erp.inventory.query": ToolCategory.READ,
    "simulate_voucher": ToolCategory.DRAFT,
    # Report
    "generate_balance_sheet": ToolCategory.REPORT,
    "generate_profit_loss": ToolCategory.REPORT,
    "generate_trial_balance": ToolCategory.REPORT,
    "erp.report.generate": ToolCategory.REPORT,
    "calculate_report_totals": ToolCategory.REPORT,
    "drill_down_report": ToolCategory.REPORT,
    # Analysis
    "explain_journal": ToolCategory.ANALYSIS,
    "analyze_expenses": ToolCategory.ANALYSIS,
    # Draft
    "create_transaction_draft": ToolCategory.DRAFT,
    "update_draft": ToolCategory.DRAFT,
    "validate_draft": ToolCategory.DRAFT,
    "generate_preview": ToolCategory.DRAFT,
    "erp.journal.draft": ToolCategory.DRAFT,
    "erp.purchase.invoice": ToolCategory.DRAFT,
    "erp.sales.invoice": ToolCategory.DRAFT,
    # Mutation
    "post_purchase": ToolCategory.MUTATION,
    "post_sale": ToolCategory.MUTATION,
    "post_confirmed_voucher": ToolCategory.MUTATION,
    "create_ledger": ToolCategory.MUTATION,
    "modify_ledger": ToolCategory.MUTATION,
    "reverse_voucher": ToolCategory.MUTATION,
    "cancel_invoice": ToolCategory.MUTATION,
    "adjust_stock": ToolCategory.MUTATION,
    "erp.inventory.adjust": ToolCategory.MUTATION,
    "erp.journal.post": ToolCategory.MUTATION,
}


@dataclass(frozen=True)
class ModeCapabilities:
    can_query_erp: bool
    can_generate_reports: bool
    can_analyze: bool
    can_create_draft: bool
    can_preview_mutation: bool
    can_post_mutation: bool

    def allows_tool_category(self, category: ToolCategory) -> bool:
        if category in (ToolCategory.READ, ToolCategory.REPORT, ToolCategory.ANALYSIS):
            return True
        if category == ToolCategory.DRAFT:
            return self.can_create_draft or self.can_preview_mutation
        if category == ToolCategory.MUTATION:
            return self.can_post_mutation
        return False

    def to_dict(self) -> dict[str, bool]:
        return {
            "can_query_erp": self.can_query_erp,
            "can_generate_reports": self.can_generate_reports,
            "can_analyze": self.can_analyze,
            "can_create_draft": self.can_create_draft,
            "can_preview_mutation": self.can_preview_mutation,
            "can_post_mutation": self.can_post_mutation,
        }


ASK_CAPABILITIES = ModeCapabilities(
    can_query_erp=True,
    can_generate_reports=True,
    can_analyze=True,
    can_create_draft=False,
    can_preview_mutation=False,
    can_post_mutation=False,
)

ACCOUNTANT_BASE_CAPABILITIES = ModeCapabilities(
    can_query_erp=True,
    can_generate_reports=True,
    can_analyze=True,
    can_create_draft=True,
    can_preview_mutation=True,
    can_post_mutation=False,  # gated by permission_check
)


class ModeValidationError(ValueError):
    """Invalid orbix_mode supplied by client."""

    def __init__(self, value: str) -> None:
        self.value = value
        super().__init__(f"Invalid orbix_mode: {value!r}. Expected 'ask' or 'accountant'.")


def normalize_orbix_mode(
    value: Any,
    *,
    missing_default: OrbixOperatingMode = DEFAULT_MODE,
    invalid_policy: Literal["error", "ask"] = "error",
) -> OrbixOperatingMode:
    """Validate client mode. Missing → Ask. Invalid → error or Ask (never Accountant)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return missing_default
    normalized = str(value).strip().lower()
    if normalized in VALID_MODES:
        return normalized  # type: ignore[return-value]
    if invalid_policy == "ask":
        return "ask"
    raise ModeValidationError(normalized)


def resolve_capabilities(
    mode: OrbixOperatingMode,
    *,
    can_post: bool = False,
) -> ModeCapabilities:
    """Resolve effective mode capabilities. Posting requires Accountant + permission."""
    if mode == "ask":
        return ASK_CAPABILITIES
    return ModeCapabilities(
        can_query_erp=True,
        can_generate_reports=True,
        can_analyze=True,
        can_create_draft=True,
        can_preview_mutation=True,
        can_post_mutation=bool(can_post),
    )


def tool_category(tool_name: str) -> ToolCategory:
    return TOOL_CATEGORIES.get(tool_name, ToolCategory.MUTATION)


def is_tool_allowed(
    mode: OrbixOperatingMode,
    tool_name: str,
    *,
    can_post: bool = False,
) -> bool:
    caps = resolve_capabilities(mode, can_post=can_post)
    return caps.allows_tool_category(tool_category(tool_name))


def mode_restriction_payload(
    *,
    required_mode: OrbixOperatingMode = "accountant",
    can_preview: bool = True,
    operation: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "mode_restriction",
        "required_mode": required_mode,
        "can_preview": can_preview,
        "operation": operation,
    }


def ask_mode_mutation_message(operation: str | None = None) -> str:
    op = f" ({operation})" if operation else ""
    return (
        f"I can explain or preview the entry in Ask Mode{op}, "
        "but posting or creating ERP records requires **Accountant Mode**.\n\n"
        "Switch to Accountant Mode to create or modify authorized ERP records."
    )


def user_may_post_purchase(*, role: str | None, permissions: dict[str, Any] | None = None) -> bool:
    """Server-side purchase posting permission check (RBAC)."""
    normalized = (role or "").strip().lower()
    if normalized in {"admin", "owner", "super_admin", "superuser", "accountant", "manager"}:
        return True
    if permissions:
        purchase = permissions.get("purchaseVoucher") or permissions.get("purchase")
        if isinstance(purchase, dict):
            level = str(purchase.get("level") or purchase.get("access") or "").lower()
            if level in {"create", "edit", "full", "full_access", "create_edit"}:
                return True
        if purchase in (True, "create", "edit", "full"):
            return True
    return False
