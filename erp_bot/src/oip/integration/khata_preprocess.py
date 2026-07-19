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
from ...nlu.text_normalize import normalize_accounting_text
from .mode_aware_erp import handle_mode_aware_erp
from .nepali_shop_nlu import handle_shop_nlu

_TRANSACTION_SIGNAL = re.compile(
    r"\b(\d+|saya|hajar|lakh)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
    r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|kinyo|kinye|kine|"
    r"tiryo|diyo|becheko|sold|purchase|bought|payment|commission|advance|return|rent|bhaada)\b",
    re.I,
)
_TRANSACTION_SIGNAL_ALT = re.compile(
    r"\b(sold|bought|paid|received|tiryo|kineko|kinyo|kinye|kine|becheko|bech|bikri|kharid)\b.*\d",
    re.I,
)


def is_erp_transaction_message(text: str) -> bool:
    stripped = normalize_accounting_text(text or "").strip() or (text or "").strip()
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
    operation_class: str | None = None
    orbix_mode: str | None = None
    capabilities: dict[str, bool] | None = None
    error: dict[str, Any] | None = None
    report_spec: dict[str, Any] | None = None
    draft_id: str | None = None
    party: str | None = None


def preprocess_erp_message(
    text: str,
    *,
    orbix_mode: str | None = None,
    session_id: str = "",
    tenant_id: str = "",
    company_id: str = "",
    user_id: str = "",
    user_role: str | None = None,
    permissions: dict[str, Any] | None = None,
    has_active_report: bool = False,
    has_pending_confirmation: bool = False,
    draft_id: str | None = None,
    last_party: str | None = None,
    recent_parties: list[str] | None = None,
    turn_relation: dict[str, Any] | None = None,
) -> ErpPreprocessResult | None:
    """Parse ERP transactions deterministically. Returns None for non-ERP chat."""
    stripped = (text or "").strip()
    if not stripped:
        return None

    # Permanent shop-speech layer first (greetings + party khata).
    shop = handle_shop_nlu(
        stripped,
        session_id=session_id,
        last_party=last_party,
        recent_parties=recent_parties,
    )
    if shop is not None and shop.skip_llm:
        return ErpPreprocessResult(
            skip_llm=True,
            text=shop.text,
            intent=shop.intent,
            method=shop.method,
            operation_class=shop.operation_class,
            orbix_mode=orbix_mode,
            party=shop.party,
        )

    mode_result = handle_mode_aware_erp(
        stripped,
        orbix_mode=orbix_mode,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        user_role=user_role,
        permissions=permissions,
        has_active_report=has_active_report,
        has_pending_confirmation=has_pending_confirmation,
        draft_id=draft_id,
        last_party=last_party,
        recent_parties=recent_parties,
        turn_relation=turn_relation,
    )
    if mode_result is not None and mode_result.skip_llm:
        return ErpPreprocessResult(
            skip_llm=True,
            text=mode_result.text,
            card=mode_result.card,
            intent=mode_result.intent,
            method=mode_result.method,
            operation_class=mode_result.operation_class,
            orbix_mode=mode_result.orbix_mode,
            capabilities=mode_result.capabilities,
            error=mode_result.error,
            report_spec=mode_result.report_spec,
            draft_id=mode_result.draft_id,
        )

    if not is_erp_transaction_message(stripped):
        return None

    # In Ask mode, never create mutation cards via legacy fast-path
    mode = (orbix_mode or "ask").strip().lower()
    if mode == "ask":
        from ...orbix.mode_policy import ask_mode_mutation_message, mode_restriction_payload

        return ErpPreprocessResult(
            skip_llm=True,
            text=ask_mode_mutation_message(),
            card=None,
            intent="mode_restriction",
            method="mode_policy",
            operation_class="transaction_create",
            orbix_mode="ask",
            error=mode_restriction_payload(operation="transaction_create"),
        )

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
