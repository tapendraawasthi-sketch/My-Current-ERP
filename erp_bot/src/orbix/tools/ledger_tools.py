"""Deterministic accounting math + validation tools.

The LLM only *extracts* the event (via KHATA_EXTRACTION_PROMPT). All arithmetic,
double-entry balancing, and validation are done in Python so results are exact
and cannot be hallucinated. Posting is a separate confirmation-gated tool.
"""

from __future__ import annotations

import hashlib
import re

from pydantic import BaseModel, Field

from ..schemas import EvidenceRef, ToolResult
from .registry import ToolRegistry, ToolSpec

_LEDGER_SEQ = 0


def _next_evidence_id() -> str:
    global _LEDGER_SEQ
    _LEDGER_SEQ += 1
    return f"ev_ledger_{_LEDGER_SEQ:04d}"


class LedgerLine(BaseModel):
    account: str
    debit: float = 0.0
    credit: float = 0.0
    party: str | None = None
    explanation: str | None = None


# ── amount normalization (Nepali-aware) ─────────────────────────────────────────
_WORD_MULT = {
    "hajar": 1_000,
    "hajaar": 1_000,
    "thousand": 1_000,
    "k": 1_000,
    "lakh": 100_000,
    "lac": 100_000,
    "crore": 10_000_000,
    "karod": 10_000_000,
}


def normalize_amount(text: str | float | int) -> float:
    if isinstance(text, (int, float)):
        return float(text)
    s = str(text).lower().replace(",", "").strip()
    s = re.sub(r"(rs\.?|npr|nrs|rupees?|rupiya)", " ", s)
    # e.g. "5 hajar", "1.5 lakh", "5k"
    m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*([a-z]+)?\s*$", s)
    if m:
        num = float(m.group(1))
        unit = m.group(2)
        if unit and unit in _WORD_MULT:
            return num * _WORD_MULT[unit]
        return num
    nums = re.findall(r"\d+(?:\.\d+)?", s)
    if nums:
        return float(nums[0])
    return 0.0


# ── parse_accounting_event (LLM extraction + deterministic normalization) ────────
async def _parse_accounting_event(args: dict) -> ToolResult:
    # This tool relies on a pre-extracted event injected by the engine, or a raw
    # text that is normalized deterministically. The LLM extraction call is done
    # in the engine to keep tools free of LLM dependencies.
    event = args.get("event") or {}
    text = str(args.get("text", "")).strip()

    if not event and not text:
        return ToolResult(ok=False, error="Provide 'event' (structured) or 'text'.")

    gross = normalize_amount(event.get("gross_amount", 0) or 0)
    discount = normalize_amount(event.get("discount", 0) or 0)
    cash = event.get("cash_amount")
    cash_amount = normalize_amount(cash) if cash not in (None, "", 0) else max(gross - discount, 0)
    party = event.get("party")
    item = event.get("item")
    event_type = (event.get("event_type") or "other").strip()

    return ToolResult(
        ok=True,
        summary=f"Parsed event: {event_type} party={party} gross={gross} discount={discount} cash={cash_amount}",
        data={
            "event_type": event_type,
            "party": party,
            "item": item,
            "gross_amount": gross,
            "discount": discount,
            "cash_amount": cash_amount,
        },
    )


# ── calculate_journal (build balanced lines from an event) ───────────────────────
def build_journal_lines(event: dict) -> list[LedgerLine]:
    et = (event.get("event_type") or "other").strip()
    party = event.get("party") or "Party"
    gross = normalize_amount(event.get("gross_amount", 0) or 0)
    discount = normalize_amount(event.get("discount", 0) or 0)
    cash = event.get("cash_amount")
    cash_amount = normalize_amount(cash) if cash not in (None, "", 0) else max(gross - discount, 0)

    lines: list[LedgerLine] = []

    if et == "credit_sale":
        lines = [
            LedgerLine(account=f"{party} (Receivable)", debit=gross, party=party),
            LedgerLine(account="Sales", credit=gross),
        ]
    elif et == "cash_sale":
        lines = [
            LedgerLine(account="Cash", debit=gross),
            LedgerLine(account="Sales", credit=gross),
        ]
    elif et == "credit_purchase":
        lines = [
            LedgerLine(account="Purchase", debit=gross),
            LedgerLine(account=f"{party} (Payable)", credit=gross, party=party),
        ]
    elif et == "cash_purchase":
        lines = [
            LedgerLine(account="Purchase", debit=gross),
            LedgerLine(account="Cash", credit=gross),
        ]
    elif et == "payment_in":
        lines = [
            LedgerLine(account="Cash", debit=gross),
            LedgerLine(account=f"{party} (Receivable)", credit=gross, party=party),
        ]
    elif et == "payment_out":
        lines = [
            LedgerLine(account=f"{party} (Payable)", debit=gross, party=party),
            LedgerLine(account="Cash", credit=gross),
        ]
    elif et == "debtor_settlement_with_discount":
        lines = [
            LedgerLine(account="Cash", debit=cash_amount),
            LedgerLine(account="Discount Allowed", debit=discount, explanation="Discount given on settlement"),
            LedgerLine(account=f"{party} (Receivable)", credit=gross, party=party),
        ]
    elif et == "expense":
        lines = [
            LedgerLine(account=(event.get("item") or "Expense").title(), debit=gross),
            LedgerLine(account="Cash", credit=gross),
        ]
    else:
        lines = []

    return lines


def _totals(lines: list[LedgerLine]) -> tuple[float, float]:
    return (
        round(sum(l.debit for l in lines), 2),
        round(sum(l.credit for l in lines), 2),
    )


async def _calculate_journal(args: dict) -> ToolResult:
    # Accept either a structured event or explicit lines.
    if args.get("lines"):
        lines = [LedgerLine(**l) for l in args["lines"]]
    elif args.get("event"):
        lines = build_journal_lines(args["event"])
    else:
        return ToolResult(ok=False, error="Provide 'event' or 'lines'.")

    if not lines:
        return ToolResult(
            ok=False,
            error="Could not build a journal for this event type. Ask the user to clarify.",
        )

    debit_total, credit_total = _totals(lines)
    balanced = abs(debit_total - credit_total) < 0.01

    lines_payload = [l.model_dump() for l in lines]
    preview = "\n".join(
        f"  {'DR' if l.debit else 'CR'} {l.account}: "
        f"{(l.debit or l.credit):,.2f}"
        for l in lines
    )
    ev = EvidenceRef(
        id=_next_evidence_id(),
        source_type="ledger",
        uri="ledger:calculate_journal",
        snippet=f"{preview}\nDR total={debit_total} CR total={credit_total} balanced={balanced}",
        content_hash=hashlib.sha256(preview.encode()).hexdigest()[:16],
    )

    return ToolResult(
        ok=True,
        summary=f"Journal built: DR {debit_total:,.2f} = CR {credit_total:,.2f} (balanced={balanced}).",
        evidence=[ev],
        data={
            "lines": lines_payload,
            "debit_total": debit_total,
            "credit_total": credit_total,
            "balanced": balanced,
        },
    )


# ── validate_double_entry ────────────────────────────────────────────────────────
async def _validate_double_entry(args: dict) -> ToolResult:
    raw_lines = args.get("lines") or []
    if not raw_lines:
        return ToolResult(ok=False, error="lines are required")
    lines = [LedgerLine(**l) for l in raw_lines]

    errors: list[str] = []
    for l in lines:
        if l.debit < 0 or l.credit < 0:
            errors.append(f"Negative amount on {l.account}")
        if l.debit and l.credit:
            errors.append(f"{l.account} has both debit and credit")

    debit_total, credit_total = _totals(lines)
    if abs(debit_total - credit_total) >= 0.01:
        errors.append(f"Unbalanced: DR {debit_total} != CR {credit_total}")

    ok = not errors
    return ToolResult(
        ok=True,
        summary="Valid double-entry." if ok else f"Invalid: {'; '.join(errors)}",
        data={
            "valid": ok,
            "errors": errors,
            "debit_total": debit_total,
            "credit_total": credit_total,
        },
    )


# ── simulate_voucher (confirmation payload only; NO mutation) ─────────────────────
async def _simulate_voucher(args: dict) -> ToolResult:
    calc = await _calculate_journal(args)
    if not calc.ok:
        return calc
    data = calc.data
    if not data.get("balanced"):
        return ToolResult(
            ok=False,
            error=f"Refusing to simulate an unbalanced voucher (DR {data['debit_total']} != CR {data['credit_total']}).",
        )
    payload = {
        "type": "voucher",
        "lines": data["lines"],
        "debit_total": data["debit_total"],
        "credit_total": data["credit_total"],
        "party": args.get("event", {}).get("party") if args.get("event") else None,
    }
    return ToolResult(
        ok=True,
        summary="Voucher simulated. Awaiting user confirmation before posting.",
        evidence=calc.evidence,
        data={"confirmation_payload": payload, **data},
    )


# ── post_confirmed_voucher (mutation; requires confirmation token) ────────────────
async def _post_confirmed_voucher(args: dict) -> ToolResult:
    # Gated by requires_confirmation=True at the registry level.
    # IMPORTANT (Model B): This tool does NOT write to the browser Dexie ledger.
    # It only signals that the client may execute a local authoritative post.
    # Never treat `ready_for_local_post` as proof that vouchers/journals/stock exist.
    if not args.get("confirmed"):
        return ToolResult(
            ok=False,
            error="post_confirmed_voucher called without an explicit confirmation.",
        )
    payload = args.get("confirmation_payload") or {}
    return ToolResult(
        ok=True,
        summary=(
            "Confirmation accepted for client-side posting. "
            "The ERP browser will persist accounting records to Dexie; "
            "this backend did not write the ledger."
        ),
        data={
            "ready_for_local_post": True,
            "confirmation_accepted_for_client_execution": True,
            # Deprecated misleading field — kept false to prevent false ledger claims
            "posted": False,
            "posting_authority": "dexie_local_first",
            "confirmation_payload": payload,
        },
    )


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="parse_accounting_event",
            description="Normalize a structured accounting event (amounts, discount, cash) without posting.",
            input_schema={
                "type": "object",
                "properties": {
                    "event": {"type": "object"},
                    "text": {"type": "string"},
                },
            },
        ),
        _parse_accounting_event,
    )
    registry.register(
        ToolSpec(
            name="calculate_journal",
            description="Build balanced double-entry journal lines from an event or explicit lines; returns totals and balanced flag.",
            input_schema={
                "type": "object",
                "properties": {
                    "event": {"type": "object"},
                    "lines": {"type": "array", "items": {"type": "object"}},
                },
            },
        ),
        _calculate_journal,
    )
    registry.register(
        ToolSpec(
            name="validate_double_entry",
            description="Validate that journal lines are balanced, non-negative, and single-sided.",
            input_schema={
                "type": "object",
                "properties": {"lines": {"type": "array", "items": {"type": "object"}}},
                "required": ["lines"],
            },
        ),
        _validate_double_entry,
    )
    registry.register(
        ToolSpec(
            name="simulate_voucher",
            description="Produce a confirmation payload for a proposed voucher. Does NOT post anything.",
            input_schema={
                "type": "object",
                "properties": {
                    "event": {"type": "object"},
                    "lines": {"type": "array", "items": {"type": "object"}},
                },
            },
        ),
        _simulate_voucher,
    )
    registry.register(
        ToolSpec(
            name="post_confirmed_voucher",
            description="Post a voucher AFTER explicit user confirmation. Mutating; never call without confirmation.",
            input_schema={
                "type": "object",
                "properties": {
                    "confirmed": {"type": "boolean"},
                    "confirmation_payload": {"type": "object"},
                },
                "required": ["confirmed"],
            },
            read_only=False,
            requires_confirmation=True,
        ),
        _post_confirmed_voucher,
    )
