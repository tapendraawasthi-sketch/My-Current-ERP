"""Customer NLU orchestrator — normalize, classify, extract slots."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .intent_classifier import classify_with_slots
from .intents import CustomerIntent
from .slot_extractor import Slots


@dataclass
class ParsedMessage:
    raw: str
    normalized: str
    intent: CustomerIntent
    slots: Slots
    confidence: float = 1.0
    needs_clarification: bool = False
    clarification: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw": self.raw,
            "normalized": self.normalized,
            "intent": self.intent,
            "slots": self.slots.to_dict(),
            "confidence": self.confidence,
            "needs_clarification": self.needs_clarification,
            "clarification": self.clarification,
            "meta": self.meta,
        }


def _check_clarification(intent: CustomerIntent, slots: Slots) -> tuple[bool, str | None]:
    """Return whether we need a one-line clarifying question."""
    if intent == "QUERY_BALANCE_ONE" and not slots.party:
        return True, "Kasko baki hernu ho? naam bhannus."

    if intent in ("SALE_CREDIT", "PAYMENT_RECEIVED", "PAYMENT_MADE") and not slots.party:
        if slots.amount is None:
            return True, "Kati rupiya ra kasko naam? ek line ma bhannus."
        return True, "Kasko naam ho? (customer wa supplier)"

    if intent in ("SALE_CASH", "EXPENSE", "PURCHASE_CASH") and slots.amount is None:
        return True, "Kati rupiya ko? amount bhannus."

    if intent == "REMINDER_REQUEST" and not slots.party:
        return True, "Kaslai samjhaune? naam bhannus."

    if intent == "QUERY_STOCK" and not slots.item:
        return True, "Kun saman ko stock hernu ho?"

    # Ambiguous "baki" without party role (Section 5.3)
    if intent == "QUERY_BALANCE_ONE" and slots.party and not slots.party_role:
        return False, None  # Can answer from ledger; role resolved at post time

    return False, None


def parse_message(raw: str) -> ParsedMessage:
    intent, slots, normalized = classify_with_slots(raw)
    needs, clarification = _check_clarification(intent, slots)

    confidence = 1.0
    if intent == "GENERAL":
        confidence = 0.5

    return ParsedMessage(
        raw=raw.strip(),
        normalized=normalized,
        intent=intent,
        slots=slots,
        confidence=confidence,
        needs_clarification=needs,
        clarification=clarification,
    )
