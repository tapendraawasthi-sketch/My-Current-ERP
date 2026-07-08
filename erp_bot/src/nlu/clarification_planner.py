"""
Slot-based clarification planner — merge short follow-ups into pending entries.

Handles replies like "cash", "Ram", "500", "5 x 200" without re-parsing the
full original message from scratch.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

from .engine import ParsedEntry, PaymentMethod
from .erp_action_policy import resolve_erp_action_policy
from .text_normalize import extract_amount, normalize_for_matching

try:
    from ..knowledge.vocabulary_loader import get_payment_aliases as _vocab_payment_aliases
except ImportError:
    _vocab_payment_aliases = None  # type: ignore[assignment,misc]

SlotName = Literal["amount", "party", "payment_method", "intent"]

_SLOT_PRIORITY: tuple[SlotName, ...] = ("amount", "party", "payment_method", "intent")

_BASE_PAYMENT_ALIASES: dict[str, PaymentMethod] = {
    "cash": "cash",
    "nagad": "cash",
    "nakad": "cash",
    "nagar": "cash",
    "npr": "cash",
    "bank": "bank",
    "transfer": "bank",
    "cheque": "cheque",
    "check": "cheque",
    "esewa": "esewa",
    "khalti": "khalti",
    "fonepay": "esewa",
    "connectips": "bank",
    "online": "esewa",
    "digital": "esewa",
    "wallet": "esewa",
    "udhaar": "unknown",
    "udhar": "unknown",
    "credit": "unknown",
}


def _payment_aliases() -> dict[str, PaymentMethod]:
    if _vocab_payment_aliases is None:
        return _BASE_PAYMENT_ALIASES
    merged = dict(_BASE_PAYMENT_ALIASES)
    merged.update(_vocab_payment_aliases())
    return merged

_PARTY_STOPWORDS = frozenset(
    {
        "aaja",
        "aja",
        "hijo",
        "bholi",
        "yo",
        "tyo",
        "mero",
        "hamro",
        "cash",
        "nagad",
        "bank",
        "esewa",
        "khalti",
        "online",
        "rakam",
        "amount",
        "rs",
        "npr",
    }
)


@dataclass
class FollowupResult:
    parsed: ParsedEntry
    filled_slots: dict[str, Any]
    missing_slots: list[str]
    complete: bool
    question: str | None = None
    slots_filled_this_turn: list[str] = field(default_factory=list)


def infer_required_slots(
    parsed: ParsedEntry,
    filled_slots: dict[str, Any] | None = None,
) -> tuple[str, ...]:
    """Infer which slots must be filled before posting."""
    filled = filled_slots or {}
    required: list[str] = []

    if parsed.erp_action:
        policy = resolve_erp_action_policy(
            erp_action=parsed.erp_action,
            confidence=parsed.confidence,
            parsed=parsed,
            clarification_needed=parsed.needs_clarification,
            clarification_question=parsed.clarification_question,
        )
        for slot in policy.required_slots:
            if slot not in required:
                required.append(slot)

    merged_amount = parsed.amount or filled.get("amount")
    merged_party = parsed.party or filled.get("party")
    merged_payment = (
        parsed.payment_method
        if parsed.payment_method != "unknown"
        else filled.get("payment_method", "unknown")
    )

    if not merged_amount and "amount" not in required:
        required.append("amount")

    intent = parsed.intent
    party_optional = intent in {
        "expense",
        "drawings",
        "depreciation",
        "bank_charges",
        "interest_expense",
        "closing_entry",
    }
    if not merged_party and not party_optional and "party" not in required:
        required.append("party")

    payment_needed = intent in {
        "cash_sale",
        "cash_purchase",
        "payment_received",
        "payment_made",
        "vat_sale",
        "vat_purchase",
        "unknown",
    }
    if (
        payment_needed
        and merged_payment == "unknown"
        and "payment_method" not in required
    ):
        required.append("payment_method")

    return tuple(s for s in _SLOT_PRIORITY if s in required)


def missing_slots(
    parsed: ParsedEntry,
    filled_slots: dict[str, Any],
    required_slots: tuple[str, ...] | list[str],
) -> list[str]:
    """Return required slots that are still empty."""
    missing: list[str] = []
    for slot in required_slots:
        if slot == "amount":
            val = parsed.amount or filled_slots.get("amount")
            if val is None or float(val) <= 0:
                missing.append(slot)
        elif slot == "party":
            if not (parsed.party or filled_slots.get("party")):
                missing.append(slot)
        elif slot == "payment_method":
            pm = parsed.payment_method
            if pm == "unknown":
                pm = filled_slots.get("payment_method", "unknown")
            if pm == "unknown":
                missing.append(slot)
        elif slot == "intent":
            if parsed.intent == "unknown" and not filled_slots.get("intent"):
                missing.append(slot)
    return missing


def extract_qty_rate_amount(text: str) -> float | None:
    """Parse qty × rate patterns common in Nepali shop follow-ups."""
    raw = normalize_for_matching(text)
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:x|×|\*|by)\s*(\d+(?:\.\d+)?)\b", raw)
    if m:
        return float(m.group(1)) * float(m.group(2))
    m = re.search(
        r"\b(\d+)\s*(?:piece|pcs|pc|unit|tin|bag|kg|kgs|litre|liter|l)\b.*?"
        r"(?:rs\.?|npr|rate|@)?\s*(\d+(?:\.\d+)?)\b",
        raw,
    )
    if m:
        return float(m.group(1)) * float(m.group(2))
    m = re.search(
        r"\b(?:eutako|euta\s*ko|per\s*piece|each)\b.*?(\d+(?:\.\d+)?)\b",
        raw,
    )
    if m:
        return float(m.group(1))
    return None


def parse_payment_method(text: str) -> PaymentMethod | None:
    norm = normalize_for_matching(text)
    if re.search(r"\b(udhaar|udhar|credit)\b", norm):
        return "unknown"
    for token, method in _payment_aliases().items():
        if re.search(rf"\b{re.escape(token)}\b", norm):
            return method
    if re.search(r"\bma\b", norm) and re.search(r"\b(cash|nagad|bank|esewa|khalti)\b", norm):
        for token, method in _payment_aliases().items():
            if token in norm.split():
                return method
    return None


def parse_party_name(text: str, recent_parties: list[str] | None = None) -> str | None:
    """Extract party from a short follow-up."""
    raw = (text or "").strip()
    if not raw:
        return None

    norm = normalize_for_matching(raw)

    if re.search(r"\b(tyo|wahi|same|uni|uha)\b", norm) and recent_parties:
        return recent_parties[-1]

    m = re.search(
        r"(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:lai|le|bata|ko|sanga)\b",
        raw,
        re.I,
    )
    if m:
        name = m.group(1).strip().title()
        if name.lower() not in _PARTY_STOPWORDS:
            return name

    m = re.search(r"(?:^|\s)([a-z]{2,15})\s+(?:lai|le|bata|ko|sanga)\b", raw, re.I)
    if m:
        name = m.group(1).strip().title()
        if name.lower() not in _PARTY_STOPWORDS:
            return name

    # Bare name: "Ram", "Ram ko", "Sita Painter"
    bare = re.sub(r"\s+ko\s*$", "", raw, flags=re.I).strip()
    if re.fullmatch(r"[A-Za-z][A-Za-z\s]{1,30}", bare):
        tokens = bare.split()
        if len(tokens) <= 3 and tokens[0].lower() not in _PARTY_STOPWORDS:
            return bare.title()

    m = re.search(r"[\u0900-\u097F]{2,20}", raw)
    if m:
        return m.group(0)

    return None


def parse_part_cost(text: str) -> float | None:
    norm = normalize_for_matching(text)
    for pat in (
        r"(?:part\s*(?:cost|ko\s*cost)|cost)\s*(?:rs\.?|npr)?\s*([\d,]+(?:\.\d+)?)",
        r"([\d,]+(?:\.\d+)?)\s*(?:ko\s*)?part(?:\s*cost)?",
    ):
        m = re.search(pat, norm)
        if m:
            return float(m.group(1).replace(",", ""))
    return None


def parse_cash_portion(text: str) -> float | None:
    norm = normalize_for_matching(text)
    for pat in (
        r"(?:cash|nagad)\s*(?:portion|part|ma)?\s*(?:rs\.?)?\s*([\d,]+(?:\.\d+)?)",
        r"([\d,]+(?:\.\d+)?)\s*(?:cash|nagad)",
        r"half\s+cash.*?([\d,]+(?:\.\d+)?)",
    ):
        m = re.search(pat, norm)
        if m:
            return float(m.group(1).replace(",", ""))
    return None


def parse_trade_in_value(text: str) -> float | None:
    norm = normalize_for_matching(text)
    for pat in (
        r"(?:trade[\s-]?in|exchange)\s*(?:value|ko\s*mulya)?\s*(?:rs\.?)?\s*([\d,]+(?:\.\d+)?)",
        r"([\d,]+(?:\.\d+)?)\s*(?:trade[\s-]?in|exchange)",
    ):
        m = re.search(pat, norm)
        if m:
            return float(m.group(1).replace(",", ""))
    return None


def parse_slot_values(
    message: str,
    target_slots: list[str],
    *,
    recent_parties: list[str] | None = None,
) -> dict[str, Any]:
    """Parse follow-up message for one or more slot values."""
    found: dict[str, Any] = {}
    text = (message or "").strip()
    if not text:
        return found

    norm = normalize_for_matching(text)

    if "amount" in target_slots:
        qty_amt = extract_qty_rate_amount(text)
        amt = qty_amt if qty_amt else extract_amount(text)
        if amt and amt > 0:
            found["amount"] = float(amt)
        elif re.fullmatch(r"\d+(?:\.\d+)?", norm.replace(",", "")):
            found["amount"] = float(norm.replace(",", ""))

    if "payment_method" in target_slots:
        pm = parse_payment_method(text)
        if pm and pm != "unknown":
            found["payment_method"] = pm
        elif re.search(r"\b(udhaar|udhar|credit)\b", norm):
            found["payment_method"] = "credit_marker"

    if "party" in target_slots:
        party = parse_party_name(text, recent_parties)
        if party:
            found["party"] = party

    if "intent" in target_slots:
        if re.search(r"\b(becheko|bikri|sold)\b", norm):
            found["intent"] = "cash_sale" if found.get("payment_method") == "cash" else "credit_sale"
        elif re.search(r"\b(kineko|kharid|bought)\b", norm):
            found["intent"] = "cash_purchase" if found.get("payment_method") == "cash" else "credit_purchase"
        elif re.search(r"\b(tiryo|tireko|aayo)\b", norm):
            found["intent"] = "payment_received" if re.search(r"\b(le|bata)\b", norm) else "payment_made"
        elif re.search(r"\b(kharcha|expense)\b", norm):
            found["intent"] = "expense"

    part_cost = parse_part_cost(text)
    if part_cost and part_cost > 0:
        found["part_cost"] = part_cost
    cash_portion = parse_cash_portion(text)
    if cash_portion and cash_portion > 0:
        found["cash_portion"] = cash_portion
    trade_in = parse_trade_in_value(text)
    if trade_in and trade_in > 0:
        found["trade_in_value"] = trade_in

    return found


def merge_slots_into_parsed(
    parsed: ParsedEntry,
    filled_slots: dict[str, Any],
) -> ParsedEntry:
    """Apply accumulated slot values onto ParsedEntry."""
    updates: dict[str, Any] = {}
    amount = parsed.amount or filled_slots.get("amount")
    if amount is not None:
        updates["amount"] = float(amount)

    party = parsed.party or filled_slots.get("party")
    if party:
        updates["party"] = str(party)

    pm = parsed.payment_method
    slot_pm = filled_slots.get("payment_method")
    if pm == "unknown" and slot_pm and slot_pm != "credit_marker":
        updates["payment_method"] = slot_pm
    elif slot_pm == "credit_marker" and pm == "unknown":
        updates["payment_method"] = "unknown"

    slot_intent = filled_slots.get("intent")
    if parsed.intent == "unknown" and slot_intent:
        updates["intent"] = slot_intent

    if filled_slots.get("part_cost"):
        updates["secondary_amount"] = float(filled_slots["part_cost"])
    elif filled_slots.get("cash_portion"):
        updates["secondary_amount"] = float(filled_slots["cash_portion"])

    if filled_slots.get("trade_in_value"):
        updates["tertiary_amount"] = float(filled_slots["trade_in_value"])

    if updates:
        updates["needs_clarification"] = False
    return parsed.model_copy(update=updates)


def build_clarification_question(
    missing: list[str],
    filled_slots: dict[str, Any],
    parsed: ParsedEntry,
) -> str:
    """Build the next slot-specific clarification question."""
    if parsed.clarification_question and len(missing) > 1:
        pass  # keep compound question when multiple slots missing
    elif parsed.clarification_question and missing:
        first = missing[0]
        if first == "amount" and "party" in filled_slots:
            return f"{filled_slots['party']} ko lagi kati rakam ho?"
        if first == "party" and filled_slots.get("amount"):
            return f"Rs {int(filled_slots['amount']):,} — kun party / naam ho?"
        if first == "payment_method":
            return "Cash, bank, eSewa, Khalti, ki udhaar?"

    if missing == ["amount"] or (missing and missing[0] == "amount"):
        if filled_slots.get("party"):
            return f"{filled_slots['party']} ko lagi kati rakam ho?"
        return "कति रकम हो? (What is the amount?)"

    if missing == ["party"] or (missing and missing[0] == "party"):
        if filled_slots.get("amount"):
            return f"Rs {int(filled_slots['amount']):,} — kun party / naam ho?"
        return "Party ko naam k ho?"

    if missing == ["payment_method"] or (missing and missing[0] == "payment_method"):
        return "Cash, bank, eSewa, Khalti, ki udhaar ma?"

    if len(missing) > 1:
        labels = {"amount": "rakam", "party": "party", "payment_method": "payment mode"}
        parts = [labels.get(s, s) for s in missing]
        return f"Thap anusar {', '.join(parts)} chahincha — kripaya bataunu hola."

    return parsed.clarification_question or "Kripaya thap bhari detail dinus."


def apply_intent_from_payment(parsed: ParsedEntry) -> ParsedEntry:
    """Refine intent when payment mode clarifies cash vs credit."""
    if parsed.intent == "unknown" or parsed.intent in ("cash_sale", "credit_sale"):
        if parsed.payment_method == "cash" and parsed.intent in ("unknown", "credit_sale"):
            return parsed.model_copy(update={"intent": "cash_sale"})
        if parsed.payment_method != "unknown" and parsed.payment_method != "cash":
            if parsed.intent == "unknown":
                return parsed.model_copy(update={"intent": "payment_received"})
    return parsed


def process_clarification_followup(
    pending: ParsedEntry,
    message: str,
    filled_slots: dict[str, Any],
    required_slots: tuple[str, ...] | list[str],
    *,
    recent_parties: list[str] | None = None,
) -> FollowupResult:
    """
    Merge a follow-up message into pending clarification state.

    Parses only the new message for missing slots; does not re-parse the full
    original narration unless the follow-up itself is a complete transaction.
    """
    slots = dict(filled_slots)
    still_missing = missing_slots(pending, slots, required_slots)

    if not still_missing:
        merged = merge_slots_into_parsed(pending, slots)
        merged = apply_intent_from_payment(merged)
        return FollowupResult(
            parsed=merged,
            filled_slots=slots,
            missing_slots=[],
            complete=True,
        )

    # Full new transaction in follow-up (has amount + verbs) — defer to full re-parse
    norm = normalize_for_matching(message)
    has_amount = bool(extract_amount(message) or extract_qty_rate_amount(message))
    has_verb = bool(
        re.search(r"\b(becheko|kineko|tiryo|diye|bikri|kharcha|sold|paid)\b", norm)
    )
    if has_amount and has_verb and len(norm.split()) >= 4:
        combined = f"{pending.narration} {message}".strip()
        return FollowupResult(
            parsed=pending.model_copy(update={"narration": combined}),
            filled_slots=slots,
            missing_slots=still_missing,
            complete=False,
            question=None,
            slots_filled_this_turn=[],
        )

    parsed_values = parse_slot_values(message, still_missing, recent_parties=recent_parties)
    filled_this_turn: list[str] = []
    for key, val in parsed_values.items():
        if val is not None and key not in slots:
            slots[key] = val
            filled_this_turn.append(key)

    merged = merge_slots_into_parsed(pending, slots)
    merged = apply_intent_from_payment(merged)
    still_missing = missing_slots(merged, slots, required_slots)

    if not still_missing and merged.amount:
        return FollowupResult(
            parsed=merged.model_copy(update={"needs_clarification": False}),
            filled_slots=slots,
            missing_slots=[],
            complete=True,
            slots_filled_this_turn=filled_this_turn,
        )

    question = build_clarification_question(still_missing, slots, pending)
    return FollowupResult(
        parsed=merged.model_copy(
            update={
                "needs_clarification": True,
                "clarification_question": question,
            }
        ),
        filled_slots=slots,
        missing_slots=still_missing,
        complete=False,
        question=question,
        slots_filled_this_turn=filled_this_turn,
    )
