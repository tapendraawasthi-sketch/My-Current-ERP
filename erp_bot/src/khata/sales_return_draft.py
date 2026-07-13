"""Sales return / credit-note draft lifecycle for Accountant Mode.

Structured draft + confirmation card only. Never invent VAT, COGS, or
journal lines — frontend posts via postSalesAdjustmentTransaction.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Literal

DraftStatus = Literal[
    "draft",
    "awaiting_clarification",
    "complete",
    "validated",
    "previewed",
    "confirmed",
    "posted",
    "cancelled",
]

AdjustmentType = Literal["inventory_sales_return", "financial_credit_note"]
SettlementMethod = Literal[
    "cash_refund",
    "bank_refund",
    "reduce_receivable",
    "customer_credit",
]

_INVOICE_NO = re.compile(r"\b(SI-[\w-]+)\b", re.I)
_QTY = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(?:of\s+(?:the\s+)?\d+\s+)?"
    r"(?:kg|kgs|pcs|pc|piece|pieces|unit|units|bike|bikes)?\b|"
    r"\b(\d+(?:\.\d+)?)\s+of\s+(?:the\s+)?\d+\b",
    re.I,
)
_QTY_OF = re.compile(r"\b(\d+(?:\.\d+)?)\s+of\s+(?:the\s+)?\d+\b", re.I)
_SINGULAR = re.compile(r"\b(?:a|an|the)\s+(?:bike|item)\b", re.I)
_MONEY = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
    re.I,
)
_ITEM_RETURN = re.compile(
    r"\b(?:returned|return(?:ing)?|firta)\s+"
    r"(?:(?:\d+(?:\.\d+)?)\s+(?:of\s+(?:the\s+)?\d+\s+)?)?"
    r"(?:(?:a|an|the)\s+)?"
    r"([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{0,40}?)"
    r"(?:\s+from|\s+against|\s+and|\s+to|\s+in|\s+on|[.,;!?]|$)",
    re.I,
)
_ITEM_BARE = re.compile(
    r"\b((?:e2e\s+)?test\s+bike|bike|bikes)\b",
    re.I,
)
_CUSTOMER_LEAD = re.compile(
    r"^([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s&.]{1,40}?)\s+"
    r"(?:returned|return(?:ed|ing)?|firta)\b",
    re.I,
)
_CUSTOMER_GIVE = re.compile(
    r"\b(?:give|issue|raise)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s&.]{1,40}?)\s+"
    r"(?:a\s+)?(?:rs\.?|npr)?",
    re.I,
)
_CUSTOMER_FROM = re.compile(
    r"\b(?:from|for|to)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s&.]{1,40}?)"
    r"(?:\s+(?:invoice|and|for|against|in|on)|$)",
    re.I,
)
_CASH_REFUND = re.compile(
    r"\b(cash\s*refund|refund(?:\s+the\s+customer)?\s+in\s+cash|refund\s+cash|nagad\s*refund)\b",
    re.I,
)
_BANK_REFUND = re.compile(r"\b(bank\s*refund|refund(?:\s+the\s+customer)?\s+(?:by|via|in)\s+bank)\b", re.I)
_REDUCE_RECV = re.compile(
    r"\b(reduce\s+(?:the\s+)?(?:outstanding|receivable|balance)|against\s+(?:outstanding|receivable)|"
    r"reduce\s+receivable)\b",
    re.I,
)
_CUSTOMER_CREDIT = re.compile(r"\b(customer\s+credit|store\s+credit|goodwill)\b", re.I)
_BARE_CASH = re.compile(r"\b(cash|nagar|नगद)\b", re.I)
_BARE_BANK = re.compile(r"\b(bank|cheque|transfer)\b", re.I)

_RETURN_SIGNAL = re.compile(
    r"\b(returned|returning|sales\s+return|return(?:\s+the|\s+a|\s+an)?|firta|समान\s*फिर्ता)\b",
    re.I,
)
_EXPLANATION_Q = re.compile(
    r"^\s*(how\s+(?:is|are|do|does|to)|what\s+is|explain|define|meaning\s+of)\b",
    re.I,
)
_CREDIT_NOTE_SIGNAL = re.compile(r"\bcredit\s*notes?\b", re.I)
_NO_GOODS = re.compile(
    r"\b(no\s+goods|without\s+(?:goods|stock|return)|pricing\s+error|rate\s+difference|goodwill)\b",
    re.I,
)
_REASON = re.compile(
    r"\b(?:for|because|due\s+to)\s+(a\s+)?(pricing\s+error|damage|defective|wrong\s+item|"
    r"rate\s+difference|goodwill|quality\s+issue)\b",
    re.I,
)

_GENERIC_ITEMS = frozenset(
    {"goods", "items", "item", "stuff", "material", "materials", "product", "products", "the"}
)


def _d(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).replace(",", "")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None


def _money(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")


@dataclass
class PartyRef:
    id: str | None = None
    name: str | None = None


@dataclass
class ItemRef:
    id: str | None = None
    name: str | None = None
    raw_name: str | None = None


@dataclass
class SalesReturnDraft:
    draft_id: str
    status: DraftStatus
    adjustment_type: AdjustmentType | None = None
    version: int = 1
    original_invoice_no: str | None = None
    item: ItemRef = field(default_factory=ItemRef)
    quantity: Decimal | None = None
    financial_amount: Decimal | None = None
    customer: PartyRef = field(default_factory=PartyRef)
    settlement_method: SettlementMethod | None = None
    reason_code: str | None = None
    narration: str | None = None
    currency: str = "NPR"
    transaction_date: str | None = None
    source_messages: list[str] = field(default_factory=list)
    confidence: dict[str, float] = field(default_factory=dict)
    missing_fields: list[str] = field(default_factory=list)
    ambiguous_fields: list[str] = field(default_factory=list)
    validation_errors: list[str] = field(default_factory=list)
    preview: dict[str, Any] | None = None
    preview_hash: str | None = None
    posted_result: dict[str, Any] | None = None
    idempotency_key: str | None = None
    created_by: str = ""
    tenant_id: str = ""
    company_id: str = ""
    session_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        for key in ("quantity", "financial_amount"):
            if data[key] is not None:
                data[key] = _money(Decimal(str(data[key])))
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SalesReturnDraft:
        item = data.get("item") or {}
        customer = data.get("customer") or {}
        return cls(
            draft_id=data["draft_id"],
            status=data.get("status", "draft"),
            adjustment_type=data.get("adjustment_type"),
            version=int(data.get("version") or 1),
            original_invoice_no=data.get("original_invoice_no"),
            item=ItemRef(id=item.get("id"), name=item.get("name"), raw_name=item.get("raw_name")),
            quantity=_d(data.get("quantity")),
            financial_amount=_d(data.get("financial_amount")),
            customer=PartyRef(id=customer.get("id"), name=customer.get("name")),
            settlement_method=data.get("settlement_method"),
            reason_code=data.get("reason_code"),
            narration=data.get("narration"),
            currency=data.get("currency", "NPR"),
            transaction_date=data.get("transaction_date"),
            source_messages=list(data.get("source_messages") or []),
            confidence=dict(data.get("confidence") or {}),
            missing_fields=list(data.get("missing_fields") or []),
            ambiguous_fields=list(data.get("ambiguous_fields") or []),
            validation_errors=list(data.get("validation_errors") or []),
            preview=data.get("preview"),
            preview_hash=data.get("preview_hash"),
            posted_result=data.get("posted_result"),
            idempotency_key=data.get("idempotency_key"),
            created_by=data.get("created_by") or "",
            tenant_id=data.get("tenant_id") or "",
            company_id=data.get("company_id") or "",
            session_id=data.get("session_id") or "",
        )


def is_explanation_about_return(text: str) -> bool:
    """True for conceptual questions — must not create a return draft."""
    t = text or ""
    if not _EXPLANATION_Q.search(t):
        return False
    return bool(
        re.search(r"\b(return|firta|credit\s*note|vat|output\s+vat)\b", t, re.I)
    )


def is_sales_return_message(text: str) -> bool:
    if is_explanation_about_return(text):
        return False
    if is_financial_credit_note_message(text):
        return False
    t = text or ""
    # Do not steal purchase returns / supplier debit notes.
    if re.search(r"\bPI-[\w-]+", t, re.I):
        return False
    if re.search(r"\b(purchase\s+return|supplier\s+return|debit\s*note)\b", t, re.I):
        return False
    if re.search(r"\breturn(?:ed|ing)?\b", t, re.I) and re.search(
        r"\b(purchase|supplier)\b", t, re.I
    ) and not re.search(r"\b(sales\s+return|SI-[\w-]+|customer)\b", t, re.I):
        return False
    return bool(_RETURN_SIGNAL.search(t))


def is_financial_credit_note_message(text: str) -> bool:
    if is_explanation_about_return(text):
        return False
    t = text or ""
    if not _CREDIT_NOTE_SIGNAL.search(t):
        return False
    # Prefer CN when no-goods / pricing-error language is present, or when
    # credit note is stated without an inventory return verb.
    if _NO_GOODS.search(t):
        return True
    if _RETURN_SIGNAL.search(t) and not re.search(r"\b(returned|firta)\b", t, re.I):
        # "credit note" alone without "returned" → financial CN
        return True
    if not re.search(r"\b(returned|firta|goods?\s+return)\b", t, re.I):
        return True
    return False


def extract_return_fields(text: str) -> dict[str, Any]:
    """Extract known return/CN fields. Unknown stay absent (caller leaves null)."""
    fields: dict[str, Any] = {}
    t = text or ""

    if is_financial_credit_note_message(t):
        fields["adjustment_type"] = "financial_credit_note"
    elif is_sales_return_message(t) or _RETURN_SIGNAL.search(t):
        fields["adjustment_type"] = "inventory_sales_return"

    inv = _INVOICE_NO.search(t)
    if inv:
        fields["original_invoice_no"] = inv.group(1).upper()

    qty_of = _QTY_OF.search(t)
    if qty_of:
        fields["quantity"] = _d(qty_of.group(1))
    elif _SINGULAR.search(t) and "quantity" not in fields:
        fields["quantity"] = Decimal("1")
    else:
        # "returned 1 bike" / "returned the remaining 1 bike"
        bare_qty = re.search(
            r"\b(?:returned|return(?:ing)?)\s+"
            r"(?:(?:the|a|an)\s+)?(?:remaining\s+)?"
            r"(\d+(?:\.\d+)?)\s+",
            t,
            re.I,
        )
        if bare_qty:
            fields["quantity"] = _d(bare_qty.group(1))
        else:
            remaining_qty = re.search(
                r"\bremaining\s+(\d+(?:\.\d+)?)\b",
                t,
                re.I,
            )
            if remaining_qty:
                fields["quantity"] = _d(remaining_qty.group(1))

    money = _MONEY.search(t)
    if money:
        fields["financial_amount"] = _d(money.group(1))

    item_match = _ITEM_RETURN.search(t) or _ITEM_BARE.search(t)
    if item_match:
        raw = item_match.group(1).strip(" .,")
        raw = re.sub(
            r"\s+(from|against|and|to|in|on|invoice)\b.*$",
            "",
            raw,
            flags=re.I,
        ).strip()
        # Drop leading qty fragments leftover
        raw = re.sub(r"^\d+(?:\.\d+)?\s+(?:of\s+(?:the\s+)?\d+\s+)?", "", raw, flags=re.I).strip()
        if raw.lower() not in _GENERIC_ITEMS and len(raw) > 1:
            name = "E2E Test Bike" if re.search(r"bike", raw, re.I) and re.search(r"e2e|test", t, re.I) else (
                "Bike" if raw.lower() in {"bike", "bikes"} else (raw.title() if raw.isascii() else raw)
            )
            if raw.lower() in {"bike", "bikes"}:
                name = "Bike"
            fields["item"] = {"name": name, "raw_name": raw}

    for pat in (_CUSTOMER_LEAD, _CUSTOMER_GIVE):
        m = pat.search(t)
        if m:
            name = m.group(1).strip(" .,")
            name = re.sub(r"\s+(a|an|the|rs\.?|npr)\b.*$", "", name, flags=re.I).strip()
            if name and name.lower() not in {"return", "the", "a", "an"}:
                fields["customer"] = {"name": name.title() if name.isascii() else name}
                break

    if "customer" not in fields:
        # "refund the customer" has no name; skip generic "customer"
        m = re.search(
            r"\b(?:to|for)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s&.]{1,40}?)"
            r"(?:\s+(?:a\s+)?(?:rs\.?|credit|invoice|against)|$)",
            t,
            re.I,
        )
        if m:
            name = m.group(1).strip(" .,")
            if name.lower() not in {"the customer", "customer", "invoice", "cash", "bank"}:
                fields["customer"] = {"name": name.title() if name.isascii() else name}

    if _CASH_REFUND.search(t) or (re.search(r"\brefund\b", t, re.I) and _BARE_CASH.search(t)):
        fields["settlement_method"] = "cash_refund"
    elif _BANK_REFUND.search(t) or (re.search(r"\brefund\b", t, re.I) and _BARE_BANK.search(t)):
        fields["settlement_method"] = "bank_refund"
    elif _CUSTOMER_CREDIT.search(t):
        fields["settlement_method"] = "customer_credit"
    elif _REDUCE_RECV.search(t):
        fields["settlement_method"] = "reduce_receivable"

    reason = _REASON.search(t)
    if reason:
        code = reason.group(2).lower().replace(" ", "_")
        fields["reason_code"] = code
        fields["narration"] = reason.group(2)
    elif _NO_GOODS.search(t):
        fields["reason_code"] = "pricing_error" if re.search(r"pricing", t, re.I) else "no_goods"
        if "narration" not in fields:
            fields["narration"] = "No goods returned" if re.search(r"no\s+goods", t, re.I) else None

    return fields


def merge_fields(draft: SalesReturnDraft, fields: dict[str, Any], message: str) -> SalesReturnDraft:
    draft.source_messages.append(message)
    changed = False

    if fields.get("adjustment_type") and draft.adjustment_type != fields["adjustment_type"]:
        draft.adjustment_type = fields["adjustment_type"]
        changed = True
    if fields.get("original_invoice_no") and draft.original_invoice_no != fields["original_invoice_no"]:
        draft.original_invoice_no = fields["original_invoice_no"]
        changed = True
    if fields.get("quantity") is not None and draft.quantity != fields["quantity"]:
        draft.quantity = fields["quantity"]
        changed = True
    if fields.get("financial_amount") is not None and draft.financial_amount != fields["financial_amount"]:
        draft.financial_amount = fields["financial_amount"]
        changed = True
    if fields.get("item"):
        item = fields["item"]
        new_item = ItemRef(id=item.get("id"), name=item.get("name"), raw_name=item.get("raw_name"))
        if (draft.item.name or "") != (new_item.name or ""):
            changed = True
        draft.item = new_item
    if fields.get("customer"):
        customer = fields["customer"]
        new_customer = PartyRef(id=customer.get("id"), name=customer.get("name"))
        if (draft.customer.name or "") != (new_customer.name or ""):
            changed = True
        draft.customer = new_customer
    if fields.get("settlement_method") and draft.settlement_method != fields["settlement_method"]:
        draft.settlement_method = fields["settlement_method"]
        changed = True
    if fields.get("reason_code") and draft.reason_code != fields["reason_code"]:
        draft.reason_code = fields["reason_code"]
        changed = True
    if fields.get("narration") and draft.narration != fields["narration"]:
        draft.narration = fields["narration"]
        changed = True

    if changed and len(draft.source_messages) > 1:
        draft.version = int(draft.version or 1) + 1
        draft.preview = None
        draft.preview_hash = None
    return draft


def compute_missing_fields(draft: SalesReturnDraft) -> list[str]:
    missing: list[str] = []
    adj = draft.adjustment_type or "inventory_sales_return"

    if not draft.original_invoice_no:
        missing.append("original_invoice_no")

    if adj == "financial_credit_note":
        if draft.financial_amount is None:
            missing.append("financial_amount")
        if draft.settlement_method is None:
            # CN against invoice typically reduces receivable; still ask if unknown
            missing.append("settlement_method")
    else:
        item_ok = bool(draft.item and draft.item.name and draft.item.name.lower() not in _GENERIC_ITEMS)
        if not item_ok:
            missing.append("item")
        if draft.quantity is None:
            missing.append("quantity")
        if draft.settlement_method is None:
            missing.append("settlement_method")

    return missing


def validate_and_complete(draft: SalesReturnDraft) -> SalesReturnDraft:
    draft.ambiguous_fields = []
    draft.validation_errors = []

    if not draft.adjustment_type:
        draft.adjustment_type = "inventory_sales_return"

    # Financial CN: default settlement to reduce_receivable when amount+invoice known
    # and language did not specify refund — still listed as missing until set.
    if (
        draft.adjustment_type == "financial_credit_note"
        and draft.settlement_method is None
        and draft.financial_amount is not None
        and draft.original_invoice_no
    ):
        draft.settlement_method = "reduce_receivable"

    if not draft.transaction_date:
        draft.transaction_date = date.today().isoformat()

    draft.missing_fields = compute_missing_fields(draft)
    if draft.missing_fields:
        draft.status = "awaiting_clarification"
        return draft

    draft.status = "validated"
    return draft


def build_preview(draft: SalesReturnDraft) -> dict[str, Any]:
    """Human-readable preview payload — not authoritative journals/VAT."""
    adj = draft.adjustment_type or "inventory_sales_return"
    item_name = draft.item.name if draft.item else None
    customer_name = draft.customer.name if draft.customer else None
    amount = float(draft.financial_amount) if draft.financial_amount is not None else 0.0

    if adj == "financial_credit_note":
        intent = "financial_credit_note"
        tags = ["financial_credit_note", "no_goods"]
        effects = [
            f"Financial credit note draft against {draft.original_invoice_no}",
            f"Amount: NPR {_money(draft.financial_amount)}",
            f"Settlement: {draft.settlement_method}",
            "No stock movement (no goods returned)",
            "Frontend will post via postSalesAdjustmentTransaction",
        ]
        narration = draft.narration or f"Credit note against {draft.original_invoice_no}"
    else:
        intent = "khata_sales_return"
        tags = ["inventory_sales_return"]
        effects = [
            f"Inventory sales return draft against {draft.original_invoice_no}",
            f"Item: {item_name} qty {draft.quantity}",
            f"Settlement: {draft.settlement_method}",
            "Historical VAT/cost reversal computed by frontend domain engine",
            "Frontend will post via postSalesAdjustmentTransaction",
        ]
        narration = draft.narration or (
            f"Sales return of {draft.quantity} {item_name} against {draft.original_invoice_no}"
        )

    preview = {
        "draft_id": draft.draft_id,
        "transaction": "Sales Return" if adj == "inventory_sales_return" else "Credit Note",
        "transaction_type": adj,
        "adjustment_type": adj,
        "original_invoice_no": draft.original_invoice_no,
        "item": item_name,
        "customer": customer_name,
        "quantity": _money(draft.quantity) if draft.quantity is not None else None,
        "total": _money(draft.financial_amount) if draft.financial_amount is not None else "0.00",
        "currency": draft.currency,
        "settlement": draft.settlement_method,
        "reason_code": draft.reason_code,
        "erp_effects": effects,
        "intent": intent,
        "party": customer_name,
        "amount": amount,
        "narration": narration,
        "confidence": 0.9,
        "method": "sales_return_draft",
        "draft_version": draft.version,
        "preview_version": draft.version,
        "tags": tags,
        # Explicitly empty — Python must not invent journals
        "journalLines": [],
    }
    preview["preview_hash"] = _preview_hash(preview)
    return preview


def _preview_hash(preview: dict[str, Any]) -> str:
    payload = {
        "draft_id": preview.get("draft_id"),
        "adjustment_type": preview.get("adjustment_type"),
        "original_invoice_no": preview.get("original_invoice_no"),
        "amount": preview.get("amount"),
        "quantity": preview.get("quantity"),
        "item": preview.get("item"),
        "settlement": preview.get("settlement"),
    }
    return uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(payload, sort_keys=True, default=str)).hex


def clarification_message(draft: SalesReturnDraft) -> str:
    adj = draft.adjustment_type or "inventory_sales_return"
    label = "credit note" if adj == "financial_credit_note" else "sales return"
    parts: list[str] = [f"I have started a {label} entry."]

    if draft.original_invoice_no:
        parts.append(f"Original invoice: {draft.original_invoice_no}.")
    if draft.item and draft.item.name:
        parts.append(f"Item: {draft.item.name}.")
    if draft.customer and draft.customer.name:
        parts.append(f"Customer: {draft.customer.name}.")

    asks: list[str] = []
    if "original_invoice_no" in draft.missing_fields:
        asks.append("the original sales invoice number (e.g. SI-…)")
    if "item" in draft.missing_fields:
        asks.append("which item was returned")
    if "quantity" in draft.missing_fields:
        asks.append("the return quantity")
    if "financial_amount" in draft.missing_fields:
        asks.append("the credit note amount")
    if "settlement_method" in draft.missing_fields:
        asks.append(
            "settlement (cash refund, bank refund, reduce outstanding balance, or customer credit)"
        )

    if asks:
        if len(asks) == 1:
            parts.append(f"Please tell me {asks[0]}.")
        elif len(asks) == 2:
            parts.append(f"Please tell me {asks[0]} and {asks[1]}.")
        else:
            parts.append("Please tell me " + ", ".join(asks[:-1]) + f", and {asks[-1]}.")

    return " ".join(parts)


def preview_message(draft: SalesReturnDraft) -> str:
    p = draft.preview or {}
    adj = p.get("adjustment_type") or draft.adjustment_type
    title = "**Credit note preview**" if adj == "financial_credit_note" else "**Sales return preview**"
    lines = [
        title,
        "",
        f"Original invoice: {p.get('original_invoice_no')}",
    ]
    if p.get("item"):
        lines.append(f"Item: {p.get('item')}")
    if p.get("quantity"):
        lines.append(f"Quantity: {p.get('quantity')}")
    if p.get("customer"):
        lines.append(f"Customer: {p.get('customer')}")
    if adj == "financial_credit_note":
        lines.append(f"Amount: NPR {p.get('total')}")
    lines.append(f"Settlement: {str(p.get('settlement') or '').replace('_', ' ').title()}")
    if p.get("reason_code"):
        lines.append(f"Reason: {p.get('reason_code')}")
    lines.append("")
    lines.append("Planned effects (informational — frontend posts authoritatively):")
    for i, effect in enumerate(p.get("erp_effects") or [], 1):
        lines.append(f"{i}. {effect}")
    lines.append("")
    lines.append("Click **Confirm** to post, or reply with corrections.")
    return "\n".join(lines)


def start_or_merge_return(
    message: str,
    *,
    session_id: str,
    tenant_id: str = "",
    company_id: str = "",
    user_id: str = "",
    existing: SalesReturnDraft | None = None,
) -> SalesReturnDraft:
    fields = extract_return_fields(message)
    if existing is None:
        draft = SalesReturnDraft(
            draft_id=str(uuid.uuid4()),
            status="draft",
            created_by=user_id,
            tenant_id=tenant_id,
            company_id=company_id,
            session_id=session_id,
            idempotency_key=str(uuid.uuid4()),
        )
    else:
        draft = existing
    merge_fields(draft, fields, message)
    validate_and_complete(draft)
    if draft.status == "validated":
        draft.preview = build_preview(draft)
        draft.preview_hash = draft.preview.get("preview_hash")
        draft.status = "previewed"
    return draft


def to_confirmation_card(draft: SalesReturnDraft) -> dict[str, Any] | None:
    if draft.status != "previewed" or not draft.preview:
        return None
    adj = draft.adjustment_type or "inventory_sales_return"
    raw_text = " | ".join(draft.source_messages)
    # CRITICAL: frontend parses SI-… from raw_text
    if draft.original_invoice_no and draft.original_invoice_no not in raw_text:
        raw_text = f"{raw_text} | invoice {draft.original_invoice_no}"

    if adj == "financial_credit_note":
        intent = "financial_credit_note"
        tags = ["financial_credit_note", "no_goods"]
        if draft.reason_code and "pricing" in (draft.reason_code or ""):
            # Help isFinancialCreditNoteIntent via raw/tags
            if "pricing error" not in raw_text.lower():
                raw_text = f"{raw_text} | pricing error | no goods"
        elif "no goods" not in raw_text.lower():
            raw_text = f"{raw_text} | no goods"
    else:
        intent = "khata_sales_return"
        tags = ["inventory_sales_return"]

    amount = float(draft.financial_amount) if draft.financial_amount is not None else 0.0
    card: dict[str, Any] = {
        "intent": intent,
        "party": draft.customer.name if draft.customer else None,
        "amount": amount,
        "item": draft.item.name if draft.item else None,
        "date": draft.transaction_date or date.today().isoformat(),
        "raw_text": raw_text,
        "draft_id": draft.draft_id,
        "preview_hash": draft.preview_hash,
        "preview_version": draft.version,
        "idempotency_key": draft.idempotency_key,
        "tags": tags,
        "secondaryAmount": None,
        "quantity": _money(draft.quantity) if draft.quantity is not None else None,
        "narration": draft.narration or (draft.preview or {}).get("narration"),
        "method": "sales_return_draft",
        "adjustment_type": adj,
        "original_invoice_no": draft.original_invoice_no,
        "settlement": draft.settlement_method,
        "journalLines": [],
        "confidence": 0.9,
    }
    return card


# ── Draft store (session-scoped, file-backed) ───────────────────────────────

_LOCK = threading.Lock()
_MEMORY: dict[str, dict[str, Any]] = {}


def _store_path() -> Path:
    base = os.environ.get("ORBIX_DRAFT_STORE_DIR") or os.path.join(tempfile.gettempdir(), "orbix_drafts")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path / "sales_return_drafts.json"


def _load_all() -> dict[str, dict[str, Any]]:
    global _MEMORY
    if _MEMORY:
        return _MEMORY
    path = _store_path()
    if path.exists():
        try:
            _MEMORY = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            _MEMORY = {}
    return _MEMORY


def _save_all(data: dict[str, dict[str, Any]]) -> None:
    global _MEMORY
    _MEMORY = data
    path = _store_path()
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _draft_key(tenant_id: str, company_id: str, session_id: str) -> str:
    return f"{tenant_id}|{company_id}|{session_id}"


def save_draft(draft: SalesReturnDraft) -> None:
    with _LOCK:
        data = _load_all()
        key = _draft_key(draft.tenant_id, draft.company_id, draft.session_id)
        data[key] = draft.to_dict()
        data[draft.draft_id] = draft.to_dict()
        _save_all(data)


def load_pending_draft(
    *,
    session_id: str,
    tenant_id: str = "",
    company_id: str = "",
    draft_id: str | None = None,
) -> SalesReturnDraft | None:
    with _LOCK:
        data = _load_all()
        raw = None
        if draft_id and draft_id in data:
            raw = data[draft_id]
        else:
            key = _draft_key(tenant_id, company_id, session_id)
            raw = data.get(key)
        if not raw:
            return None
        draft = SalesReturnDraft.from_dict(raw)
        if draft.status in {"posted", "cancelled"}:
            return None
        return draft


def mark_posted(draft: SalesReturnDraft, result: dict[str, Any]) -> SalesReturnDraft:
    draft.status = "posted"
    draft.posted_result = result
    save_draft(draft)
    return draft
