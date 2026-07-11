"""Deterministic ERP preprocessing — runs before Provider Runtime / Groq."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ...khata.entry_engine import (
    generate_confirmation_message,
    parse_khata_entry_sync,
    regex_fast_path,
)

_TRANSACTION_SIGNAL = re.compile(
    r"\b(\d+|saya|hajar|lakh)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
    r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|kinyo|"
    r"tiryo|diyo|becheko|sold|purchase|bought|payment|commission|advance|return|rent|bhaada)\b",
    re.I,
)
_TRANSACTION_SIGNAL_ALT = re.compile(
    r"\b(sold|bought|paid|received|tiryo|kineko|kinyo|becheko|bech|bikri|kharid)\b.*\d",
    re.I,
)


def is_erp_transaction_message(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    return bool(_TRANSACTION_SIGNAL.search(stripped) or _TRANSACTION_SIGNAL_ALT.search(stripped))


@dataclass(frozen=True)
class ErpPreprocessResult:
    skip_llm: bool
    text: str
    card: dict[str, Any] | None = None
    intent: str | None = None
    method: str = "erp_preprocess"


def preprocess_erp_message(text: str) -> ErpPreprocessResult | None:
    """Parse ERP transactions deterministically. Returns None for non-ERP chat."""
    stripped = text.strip()
    if not is_erp_transaction_message(stripped):
        return None

    fast = regex_fast_path(stripped)
    if fast and fast.success and fast.transaction:
        card = fast.transaction.to_card()
        reply = generate_confirmation_message(fast.transaction, language="mixed")
        return ErpPreprocessResult(
            skip_llm=True,
            text=reply,
            card=card,
            intent=card.get("intent"),
            method="regex",
        )

    parsed = parse_khata_entry_sync(stripped, use_llm_always=False)
    if parsed.success and parsed.transaction:
        card = parsed.transaction.to_card()
        reply = generate_confirmation_message(parsed.transaction, language="mixed")
        return ErpPreprocessResult(
            skip_llm=True,
            text=reply,
            card=card,
            intent=card.get("intent"),
            method=parsed.transaction.method,
        )

    if parsed.clarification_needed:
        return ErpPreprocessResult(
            skip_llm=True,
            text=parsed.clarification_needed,
            card=None,
            intent="erp_clarification",
            method="clarification",
        )

    party_match = re.search(
        r"\b(?:sold|becheko|bikri|bech|sale)\b.*?\b(?:to|lai)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{1,30})",
        stripped,
        re.I,
    )
    qty_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|unit|pcs|piece)\b", stripped, re.I)
    party = party_match.group(1).strip() if party_match else None
    qty = qty_match.group(1) if qty_match else None
    if party:
        detail = f"Customer: **{party.title()}**"
        if qty:
            detail += f", Quantity: **{qty}**"
        clarify = (
            f"I detected a **sales entry** ({detail}).\n\n"
            "Please provide the **rate or total amount in NPR** so I can draft the journal entry "
            "(e.g. *at Rs 150 per kg* or *total Rs 7500*)."
        )
        return ErpPreprocessResult(
            skip_llm=True,
            text=clarify,
            card=None,
            intent="sales_entry",
            method="clarification",
        )

    return ErpPreprocessResult(
        skip_llm=True,
        text=(
            "I detected an accounting transaction but need more details.\n\n"
            "Please include: **party name**, **amount in NPR**, and whether it is **sale / purchase / payment / receipt**."
        ),
        card=None,
        intent="erp_clarification",
        method="clarification",
    )
