"""NEXT-10 / ADR_0077 — narrow launch event freeze (unsupported → safe message).

Does not post, mint tokens, or claim execution authority.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0077"
STEP = "NEXT-10"
DECISION = "NARROW_LAUNCH_EVENT_SPEC_FREEZE"

_UNSUPPORTED_SAFE_MESSAGE = (
    "That action is not in the current AI launch set. "
    "For the first public slice I can help with sales or purchase invoice "
    "drafts (Accountant Mode) and company reports: balance sheet, profit & loss, "
    "trial balance, or account ledger (Ask Mode). "
    "Please rephrase to one of those, or use the ERP screens for other actions."
)

_SALE = re.compile(
    r"(?i)\b(sold|sale|sales|becheko|bech|bikri|invoice\s+to\s+customer)\b"
)
_PURCHASE = re.compile(
    r"(?i)\b(bought|purchase|purchased|kineko|kinyo|kinye|kine|kharid)\b"
)
_RETURN = re.compile(
    r"(?i)\b(return|returned|firta|credit\s*note|debit\s*note|sales\s+return|"
    r"purchase\s+return)\b"
)
_SETTLEMENT = re.compile(
    r"(?i)\b(receipt|payment|received|collected|tiryo|payo|paid\s+supplier|"
    r"customer\s+paid|allocate|contra|cash\s+to\s+bank|bank\s+to\s+cash|"
    r"general\s+journal|debit\s+.+\s+credit)\b"
)
_BANK_RECON = re.compile(
    r"(?i)\b(bank\s+recon|statement\s+line|cheque\s+clear|match\s+statement|"
    r"treasury\s+position|reconcile\s+bank)\b"
)
_MASTER = re.compile(
    r"(?i)\b(create|add|new|edit|rename)\b.*\b(ledger|customer|supplier|party|item|account)\b"
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return _repo_root() / "docs" / "mokxya-ai" / "MAI_LAUNCH_EVENT_SPEC_REGISTRY.json"


@lru_cache(maxsize=1)
def load_launch_event_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("LAUNCH_EVENT_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("LAUNCH_EVENT_DECISION_MISMATCH")
    return data


def launch_event_observability() -> dict[str, Any]:
    reg = load_launch_event_registry()
    supported = [e["id"] for e in reg["events"]]
    return {
        "launch_event_step": STEP,
        "launch_event_adr": AUTHORITY,
        "launch_event_decision": reg["decision"],
        "supported_event_ids": supported,
        "receipt_payment_in_freeze": False,
        "is_execution_authority": False,
        "production_approved": False,
        "silent_applications": 0,
        "draft_mutations": 0,
    }


def assert_launch_event_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_launch_event_registry()
    if reg["honesty"].get("production_approved") is True:
        raise RuntimeError("LAUNCH_EVENT_PRODUCTION_APPROVED")
    if reg["honesty"].get("is_execution_authority") is True:
        raise RuntimeError("LAUNCH_EVENT_EXECUTION_AUTHORITY")
    if reg["honesty"].get("receipt_payment_in_freeze") is True:
        raise RuntimeError("RECEIPT_PAYMENT_MUST_STAY_OUT_OF_FREEZE")
    supported = {e["id"] for e in reg["events"]}
    required = {
        "sales_invoice_draft",
        "purchase_invoice_draft",
        "ask_company_report",
    }
    if not required.issubset(supported):
        raise RuntimeError("LAUNCH_EVENT_SUPPORTED_SET_INCOMPLETE")
    for e in reg["events"]:
        if not e.get("authority_owner"):
            raise RuntimeError("LAUNCH_EVENT_MISSING_AUTHORITY_OWNER")
        if e.get("launch_support") not in {"SUPPORTED_DRAFT", "SUPPORTED_ASK"}:
            raise RuntimeError("LAUNCH_EVENT_SUPPORT_INVALID")

    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("LAUNCH_EVENT_PRODUCTION_APPROVED")
    if claim.get("is_execution_authority") is True:
        raise RuntimeError("LAUNCH_EVENT_EXECUTION_AUTHORITY")
    if claim.get("receipt_payment_launch_supported") is True:
        raise RuntimeError("RECEIPT_PAYMENT_MUST_STAY_OUT_OF_FREEZE")
    if claim.get("sole_nlu") is True:
        raise RuntimeError("SOLE_NLU_CLAIM_FORBIDDEN")
    if claim.get("allow_silent_draft_write") is True:
        raise RuntimeError("SILENT_DRAFT_WRITE_FORBIDDEN")


def unsupported_launch_message(family: str | None = None) -> str:
    if family:
        return (
            f"{_UNSUPPORTED_SAFE_MESSAGE} "
            f"(unsupported family: {family})"
        )
    return _UNSUPPORTED_SAFE_MESSAGE


def classify_launch_family(
    message: str,
    *,
    operation_class: str | None,
    intent_hint: str | None,
) -> str:
    """Return launch family id for gating (supported or unsupported)."""
    text = message or ""
    op = str(operation_class or "").lower()
    hint = str(intent_hint or "").lower()

    # Dialogue locks — never rewrite confirm/cancel/clarify.
    if op in {"confirmation", "cancellation", "clarification_reply"}:
        return "passthrough"

    # Unsupported mutating cues before weak general fallthrough.
    if hint in {"sales_return_entry"} or _RETURN.search(text):
        return "sales_return"

    if hint in {
        "customer_receipt",
        "supplier_payment",
        "cash_to_bank",
        "general_journal",
        "bank_recon",
    }:
        if hint == "bank_recon":
            return "bank_recon"
        if hint == "general_journal":
            return "general_journal"
        if hint == "supplier_payment":
            return "supplier_payment"
        if hint == "cash_to_bank":
            return "customer_receipt"
        return "customer_receipt"

    if _BANK_RECON.search(text):
        return "bank_recon"

    if _SETTLEMENT.search(text) and not (_SALE.search(text) or _PURCHASE.search(text)):
        if re.search(r"(?i)\bjournal\b", text):
            return "general_journal"
        if re.search(r"(?i)\b(paid|payment|tiryo|supplier)\b", text):
            return "supplier_payment"
        return "customer_receipt"

    if op in {"master_data_create", "master_data_modify"} or _MASTER.search(text):
        return "master_data"

    if op in {"transaction_modify", "transaction_reverse"}:
        return "transaction_modify_reverse"

    if op in {"report_request", "report_follow_up"} or hint in {
        "report_generation",
        "report_follow_up",
    }:
        return "ask_company_report"

    if hint == "purchase_entry" or (
        _PURCHASE.search(text) and not _SALE.search(text)
    ):
        return "purchase_invoice_draft"

    if hint in {"sales_entry", "transaction_create"} or _SALE.search(text):
        return "sales_invoice_draft"

    if op == "transaction_create":
        return "unsupported_transaction"

    if op in {
        "general_question",
        "accounting_question",
        "erp_data_query",
    }:
        return "passthrough"

    return "passthrough"


def is_launch_supported_family(family: str) -> bool:
    if family == "passthrough":
        return True
    reg = load_launch_event_registry()
    return any(e["id"] == family for e in reg["events"])


def evaluate_launch_event_freeze(
    message: str,
    *,
    operation_class: str | None,
    intent_hint: str | None,
    has_pending: bool = False,
) -> dict[str, Any] | None:
    """Return block dict for unsupported launch families, else None (allow).

    Pending clarification/merge always allowed (has_pending=True).
    """
    if has_pending:
        return None

    family = classify_launch_family(
        message,
        operation_class=operation_class,
        intent_hint=intent_hint,
    )
    if is_launch_supported_family(family):
        return None

    return {
        "family": family,
        "text": unsupported_launch_message(family),
        "intent": "launch_event_unsupported",
        "method": "mai_next10_launch_event_freeze",
        "error_code": "LAUNCH_EVENT_UNSUPPORTED",
        "authority": AUTHORITY,
        "step": STEP,
        "is_execution_authority": False,
        "draft_mutations": 0,
        "silent_applications": 0,
    }
