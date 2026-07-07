"""
Accounting Reasoner — Uses LLM for complex transaction analysis
with mandatory chain-of-thought and double-entry validation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ollama import Client
from pydantic import BaseModel, Field, field_validator

from ..config import OLLAMA_BASE_URL, PRIMARY_MODEL, PRIMARY_MODEL_OPTIONS, DEEP_MODEL
from ..knowledge.nepal_accounting_kb import (
    CHART_OF_ACCOUNTS,
    build_journal_lines,
    format_kb_snippet,
    get_entry_rule,
    resolve_rule_key,
)
from ..knowledge.chart_of_accounts_framework import detect_sector, format_coa_context
from ..nlu.engine import ParsedEntry

logger = logging.getLogger(__name__)

REASONING_SYSTEM_PROMPT = """You are a Chartered Accountant (CA Nepal) with 20 years
of experience. You think through every transaction step by step.

FOR EVERY TRANSACTION, follow this reasoning chain:

STEP 1 — CLASSIFY: What type of transaction is this?
  (revenue, expense, asset acquisition, liability, equity, adjustment)

STEP 2 — IDENTIFY ACCOUNTS: Which accounts are affected?
  Apply the DEAD CLIC rule:
  - Debit: Expenses, Assets, Drawings INCREASE
  - Credit: Liabilities, Income, Capital INCREASE

STEP 3 — DETERMINE AMOUNTS: Calculate exact amounts.
  - Is VAT applicable? (13% on VAT-registered transactions)
  - Is TDS applicable? (check TDS rate table)
  - Any discounts?

STEP 4 — CONSTRUCT JOURNAL: Build the double-entry.
  GOLDEN RULE: Total Debits MUST EXACTLY EQUAL Total Credits.

STEP 5 — VALIDATE:
  - Does the entry make accounting sense?
  - Are the account classifications correct?
  - Is the narration clear?

STEP 6 — EXPLAIN: Provide a clear explanation in both English and Nepali.

CONTEXTUAL WORD-SENSE (Nepali/Roman) — apply before classifying:
- "X lai diye/becheko" = credit sale TO customer X
- "X le tiryo/aayo" = payment received FROM X
- "X lai tiryo" = payment made TO X (expense/payable)
- "X bata kineko" = purchase FROM supplier X
- Postposition (le/lai/bata) changes meaning of same verb — never ignore it

Use session context and sector when account names are ambiguous.
Same word means different accounts by sector (e.g. premium, loan, stock).

NEPAL-SPECIFIC RULES:
- Fiscal year: Shrawan 1 to Ashad 31 (mid-July to mid-July)
- VAT rate: 13% standard
- SSF: Employee 10% + Employer 11% = 21% total on basic salary
- TDS must be deducted at source for payments > threshold
- Gratuity: 8.33% of basic salary (1 month per year of service)
- Bonus: 10% of net profit (mandatory for companies with profit)

RESPOND ONLY IN THE STRUCTURED JSON FORMAT PROVIDED.
Do NOT add explanations outside the JSON.
"""


class JournalLine(BaseModel):
    """Single journal line."""

    account: str
    name: str = ""
    debit: float = Field(ge=0, default=0)
    credit: float = Field(ge=0, default=0)
    description: str = ""


class JournalEntry(BaseModel):
    """Balanced double-entry journal."""

    intent: str
    amount: float
    party: str | None = None
    narration: str = ""
    lines: list[JournalLine]
    explanation: str = ""
    explanation_nepali: str = ""
    confidence: float = Field(ge=0, le=1, default=0.8)
    khata_intent: str | None = None

    @field_validator("lines")
    @classmethod
    def lines_must_balance(cls, lines: list[JournalLine]) -> list[JournalLine]:
        total_dr = sum(l.debit for l in lines)
        total_cr = sum(l.credit for l in lines)
        if lines and abs(total_dr - total_cr) >= 0.02:
            raise ValueError(f"Journal not balanced: Dr={total_dr} Cr={total_cr}")
        return lines

    def to_khata_card(self, raw_text: str) -> dict[str, Any]:
        """Convert to khata_chat card format."""
        return {
            "intent": self.khata_intent or self.intent,
            "party": self.party,
            "amount": int(round(self.amount)),
            "date": None,
            "raw_text": raw_text,
            "journalLines": [
                {
                    "accountCode": l.account,
                    "accountName": l.name or l.account,
                    "debit": l.debit,
                    "credit": l.credit,
                }
                for l in self.lines
            ],
            "caExplanation": self.explanation,
        }


class SessionContext(BaseModel):
    """Minimal session context for multi-turn reasoning."""

    session_id: str = "default"
    recent_messages: list[dict[str, str]] = Field(default_factory=list)
    recent_parties: list[str] = Field(default_factory=list)
    balance: dict[str, Any] | None = None
    last_intent: str | None = None
    business_sector: str | None = None
    pending_slots: dict[str, Any] = Field(default_factory=dict)
    wsd_summary: str | None = None

    def get_recent_messages(self, limit: int = 5) -> list[dict[str, str]]:
        return self.recent_messages[-limit:]


class AccountingReasoner:
    """
    Template-first reasoner with LLM fallback for ambiguous transactions.

    High-confidence NLU parses use ENTRY_RULES templates (<1ms).
    Low-confidence or complex cases use primary model with structured JSON.
    """

    def __init__(
        self,
        primary_model: str | None = None,
        base_url: str | None = None,
    ):
        self.primary_model = primary_model or PRIMARY_MODEL
        self._client = Client(host=base_url or OLLAMA_BASE_URL)

    def reason_entry(
        self,
        parsed: ParsedEntry,
        context: SessionContext | None = None,
    ) -> JournalEntry:
        """
        Build journal entry from parsed NLU output.

        Uses templates when confidence >= 0.85 and no clarification needed.
        Otherwise delegates to LLM reasoning.
        """
        if parsed.needs_clarification or not parsed.amount:
            raise ValueError(
                parsed.clarification_question or "Amount or intent unclear — need clarification"
            )

        if parsed.statutory_bundle and parsed.amount:
            try:
                return self._payroll_statutory_entry(parsed)
            except Exception as exc:
                logger.warning("Payroll statutory template failed: %s", exc)

        if parsed.confidence >= 0.85 and parsed.intent != "unknown":
            try:
                return self._template_entry(parsed)
            except (ValueError, KeyError) as exc:
                logger.warning("Template entry failed, falling back to LLM: %s", exc)

        return self._llm_reason_entry(parsed, context or SessionContext())

    def _template_entry(self, parsed: ParsedEntry) -> JournalEntry:
        """Instant template-based entry for high-confidence parses."""
        rule_key = resolve_rule_key(parsed.intent)
        if not rule_key:
            raise ValueError(f"No template for intent: {parsed.intent}")

        rule = get_entry_rule(parsed.intent)
        if not rule:
            raise ValueError(f"No entry rule for intent: {parsed.intent}")

        use_vat = parsed.vat_inclusive or parsed.intent in ("vat_sale", "vat_purchase")
        tds_rate = parsed.tds_rate if parsed.tds_applicable else None

        raw_lines = build_journal_lines(
            rule_key,
            float(parsed.amount),
            vat_inclusive=use_vat,
            secondary_amount=parsed.secondary_amount,
            tds_rate=tds_rate,
        )

        lines = [
            JournalLine(
                account=row["account"],
                name=row.get("accountName", row["account"]),
                debit=row["debit"],
                credit=row["credit"],
                description=row.get("description", ""),
            )
            for row in raw_lines
        ]

        return JournalEntry(
            intent=parsed.intent,
            khata_intent=rule.get("khata_intent") or parsed.khata_intent,
            amount=float(parsed.amount),
            party=parsed.party,
            narration=parsed.narration,
            lines=lines,
            explanation=rule.get("english_explanation", ""),
            explanation_nepali=rule.get("nepali_explanation", ""),
            confidence=parsed.confidence,
        )

    def _payroll_statutory_entry(self, parsed: ParsedEntry) -> JournalEntry:
        """Single balanced payroll voucher: gross salary + SSF employee + employer + net bank."""
        from ..knowledge.nepal_accounting_kb import NEPAL_TAX_RATES

        gross = float(parsed.amount)
        ssf_emp = round(gross * NEPAL_TAX_RATES["ssf"]["employee_contribution"], 2)
        ssf_er = round(gross * NEPAL_TAX_RATES["ssf"]["employer_contribution"], 2)
        net_bank = round(gross - ssf_emp, 2)

        lines = [
            JournalLine(account="KH-SAL", name="Salary Expense", debit=gross, credit=0, description="Gross salary"),
            JournalLine(
                account="KH-SSF-ER-EXP",
                name="SSF Employer Expense",
                debit=ssf_er,
                credit=0,
                description="Employer SSF 11%",
            ),
            JournalLine(
                account="KH-SSF-EMP",
                name="SSF Employee Payable",
                debit=0,
                credit=ssf_emp,
                description="SSF employee 10%",
            ),
            JournalLine(
                account="KH-SSF-ER",
                name="SSF Employer Payable",
                debit=0,
                credit=ssf_er,
                description="SSF employer 11%",
            ),
            JournalLine(
                account="KH-BANK",
                name="Bank Account",
                debit=0,
                credit=net_bank,
                description="Net salary to bank",
            ),
        ]
        return JournalEntry(
            intent="salary",
            khata_intent="khata_salary_payment",
            amount=gross,
            party=parsed.party,
            narration=parsed.narration,
            lines=lines,
            explanation="Payroll: gross salary + SSF (employee 10%, employer 11%) + net bank payment.",
            explanation_nepali=(
                f"Talab Rs {gross:,.0f}: SSF karmachari {ssf_emp:,.0f}, employer {ssf_er:,.0f}, "
                f"net bank {net_bank:,.0f}."
            ),
            confidence=max(parsed.confidence, 0.9),
        )

    def _llm_reason_entry(
        self,
        parsed: ParsedEntry,
        context: SessionContext,
    ) -> JournalEntry:
        """Full LLM reasoning for complex/ambiguous entries."""
        kb_context = format_kb_snippet(intent=parsed.intent, query=parsed.narration)
        sector_name = context.business_sector or detect_sector(parsed.narration)
        sector_ctx = format_coa_context(parsed.narration, max_chars=800)
        use_model = DEEP_MODEL if (
            parsed.statutory_bundle or parsed.confidence < 0.7 or len(parsed.narration) > 120
        ) else self.primary_model

        session_lines: list[str] = []
        if context.last_intent:
            session_lines.append(f"Last intent in session: {context.last_intent}")
        if context.pending_slots:
            session_lines.append(f"Pending slots: {context.pending_slots}")
        if context.recent_parties:
            session_lines.append(f"Recent parties: {', '.join(context.recent_parties[-5:])}")
        if context.wsd_summary:
            session_lines.append(context.wsd_summary)
        session_block = "\n".join(session_lines)

        user_content = f"""Analyze this transaction and create the journal entry:

Message: "{parsed.narration}"
Detected intent: {parsed.intent} (confidence: {parsed.confidence})
Amount: {parsed.amount}
Party: {parsed.party}
VAT inclusive: {parsed.vat_inclusive}
TDS applicable: {parsed.tds_applicable}
Payment method: {parsed.payment_method}
Business sector: {sector_name}
Date hint: {getattr(parsed, 'transaction_date', None)}

{session_block}

{kkb_context_block(kb_context)}
{kkb_context_block(sector_ctx)}

Available accounts: {json.dumps(list(CHART_OF_ACCOUNTS.keys()))}

Think step by step, then provide the balanced journal entry JSON."""

        messages: list[dict[str, str]] = [
            {"role": "system", "content": REASONING_SYSTEM_PROMPT},
        ]
        messages.extend(context.get_recent_messages(limit=5))
        messages.append({"role": "user", "content": user_content})

        try:
            response = self._client.chat(
                model=use_model,
                messages=messages,
                format=JournalEntry.model_json_schema(),
                options={"num_ctx": 4096, "temperature": 0.1, "top_p": 0.9},
            )
            content = response.message.content
            if not content:
                raise ValueError("empty LLM response")
            entry = JournalEntry.model_validate_json(content)
        except Exception as exc:
            logger.warning("LLM reason failed, retrying with template: %s", exc)
            return self._template_entry(parsed)

        total_dr = sum(l.debit for l in entry.lines)
        total_cr = sum(l.credit for l in entry.lines)
        if abs(total_dr - total_cr) >= 0.01:
            entry = self._self_correct(entry, total_dr, total_cr, context)

        if not entry.khata_intent:
            rule = get_entry_rule(entry.intent)
            if rule:
                entry.khata_intent = rule.get("khata_intent")

        return entry

    def _self_correct(
        self,
        entry: JournalEntry,
        total_dr: float,
        total_cr: float,
        context: SessionContext,
    ) -> JournalEntry:
        """Ask LLM to fix an unbalanced entry."""
        fix_prompt = f"""The journal entry is NOT balanced (Dr={total_dr}, Cr={total_cr}).
Fix the amounts so total debits equal total credits. Return corrected JSON only.

Original entry:
{entry.model_dump_json()}"""

        messages: list[dict[str, str]] = [
            {"role": "system", "content": REASONING_SYSTEM_PROMPT},
            *context.get_recent_messages(limit=3),
            {"role": "user", "content": fix_prompt},
        ]

        try:
            response = self._client.chat(
                model=self.primary_model,
                messages=messages,
                format=JournalEntry.model_json_schema(),
                options={"temperature": 0, "num_ctx": 4096},
            )
            content = response.message.content
            if content:
                return JournalEntry.model_validate_json(content)
        except Exception as exc:
            logger.error("Self-correction failed: %s", exc)

        return entry


def kkb_context_block(kb_context: str) -> str:
    if not kb_context.strip():
        return ""
    return f"Knowledge base context:\n{kb_context}"


_default_reasoner: AccountingReasoner | None = None


def get_accounting_reasoner() -> AccountingReasoner:
    """Singleton accounting reasoner."""
    global _default_reasoner
    if _default_reasoner is None:
        _default_reasoner = AccountingReasoner()
    return _default_reasoner
