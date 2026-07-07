"""
Entry Verifier — 12 automated checks before presenting entries to the user.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from ollama import Client

from ..config import FAST_MODEL, OLLAMA_BASE_URL
from ..knowledge.nepal_accounting_kb import CHART_OF_ACCOUNTS
from ..reasoning.accounting_reasoner import JournalEntry, JournalLine

logger = logging.getLogger(__name__)


@dataclass
class CheckResult:
    passed: bool
    message: str = ""
    warning: bool = False


@dataclass
class VerificationResult:
    passed: bool
    entry: JournalEntry
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    corrections_made: list[str] = field(default_factory=list)


class EntryVerifier:
    """Post-generation verification with optional auto-correction."""

    def verify(self, entry: JournalEntry, context: dict[str, Any] | None = None) -> VerificationResult:
        ctx = context or {}
        checks = [
            self._check_balance(entry),
            self._check_account_existence(entry),
            self._check_account_nature(entry),
            self._check_amount_sanity(entry, ctx),
            self._check_party_required(entry),
            self._check_vat_compliance(entry),
            self._check_cash_sufficiency(entry, ctx),
            self._check_duplicate(entry, ctx),
            self._check_narration_quality(entry),
        ]

        failures = [c for c in checks if not c.passed]
        warnings = [c for c in checks if c.passed and c.warning]

        if failures:
            corrected = self._auto_correct(entry, failures)
            if corrected:
                return VerificationResult(
                    passed=True,
                    entry=corrected,
                    corrections_made=[f.message for f in failures],
                    warnings=[w.message for w in warnings],
                )
            return VerificationResult(
                passed=False,
                entry=entry,
                errors=[f.message for f in failures],
                warnings=[w.message for w in warnings],
            )

        return VerificationResult(
            passed=True,
            entry=entry,
            warnings=[w.message for w in warnings],
        )

    def _check_balance(self, entry: JournalEntry) -> CheckResult:
        total_dr = sum(l.debit for l in entry.lines)
        total_cr = sum(l.credit for l in entry.lines)
        diff = abs(total_dr - total_cr)
        if diff >= 0.01:
            return CheckResult(
                passed=False,
                message=f"Entry not balanced: Dr={total_dr:,.2f} Cr={total_cr:,.2f} (diff={diff:,.2f})",
            )
        return CheckResult(passed=True)

    def _check_account_existence(self, entry: JournalEntry) -> CheckResult:
        for line in entry.lines:
            if line.account not in CHART_OF_ACCOUNTS:
                return CheckResult(
                    passed=False,
                    message=f"Unknown account code: {line.account}",
                )
        return CheckResult(passed=True)

    def _check_account_nature(self, entry: JournalEntry) -> CheckResult:
        for line in entry.lines:
            acct = CHART_OF_ACCOUNTS.get(line.account)
            if not acct:
                continue
            acct_type = acct.get("type", "")
            if acct_type == "income" and line.debit > 0 and entry.intent not in (
                "sales_return",
                "discount_allowed",
                "closing_entry",
            ):
                return CheckResult(
                    passed=True,
                    warning=True,
                    message=f"Income account '{acct.get('name')}' debited — unusual unless reversal.",
                )
            if acct_type == "expense" and line.credit > 0 and entry.intent not in (
                "purchase_return",
                "closing_entry",
            ):
                return CheckResult(
                    passed=True,
                    warning=True,
                    message=f"Expense account '{acct.get('name')}' credited — unusual unless reversal.",
                )
        return CheckResult(passed=True)

    def _check_amount_sanity(self, entry: JournalEntry, ctx: dict[str, Any]) -> CheckResult:
        amount = entry.amount or 0
        if amount <= 0:
            return CheckResult(passed=False, message="Amount must be positive.")
        if amount > 10_000_000:
            return CheckResult(
                passed=True,
                warning=True,
                message=f"Large amount: Rs {amount:,.2f}. Please verify.",
            )
        avg = ctx.get("party_avg_amount")
        if avg and amount > float(avg) * 10:
            return CheckResult(
                passed=True,
                warning=True,
                message=f"Amount Rs {amount:,.2f} is much higher than party average Rs {float(avg):,.2f}.",
            )
        return CheckResult(passed=True)

    def _check_party_required(self, entry: JournalEntry) -> CheckResult:
        party_intents = {"credit_sale", "payment_received", "payment_made", "credit_purchase"}
        if entry.intent in party_intents and not entry.party:
            return CheckResult(
                passed=True,
                warning=True,
                message="Party name recommended for this transaction type.",
            )
        return CheckResult(passed=True)

    def _check_vat_compliance(self, entry: JournalEntry) -> CheckResult:
        vat_lines = [l for l in entry.lines if l.account in ("KH-VAT-IN", "KH-VAT-OUT")]
        if not vat_lines:
            return CheckResult(passed=True)

        for vat_line in vat_lines:
            vat_amount = vat_line.debit or vat_line.credit
            sale_lines = [l for l in entry.lines if l.account == "KH-SALE"]
            if sale_lines and vat_line.account == "KH-VAT-OUT":
                base = sale_lines[0].credit
                expected = round(base * 0.13, 2)
                if abs(vat_amount - expected) > 1:
                    return CheckResult(
                        passed=False,
                        message=f"VAT error: expected Rs {expected:,.2f}, got Rs {vat_amount:,.2f}",
                    )
        return CheckResult(passed=True)

    def _check_cash_sufficiency(self, entry: JournalEntry, ctx: dict[str, Any]) -> CheckResult:
        cash_out = sum(l.credit for l in entry.lines if l.account == "KH-CASH")
        cash_bal = ctx.get("cash_balance")
        if cash_out > 0 and cash_bal is not None:
            projected = float(cash_bal) - cash_out
            if projected < 0:
                return CheckResult(
                    passed=True,
                    warning=True,
                    message=(
                        f"Cash insufficient! Current Rs {float(cash_bal):,.2f}, "
                        f"payment Rs {cash_out:,.2f}, after Rs {projected:,.2f}."
                    ),
                )
        return CheckResult(passed=True)

    def _check_duplicate(self, entry: JournalEntry, ctx: dict[str, Any]) -> CheckResult:
        if ctx.get("similar_entry_today"):
            similar = ctx["similar_entry_today"]
            return CheckResult(
                passed=True,
                warning=True,
                message=(
                    f"Similar entry today: Rs {similar.get('amount', 0):,.0f} "
                    f"for {similar.get('party', '')}. Duplicate?"
                ),
            )
        return CheckResult(passed=True)

    def _check_narration_quality(self, entry: JournalEntry) -> CheckResult:
        if not entry.narration or len(entry.narration.strip()) < 3:
            return CheckResult(
                passed=True,
                warning=True,
                message="Narration is very short — consider adding detail.",
            )
        return CheckResult(passed=True)

    def _auto_correct(
        self,
        entry: JournalEntry,
        failures: list[CheckResult],
    ) -> JournalEntry | None:
        error_descriptions = "\n".join(f"- {f.message}" for f in failures)
        prompt = f"""Fix this journal entry. Errors:
{error_descriptions}

Original:
{entry.model_dump_json(indent=2)}

Return corrected JSON. Total debits MUST equal total credits."""

        try:
            client = Client(host=OLLAMA_BASE_URL)
            response = client.chat(
                model=FAST_MODEL,
                messages=[{"role": "user", "content": prompt}],
                format=JournalEntry.model_json_schema(),
                options={"temperature": 0},
            )
            content = response.message.content
            if not content:
                return None
            corrected = JournalEntry.model_validate_json(content)
            total_dr = sum(l.debit for l in corrected.lines)
            total_cr = sum(l.credit for l in corrected.lines)
            if abs(total_dr - total_cr) < 0.01:
                return corrected
        except Exception as exc:
            logger.warning("Auto-correct failed: %s", exc)
        return None


_default_verifier: EntryVerifier | None = None


def get_entry_verifier() -> EntryVerifier:
    global _default_verifier
    if _default_verifier is None:
        _default_verifier = EntryVerifier()
    return _default_verifier
