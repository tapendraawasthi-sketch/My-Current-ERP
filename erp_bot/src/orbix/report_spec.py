"""Unified Report Specification — NL reporting → structured deterministic query.

The LLM may interpret instructions into a ReportSpec; figures must come from
the ERP reporting engine, never from LLM arithmetic.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

ReportType = Literal[
    "balance_sheet",
    "profit_and_loss",
    "trial_balance",
    "cash_flow",
    "general_ledger",
    "account_ledger",
    "day_book",
    "journal_register",
    "sales_register",
    "purchase_register",
    "receivable_aging",
    "payable_aging",
    "stock_summary",
    "stock_ledger",
    "tax_summary",
    "vat_report",
    "ratio_analysis",
]

DetailLevel = Literal["summary", "group", "subgroup", "ledger", "voucher"]
PeriodType = Literal["financial_year", "date_range", "as_of_date"]

# Reports currently backed by the frontend Dexie report engine
SUPPORTED_REPORTS: frozenset[str] = frozenset(
    {"balance_sheet", "profit_and_loss", "trial_balance", "account_ledger"}
)


@dataclass
class ReportPeriod:
    type: PeriodType = "financial_year"
    start_date: str | None = None
    end_date: str | None = None
    financial_year: str | None = "current"


@dataclass
class ReportComparison:
    enabled: bool = False
    comparison_type: str | None = None
    periods: list[str] = field(default_factory=list)


@dataclass
class ReportSpecification:
    report_type: ReportType
    company_id: str | None = None
    period: ReportPeriod = field(default_factory=ReportPeriod)
    comparison: ReportComparison = field(default_factory=ReportComparison)
    detail_level: DetailLevel = "group"
    include_groups: bool = True
    include_subgroups: bool = False
    include_ledgers: bool = False
    include_vouchers: bool = False
    include_zero_balances: bool = False
    include_opening_balances: bool = True
    currency: str = "NPR"
    filters: dict[str, Any] = field(default_factory=dict)
    sort: dict[str, Any] = field(default_factory=dict)
    format: str = "table"
    expanded_groups: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReportSpecification:
        period_data = data.get("period") or {}
        comparison_data = data.get("comparison") or {}
        return cls(
            report_type=data["report_type"],
            company_id=data.get("company_id"),
            period=ReportPeriod(
                type=period_data.get("type", "financial_year"),
                start_date=period_data.get("start_date"),
                end_date=period_data.get("end_date"),
                financial_year=period_data.get("financial_year", "current"),
            ),
            comparison=ReportComparison(
                enabled=bool(comparison_data.get("enabled")),
                comparison_type=comparison_data.get("comparison_type"),
                periods=list(comparison_data.get("periods") or []),
            ),
            detail_level=data.get("detail_level", "group"),
            include_groups=bool(data.get("include_groups", True)),
            include_subgroups=bool(data.get("include_subgroups", False)),
            include_ledgers=bool(data.get("include_ledgers", False)),
            include_vouchers=bool(data.get("include_vouchers", False)),
            include_zero_balances=bool(data.get("include_zero_balances", False)),
            include_opening_balances=bool(data.get("include_opening_balances", True)),
            currency=data.get("currency", "NPR"),
            filters=dict(data.get("filters") or {}),
            sort=dict(data.get("sort") or {}),
            format=data.get("format", "table"),
            expanded_groups=list(data.get("expanded_groups") or []),
        )

    def apply_follow_up(self, message: str) -> ReportSpecification:
        """Mutate a copy of this spec based on a follow-up instruction."""
        text = message.lower()
        updated = ReportSpecification.from_dict(self.to_dict())

        if re.search(r"previous[\s-]+year|last[\s-]+year|compare", text):
            updated.comparison = ReportComparison(
                enabled=True,
                comparison_type="previous_financial_year",
                periods=["current", "previous"],
            )
        if re.search(r"remove\s+comparison|without\s+comparison|no\s+comparison", text):
            updated.comparison = ReportComparison(enabled=False)

        if re.search(r"subgroups?", text) and not re.search(r"not\s+.*subgroup|without\s+subgroup|no\s+subgroup", text):
            updated.include_subgroups = True
            updated.detail_level = "subgroup"
        if re.search(r"not\s+.*ledgers?|without\s+ledgers?|no\s+ledgers?|but\s+not\s+ledgers?", text):
            updated.include_ledgers = False
        elif re.search(r"\bledgers?\b|individual\s+ledgers?", text):
            updated.include_ledgers = True
            updated.detail_level = "ledger"
        if re.search(r"groups?\s+and\s+subgroups?", text):
            updated.include_groups = True
            updated.include_subgroups = True
            updated.detail_level = "subgroup"
        if re.search(r"only\s+major|summary", text):
            updated.detail_level = "summary"
            updated.include_subgroups = False
            updated.include_ledgers = False
        if re.search(r"hide\s+zero|exclude\s+zero|no\s+zero", text):
            updated.include_zero_balances = False
        if re.search(r"include\s+zero|show\s+zero", text):
            updated.include_zero_balances = True
        if re.search(r"voucher", text):
            updated.include_vouchers = True
            updated.detail_level = "voucher"

        expand = re.search(
            r"expand\s+([a-z][a-z\s]{2,40}?)(?:\.|$|,|and\b)",
            text,
        )
        if expand:
            group = expand.group(1).strip()
            if group and group not in updated.expanded_groups:
                updated.expanded_groups.append(group)
            updated.filters["expanded_group"] = group

        branch = re.search(
            r"under\s+([a-z][a-z\s]{2,40}?)(?:\s+and|\s+with|\.|$)",
            text,
        )
        if branch:
            updated.filters["branch"] = branch.group(1).strip()

        return updated


_TYPE_PATTERNS: list[tuple[ReportType, re.Pattern[str]]] = [
    ("balance_sheet", re.compile(r"\bbalance\s*sheet\b|vasalat|statement\s+of\s+financial", re.I)),
    ("profit_and_loss", re.compile(r"\bprofit\s*(and|&)\s*loss\b|\bp\s*&\s*l\b|\bpnl\b", re.I)),
    ("trial_balance", re.compile(r"\btrial\s*balance\b|parikshan", re.I)),
    ("cash_flow", re.compile(r"\bcash\s*flow\b", re.I)),
    ("receivable_aging", re.compile(r"\breceivable\s*aging\b|debtor\s*aging", re.I)),
    ("payable_aging", re.compile(r"\bpayable\s*aging\b|creditor\s*aging", re.I)),
    ("stock_summary", re.compile(r"\bstock\s+summary\b|inventory\s+summary", re.I)),
    ("vat_report", re.compile(r"\bvat\s+report\b", re.I)),
    ("day_book", re.compile(r"\bday\s*book\b", re.I)),
    ("account_ledger", re.compile(r"\b(party|account)\s+ledger\b|\bledger\s+(of|for)\b", re.I)),
]


def parse_report_specification(message: str, *, company_id: str | None = None) -> ReportSpecification | None:
    """Build a ReportSpecification from a natural-language reporting request."""
    text = (message or "").strip()
    if not text:
        return None

    report_type: ReportType | None = None
    for rtype, pattern in _TYPE_PATTERNS:
        if pattern.search(text):
            report_type = rtype
            break
    if report_type is None:
        return None

    spec = ReportSpecification(report_type=report_type, company_id=company_id)

    if re.search(r"previous[\s-]+year|last[\s-]+year|compare", text, re.I):
        spec.comparison = ReportComparison(
            enabled=True,
            comparison_type="previous_financial_year",
            periods=["current", "previous"],
        )

    if re.search(r"groups?\s+and\s+subgroups?", text, re.I):
        spec.include_groups = True
        spec.include_subgroups = True
        spec.detail_level = "subgroup"
    elif re.search(r"subgroups?", text, re.I):
        spec.include_subgroups = True
        spec.detail_level = "subgroup"

    if re.search(r"not\s+.*ledgers?|without\s+ledgers?|but\s+not\s+ledgers?", text, re.I):
        spec.include_ledgers = False
    elif re.search(r"\bledgers?\b|individual\s+ledgers?", text, re.I):
        spec.include_ledgers = True
        spec.detail_level = "ledger"

    if re.search(r"only\s+major|summary", text, re.I):
        spec.detail_level = "summary"

    if re.search(r"hide\s+zero|exclude\s+zero", text, re.I):
        spec.include_zero_balances = False
    if re.search(r"include\s+zero|show\s+zero", text, re.I):
        spec.include_zero_balances = True

    if re.search(r"current\s+(financial\s+)?year|this\s+year|fy\s*current", text, re.I):
        spec.period = ReportPeriod(type="financial_year", financial_year="current")

    branch = re.search(r"under\s+([A-Za-z][A-Za-z\s]{2,40}?)(?:\s+and|\s+with|\.|$)", text)
    if branch:
        spec.filters["branch"] = branch.group(1).strip().lower()

    return spec


def unsupported_report_message(report_type: str) -> dict[str, Any]:
    return {
        "type": "capability_gap",
        "report_type": report_type,
        "supported": sorted(SUPPORTED_REPORTS),
        "message": (
            f"Report type '{report_type}' is not yet available in the live ERP report engine. "
            f"Currently supported: {', '.join(sorted(SUPPORTED_REPORTS))}."
        ),
    }
