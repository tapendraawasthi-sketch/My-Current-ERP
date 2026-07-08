"""
Journal verifier chain — deterministic pre-confirm checks before posting.

Runs balance, amount coherence, intent-account fit, inventory flags, then
the existing EntryVerifier. Optional LLM chain_verify for low-confidence entries.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from ..agent.chain_verifier import chain_verify
from ..agent.verifier import VerificationResult, get_entry_verifier
from ..nlu.engine import ParsedEntry
from ..reasoning.accounting_reasoner import JournalEntry

logger = logging.getLogger(__name__)

_INCOME_ACCOUNTS = frozenset({"KH-SALE", "KH-INT-INC"})
_EXPENSE_ACCOUNTS = frozenset({"KH-EXP", "KH-RENT", "KH-SAL", "KH-INT-EXP", "KH-BANK-CHG"})
_ASSET_RECEIPT = frozenset({"KH-CASH", "KH-BANK"})
_LIABILITY_PAY = frozenset({"KH-CRED", "KH-DEBT"})

_INTENT_RULES: dict[str, dict[str, frozenset[str]]] = {
    "cash_sale": {
        "debit_any": _ASSET_RECEIPT,
        "credit_any": _INCOME_ACCOUNTS | frozenset({"KH-STOCK"}),
    },
    "credit_sale": {
        "debit_any": frozenset({"KH-DEBT"}),
        "credit_any": _INCOME_ACCOUNTS,
    },
    "vat_sale": {
        "debit_any": _ASSET_RECEIPT | frozenset({"KH-DEBT"}),
        "credit_any": _INCOME_ACCOUNTS | frozenset({"KH-VAT-OUT"}),
    },
    "cash_purchase": {
        "debit_any": frozenset({"KH-PUR", "KH-STOCK", "KH-EXP"}) | _EXPENSE_ACCOUNTS,
        "credit_any": _ASSET_RECEIPT,
    },
    "credit_purchase": {
        "debit_any": frozenset({"KH-PUR", "KH-STOCK", "KH-EXP"}) | _EXPENSE_ACCOUNTS,
        "credit_any": frozenset({"KH-CRED"}),
    },
    "vat_purchase": {
        "debit_any": frozenset({"KH-PUR", "KH-VAT-IN"}),
        "credit_any": _ASSET_RECEIPT | frozenset({"KH-CRED"}),
    },
    "expense": {
        "debit_any": _EXPENSE_ACCOUNTS | frozenset({"KH-PUR", "KH-PREPAID"}),
        "credit_any": _ASSET_RECEIPT | frozenset({"KH-CRED"}),
    },
    "payment_received": {
        "debit_any": _ASSET_RECEIPT,
        "credit_any": frozenset({"KH-DEBT"}),
    },
    "payment_made": {
        "debit_any": frozenset({"KH-CRED"}),
        "credit_any": _ASSET_RECEIPT,
    },
    "sales_return": {
        "debit_any": frozenset({"KH-SRET", "KH-SALE"}),
        "credit_any": _ASSET_RECEIPT | frozenset({"KH-DEBT"}),
    },
    "purchase_return": {
        "debit_any": _ASSET_RECEIPT | frozenset({"KH-CRED"}),
        "credit_any": frozenset({"KH-PUR", "KH-STOCK", "KH-VAT-IN"}),
    },
    "drawings": {
        "debit_any": frozenset({"KH-DRAW"}),
        "credit_any": _ASSET_RECEIPT,
    },
}


@dataclass
class ChainVerifyResult:
    passed: bool
    entry: JournalEntry
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    blocked: bool = False
    corrections: list[str] = field(default_factory=list)


def _check_balance(entry: JournalEntry) -> list[str]:
    total_dr = sum(l.debit for l in entry.lines)
    total_cr = sum(l.credit for l in entry.lines)
    if abs(total_dr - total_cr) >= 0.02:
        return [f"Entry not balanced: Dr={total_dr:,.2f} Cr={total_cr:,.2f}"]
    if not entry.lines:
        return ["Journal has no lines."]
    return []


def _check_amount_coherence(entry: JournalEntry, parsed: ParsedEntry) -> list[str]:
    errors: list[str] = []
    if not parsed.amount or parsed.amount <= 0:
        return errors
    total_dr = sum(l.debit for l in entry.lines)
    total_cr = sum(l.credit for l in entry.lines)
    voucher_total = max(total_dr, total_cr)
    if abs(voucher_total - float(parsed.amount)) > 1.0:
        errors.append(
            f"Amount mismatch: parsed Rs {parsed.amount:,.2f} vs voucher Rs {voucher_total:,.2f}"
        )
    if entry.amount and abs(float(entry.amount) - float(parsed.amount)) > 1.0:
        errors.append(
            f"Entry amount Rs {entry.amount:,.2f} does not match parsed Rs {parsed.amount:,.2f}"
        )
    return errors


def _accounts_with_side(entry: JournalEntry, side: str) -> set[str]:
    out: set[str] = set()
    for line in entry.lines:
        if side == "debit" and line.debit > 0:
            out.add(line.account)
        if side == "credit" and line.credit > 0:
            out.add(line.account)
    return out


def _check_intent_account_coherence(entry: JournalEntry) -> tuple[list[str], list[str]]:
    """Hard errors + soft warnings for intent vs account lines."""
    errors: list[str] = []
    warnings: list[str] = []
    intent = entry.intent
    rules = _INTENT_RULES.get(intent)
    if not rules:
        return errors, warnings

    debits = _accounts_with_side(entry, "debit")
    credits = _accounts_with_side(entry, "credit")

    if rules.get("debit_any") and debits and not (debits & rules["debit_any"]):
        errors.append(
            f"Intent '{intent}' expects debit in {sorted(rules['debit_any'])}; got {sorted(debits)}"
        )
    if rules.get("credit_any") and credits and not (credits & rules["credit_any"]):
        # Service+part may credit KH-STOCK (COGS) — allow for cash_sale
        if intent == "cash_sale" and credits & frozenset({"KH-STOCK"}):
            pass
        else:
            errors.append(
                f"Intent '{intent}' expects credit in {sorted(rules['credit_any'])}; got {sorted(credits)}"
            )

    if intent in ("cash_sale", "credit_sale", "vat_sale"):
        if debits & _EXPENSE_ACCOUNTS and not debits & _INCOME_ACCOUNTS:
            errors.append("Sale intent but only expense accounts debited.")
    if intent == "expense" and credits & _INCOME_ACCOUNTS:
        errors.append("Expense intent but income account credited.")

    return errors, warnings


def _check_inventory_coherence(entry: JournalEntry, parsed: ParsedEntry) -> list[str]:
    warnings: list[str] = []
    text = " ".join(
        [
            parsed.transaction_category or "",
            " ".join(parsed.debit_accounts or []),
            " ".join(parsed.credit_accounts or []),
        ]
    ).lower()
    needs_cogs = any(k in text for k in ("cogs", "inventory", "service_sale_with_part", "spare part"))
    has_stock = any(l.account == "KH-STOCK" for l in entry.lines)
    if needs_cogs and not has_stock:
        warnings.append("Sector template expects inventory/COGS movement but no stock line found.")
    if needs_cogs and not parsed.secondary_amount:
        warnings.append("Part/inventory cost not provided — COGS split may be incomplete.")
    if has_stock and parsed.amount and parsed.secondary_amount:
        stock_cr = sum(l.credit for l in entry.lines if l.account == "KH-STOCK")
        if stock_cr > 0 and abs(stock_cr - float(parsed.secondary_amount)) > 1.0:
            warnings.append(
                f"COGS line Rs {stock_cr:,.2f} differs from part cost Rs {parsed.secondary_amount:,.2f}"
            )
    return warnings


def _merge_verification(base: VerificationResult, result: ChainVerifyResult) -> None:
    result.errors.extend(base.errors)
    result.warnings.extend(base.warnings)
    result.corrections.extend(base.corrections_made)
    result.entry = base.entry
    if not base.passed:
        result.passed = False
        result.blocked = True


def run_journal_verifier_chain(
    entry: JournalEntry,
    parsed: ParsedEntry,
    context: dict[str, Any] | None = None,
    *,
    use_llm: bool | None = None,
) -> ChainVerifyResult:
    """
    Run full verifier chain. Sets blocked=True on hard failures (user must clarify).
    """
    ctx = context or {}
    result = ChainVerifyResult(passed=True, entry=entry)

    balance_errors = _check_balance(entry)
    if balance_errors:
        result.errors.extend(balance_errors)
        result.passed = False
        result.blocked = True
        return result

    amount_errors = _check_amount_coherence(entry, parsed)
    if amount_errors:
        result.errors.extend(amount_errors)
        result.passed = False
        result.blocked = True

    intent_errors, intent_warnings = _check_intent_account_coherence(entry)
    if intent_errors:
        result.errors.extend(intent_errors)
        result.passed = False
        result.blocked = True
    result.warnings.extend(intent_warnings)

    result.warnings.extend(_check_inventory_coherence(entry, parsed))

    base = get_entry_verifier().verify(entry, ctx)
    _merge_verification(base, result)

    should_llm = use_llm
    if should_llm is None:
        should_llm = parsed.confidence < 0.92 or len(entry.lines) > 3 or bool(parsed.statutory_bundle)

    if should_llm and result.passed:
        try:
            _, llm_warnings = chain_verify(result.entry, ctx)
            result.warnings.extend(llm_warnings)
        except Exception as exc:
            logger.warning("chain_verify skipped: %s", exc)

    return result
