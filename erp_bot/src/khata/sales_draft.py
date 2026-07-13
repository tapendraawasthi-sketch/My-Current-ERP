"""Sales transaction draft lifecycle for Accountant Mode.

Unknown business facts remain null. Never invent values, never convert
quantity into money, never use "N/A" as a factual value.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass, field
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

PaymentMethod = Literal["cash", "bank", "credit"]

_QTY_UNIT = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gram|grams|ltr|liter|litre|"
    r"pcs|pc|piece|pieces|unit|units|bag|bags|box|boxes|dozen|mt|ton|tons)\b",
    re.I,
)
_RATE = re.compile(
    r"(?:at|@|rate|per)\s*(?:rs\.?|npr|रु\.?|₹)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
    re.I,
)
_TOTAL = re.compile(
    r"(?:total|for|amount|worth)\s*(?:of\s*)?(?:rs\.?|npr|रु\.?|₹)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
    re.I,
)
_EXPLICIT_MONEY = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
    re.I,
)
_ITEM = re.compile(
    r"\b(?:sold|sell(?:ing)?|becheko|beche|bikri|bech|sale(?:s)?)\s+"
    r"(?:(?:\d+(?:\.\d+)?)\s*\w+\s+)?(?:of\s+)?"
    r"(?:(?:a|an|the)\s+)?"
    r"([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{0,40}?)"
    r"(?:\s+to|\s+at|\s+@|\s+for|\s+in|\s+on|[.,;!?]*)\s*$",
    re.I,
)
_ITEM_BARE = re.compile(
    r"\b([A-Za-z\u0900-\u097F]{2,}(?:\s+[A-Za-z\u0900-\u097F]{2,}){0,3})\s+"
    r"(?:at|@|for|rate|per)\b",
    re.I,
)
_CUSTOMER = re.compile(
    r"\b(?:to|lai|for)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s&.]{1,40}?)(?:\s+at|\s+@|\s+for|\s+in|\s+on|\s*$)",
    re.I,
)
_CASH = re.compile(r"\b(cash|nagar|नगद)\b", re.I)
_BANK = re.compile(r"\b(bank|cheque|check|transfer|neft|rtgs)\b", re.I)
_CREDIT = re.compile(r"\b(credit|udhaar|udhar|udharo|उधारो?|on\s+account)\b", re.I)
_SALE_SIGNAL = re.compile(
    r"\b(sold|sell(?:ing)?|sale|sales|becheko|beche|bikri|bech|बेचेको|बिक्री)\b",
    re.I,
)
# Clarification shorthand: "1, 60000 cash" or "1 60000 cash"
_CLARIFY_QTY_TOTAL_PAY = re.compile(
    r"^\s*(\d+(?:\.\d+)?)\s*[, ]+\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s+"
    r"(cash|bank|credit|nagar|नगद)\s*[.!]?\s*$",
    re.I,
)

_GENERIC_ITEMS = frozenset({"goods", "items", "item", "stuff", "material", "materials", "product", "products"})


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
class TaxInfo:
    applicable: bool | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None


@dataclass
class SalesDraft:
    draft_id: str
    status: DraftStatus
    intent: str = "sale"
    version: int = 1
    item: ItemRef = field(default_factory=ItemRef)
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    total_amount: Decimal | None = None
    currency: str = "NPR"
    customer: PartyRef = field(default_factory=PartyRef)
    payment_method: PaymentMethod | None = None
    payment_account: str | None = None
    sale_type: str | None = None
    tax: TaxInfo = field(default_factory=TaxInfo)
    transaction_date: str | None = None
    date_was_defaulted: bool = False
    description: str | None = None
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
        for key in ("quantity", "rate", "total_amount"):
            if data[key] is not None:
                data[key] = _money(Decimal(str(data[key])))
        if data["tax"]["rate"] is not None:
            data["tax"]["rate"] = _money(Decimal(str(data["tax"]["rate"])))
        if data["tax"]["amount"] is not None:
            data["tax"]["amount"] = _money(Decimal(str(data["tax"]["amount"])))
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SalesDraft:
        item = data.get("item") or {}
        customer = data.get("customer") or {}
        tax = data.get("tax") or {}
        return cls(
            draft_id=data["draft_id"],
            status=data.get("status", "draft"),
            intent=data.get("intent", "sale"),
            version=int(data.get("version") or 1),
            item=ItemRef(id=item.get("id"), name=item.get("name"), raw_name=item.get("raw_name")),
            quantity=_d(data.get("quantity")),
            unit=data.get("unit"),
            rate=_d(data.get("rate")),
            total_amount=_d(data.get("total_amount")),
            currency=data.get("currency", "NPR"),
            customer=PartyRef(id=customer.get("id"), name=customer.get("name")),
            payment_method=data.get("payment_method"),
            payment_account=data.get("payment_account"),
            sale_type=data.get("sale_type"),
            tax=TaxInfo(
                applicable=tax.get("applicable"),
                rate=_d(tax.get("rate")),
                amount=_d(tax.get("amount")),
            ),
            transaction_date=data.get("transaction_date"),
            date_was_defaulted=bool(data.get("date_was_defaulted")),
            description=data.get("description"),
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


def is_sale_message(text: str) -> bool:
    return bool(_SALE_SIGNAL.search(text or ""))


def extract_sale_fields(text: str) -> dict[str, Any]:
    """Extract known sale fields. Unknown stay absent (caller leaves null)."""
    fields: dict[str, Any] = {}

    clarify = _CLARIFY_QTY_TOTAL_PAY.match(text.strip())
    if clarify:
        fields["quantity"] = _d(clarify.group(1))
        if not fields.get("unit"):
            fields["unit"] = "pcs"
        fields["total_amount"] = _d(clarify.group(2).replace(",", ""))
        pay = clarify.group(3).lower()
        if pay in {"nagar", "à¤¨à¤—à¤¦"} or pay == "cash":
            fields["payment_method"] = "cash"
            fields["sale_type"] = "cash"
        elif pay == "bank":
            fields["payment_method"] = "bank"
            fields["sale_type"] = "bank"
        else:
            fields["payment_method"] = "credit"
            fields["sale_type"] = "credit"
        return fields

    qty_match = _QTY_UNIT.search(text)
    if qty_match:
        fields["quantity"] = _d(qty_match.group(1))
        fields["unit"] = qty_match.group(2).lower().rstrip("s") if qty_match.group(2).lower() not in {"pcs", "g"} else qty_match.group(2).lower()
        if fields["unit"] == "kgs":
            fields["unit"] = "kg"
        if fields["unit"] in {"kilogram", "kilograms"}:
            fields["unit"] = "kg"

    rate_match = _RATE.search(text)
    if rate_match:
        fields["rate"] = _d(rate_match.group(1))

    total_match = _TOTAL.search(text)
    if total_match:
        fields["total_amount"] = _d(total_match.group(1))
    elif not rate_match:
        # Only treat bare Rs amounts as total when no qtyÃ—rate context invents money from qty
        money_matches = list(_EXPLICIT_MONEY.finditer(text))
        qty_span = qty_match.span() if qty_match else None
        for m in money_matches:
            if qty_span and m.start() >= qty_span[0] and m.end() <= qty_span[1] + 5:
                continue
            # Skip if this number is the quantity itself without currency near a unit
            fields["total_amount"] = _d(m.group(1))

    item_match = _ITEM.search(text) or _ITEM_BARE.search(text)
    if item_match:
        raw = item_match.group(1).strip(" .,")
        # Strip trailing payment words
        raw = re.sub(r"\s+(in|by|with|on)\s+(cash|bank|credit).*$", "", raw, flags=re.I).strip()
        if raw.lower() not in _GENERIC_ITEMS and raw.lower() not in {"goods", "kg", "rice at"}:
            # Prefer last meaningful token sequence like "50 kg rice" â†’ rice already captured
            cleaned = re.sub(
                r"^\d+(?:\.\d+)?\s*(?:kg|kgs|pcs|unit|units|g|ltr)?\s*",
                "",
                raw,
                flags=re.I,
            ).strip()
            name = cleaned or raw
            if name.lower() not in _GENERIC_ITEMS:
                fields["item"] = {"name": name.title() if name.isascii() else name, "raw_name": name}

    # Better item capture: "50 kg rice"
    if "item" not in fields and qty_match:
        after = text[qty_match.end() :].strip()
        item_after = re.match(
            r"(?:of\s+)?([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{1,30}?)(?:\s+from|\s+at|\s+@|\s+for|\s+in|\s+on|\s*$)",
            after,
            re.I,
        )
        if item_after:
            name = item_after.group(1).strip(" .,")
            name = re.sub(r"\s+(from|at|@|for|in|on)\b.*$", "", name, flags=re.I).strip()
            if name.lower() not in _GENERIC_ITEMS and len(name) > 1:
                fields["item"] = {"name": name.title() if name.isascii() else name, "raw_name": name}

    customer_match = _CUSTOMER.search(text)
    if customer_match:
        name = customer_match.group(1).strip(" .,")
        name = re.sub(r"\s+(at|@|for|in|on)\b.*$", "", name, flags=re.I).strip()
        if name:
            fields["customer"] = {"name": name.title() if name.isascii() else name}

    if _CREDIT.search(text):
        fields["payment_method"] = "credit"
        fields["sale_type"] = "credit"
    elif _BANK.search(text):
        fields["payment_method"] = "bank"
        fields["sale_type"] = "bank"
    elif _CASH.search(text):
        fields["payment_method"] = "cash"
        fields["sale_type"] = "cash"

    return fields


def merge_fields(draft: SalesDraft, fields: dict[str, Any], message: str) -> SalesDraft:
    draft.source_messages.append(message)
    changed = False
    if fields.get("quantity") is not None and draft.quantity is None:
        draft.quantity = fields["quantity"]
        changed = True
    if fields.get("unit") and not draft.unit:
        draft.unit = fields["unit"]
        changed = True
    if fields.get("rate") is not None and draft.rate != fields["rate"]:
        draft.rate = fields["rate"]
        changed = True
    if fields.get("total_amount") is not None and draft.total_amount != fields["total_amount"]:
        draft.total_amount = fields["total_amount"]
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
    if fields.get("payment_method") and draft.payment_method != fields["payment_method"]:
        draft.payment_method = fields["payment_method"]
        draft.sale_type = fields.get("sale_type") or fields["payment_method"]
        changed = True
    if changed and draft.source_messages and len(draft.source_messages) > 1:
        draft.version = int(draft.version or 1) + 1
        # Invalidate prior preview when authoritative fields change
        draft.preview = None
        draft.preview_hash = None
    return draft


def compute_missing_fields(draft: SalesDraft) -> list[str]:
    missing: list[str] = []
    item_ok = bool(draft.item and draft.item.name and draft.item.name.lower() not in _GENERIC_ITEMS)
    if not item_ok:
        missing.append("item")
    if draft.quantity is None:
        missing.append("quantity")
    if draft.unit is None:
        missing.append("unit")
    if draft.rate is None and draft.total_amount is None:
        missing.append("rate_or_total")
    if draft.payment_method is None:
        missing.append("payment_method")
    if draft.payment_method == "credit" and not (draft.customer and draft.customer.name):
        missing.append("customer")
    if draft.payment_method == "bank" and not draft.payment_account:
        # Soft requirement â€” ask only if we have no account hint
        missing.append("payment_account")
    return missing


def validate_and_complete(draft: SalesDraft) -> SalesDraft:
    """Deterministic validation and amount reconciliation."""
    draft.ambiguous_fields = []
    draft.validation_errors = []

    if draft.quantity is not None and draft.rate is not None:
        computed = (draft.quantity * draft.rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if draft.total_amount is None:
            draft.total_amount = computed
        else:
            if abs(draft.total_amount - computed) > Decimal("0.01"):
                draft.ambiguous_fields.append("total_amount")
                draft.validation_errors.append(
                    f"Quantity Ã— rate = {_money(computed)} but stated total is {_money(draft.total_amount)}."
                )
    elif draft.quantity is not None and draft.total_amount is not None and draft.rate is None:
        if draft.quantity != 0:
            draft.rate = (draft.total_amount / draft.quantity).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

    draft.missing_fields = compute_missing_fields(draft)

    if draft.ambiguous_fields:
        draft.status = "awaiting_clarification"
        return draft

    if draft.missing_fields:
        draft.status = "awaiting_clarification"
        return draft

    draft.status = "validated"
    return draft


def build_preview(draft: SalesDraft) -> dict[str, Any]:
    """Deterministic ERP effect preview — no LLM money math."""
    assert draft.total_amount is not None
    amount = draft.total_amount
    amount_str = _money(amount) or "0.00"
    item_name = draft.item.name or "Inventory"
    payment = draft.payment_method or "cash"
    customer_name = draft.customer.name

    if payment == "cash":
        debit_line = {
            "accountCode": "KH-CASH",
            "accountName": "Cash",
            "debit": float(amount),
            "credit": 0.0,
        }
        payment_effect = "Cash increase"
        intent = "khata_cash_sale"
    elif payment == "bank":
        debit_line = {
            "accountCode": "KH-BANK",
            "accountName": "Bank",
            "debit": float(amount),
            "credit": 0.0,
        }
        payment_effect = "Bank increase"
        intent = "khata_cash_sale"  # bank sale still inventory cash-path intent with bank account
    else:
        debit_line = {
            "accountCode": "KH-DEBT",
            "accountName": "Accounts Receivable",
            "debit": float(amount),
            "credit": 0.0,
        }
        payment_effect = f"Receivable from {customer_name}"
        intent = "khata_credit_sale"

    journal: list[dict[str, Any]] = [
        debit_line,
        {
            "accountCode": "KH-SALE",
            "accountName": "Sales Revenue",
            "debit": 0.0,
            "credit": float(amount),
        },
    ]
    effects = [
        f"Sales invoice draft — {item_name}",
        f"Inventory decrease / stock-out: {item_name} -{draft.quantity} {draft.unit}",
        "Stock-ledger outward movement",
        "Accounting journal",
        payment_effect,
    ]
    if payment == "cash" and customer_name:
        effects.append(f"Customer noted: {customer_name} (no receivable)")
    effects.append("Audit-event draft")

    preview = {
        "draft_id": draft.draft_id,
        "transaction": "Sale",
        "transaction_type": (
            "inventory_sale_credit"
            if payment == "credit"
            else "inventory_sale_bank"
            if payment == "bank"
            else "inventory_sale_cash"
        ),
        "item": item_name,
        "customer": customer_name,
        "quantity": _money(draft.quantity),
        "unit": draft.unit,
        "rate": _money(draft.rate),
        "total": amount_str,
        "currency": draft.currency,
        "payment": payment,
        "erp_effects": effects,
        "journalLines": journal,
        "intent": intent,
        "party": customer_name,
        "amount": float(amount),
        "narration": f"Sale of {draft.quantity} {draft.unit} {item_name}"
        + (f" to {customer_name}" if customer_name else "")
        + f" @ {_money(draft.rate)}/{draft.unit}",
        "confidence": 0.95,
        "method": "sales_draft",
        "draft_version": draft.version,
        "preview_version": draft.version,
    }
    preview["preview_hash"] = _preview_hash(preview)
    return preview


def _preview_hash(preview: dict[str, Any]) -> str:
    payload = {
        "draft_id": preview.get("draft_id"),
        "amount": preview.get("amount"),
        "quantity": preview.get("quantity"),
        "item": preview.get("item"),
        "payment": preview.get("payment"),
        "journalLines": preview.get("journalLines"),
    }
    return uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(payload, sort_keys=True, default=str)).hex


def clarification_message(draft: SalesDraft) -> str:
    if draft.ambiguous_fields and "total_amount" in draft.ambiguous_fields:
        return (
            "The stated quantity Ã— rate does not match the total amount.\n\n"
            f"{draft.validation_errors[0] if draft.validation_errors else 'Amounts do not reconcile.'}\n\n"
            "Please confirm which values are correct before I can prepare a preview."
        )

    parts: list[str] = []
    qty_part = ""
    if draft.quantity is not None and draft.unit:
        qty_part = f" for {draft.quantity} {draft.unit}"
    elif draft.quantity is not None:
        qty_part = f" for quantity {draft.quantity}"

    item_part = f" of {draft.item.name}" if draft.item and draft.item.name else ""
    parts.append(f"I have started a sales entry{item_part}{qty_part}.")

    asks: list[str] = []
    if "item" in draft.missing_fields:
        asks.append("the item name")
    if "quantity" in draft.missing_fields:
        asks.append("the quantity")
    if "unit" in draft.missing_fields:
        asks.append("the unit")
    if "rate_or_total" in draft.missing_fields:
        asks.append("the rate per unit or total amount")
    if "payment_method" in draft.missing_fields:
        asks.append("whether it was paid by cash, bank or credit")
    if "customer" in draft.missing_fields:
        asks.append("the customer name")
    if "payment_account" in draft.missing_fields:
        asks.append("which bank account")

    if asks:
        if len(asks) == 1:
            parts.append(f"Please tell me {asks[0]}.")
        elif len(asks) == 2:
            parts.append(f"Please tell me {asks[0]} and {asks[1]}.")
        else:
            parts.append(
                "Please tell me "
                + ", ".join(asks[:-1])
                + f", and {asks[-1]}."
            )

    return " ".join(parts)


def preview_message(draft: SalesDraft) -> str:
    p = draft.preview or {}
    lines = [
        "**Sales preview**",
        "",
        f"Item: {p.get('item')}",
        f"Quantity: {p.get('quantity')} {p.get('unit')}",
        f"Rate: NPR {p.get('rate')} per {p.get('unit')}",
        f"Total: NPR {p.get('total')}",
        f"Payment: {str(p.get('payment') or '').title()}",
    ]
    if p.get("customer"):
        lines.append(f"Customer: {p.get('customer')}")
    lines.append("")
    lines.append("ERP effects:")
    for i, effect in enumerate(p.get("erp_effects") or [], 1):
        lines.append(f"{i}. {effect}")
    lines.append("")
    lines.append("Journal:")
    for jl in p.get("journalLines") or []:
        if jl.get("debit"):
            lines.append(f"  Dr {jl['accountName']}    NPR {p.get('total')}")
        if jl.get("credit"):
            lines.append(f"  Cr {jl['accountName']}    NPR {p.get('total')}")
    lines.append("")
    lines.append("Click **Confirm** to post, or reply with corrections.")
    return "\n".join(lines)


def start_or_merge_sale(
    message: str,
    *,
    session_id: str,
    tenant_id: str = "",
    company_id: str = "",
    user_id: str = "",
    existing: SalesDraft | None = None,
) -> SalesDraft:
    fields = extract_sale_fields(message)
    if existing is None:
        draft = SalesDraft(
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


def to_confirmation_card(draft: SalesDraft) -> dict[str, Any] | None:
    if draft.status != "previewed" or not draft.preview:
        return None
    card = dict(draft.preview)
    card["draft_id"] = draft.draft_id
    card["draft_version"] = draft.version
    card["preview_version"] = draft.version
    card["preview_hash"] = draft.preview_hash
    card["idempotency_key"] = draft.idempotency_key
    card["raw_text"] = " | ".join(draft.source_messages)
    return card


# â”€â”€ Draft store (session-scoped, file-backed for single-instance durability) â”€â”€

_LOCK = threading.Lock()
_MEMORY: dict[str, dict[str, Any]] = {}


def _store_path() -> Path:
    base = os.environ.get("ORBIX_DRAFT_STORE_DIR") or os.path.join(tempfile.gettempdir(), "orbix_drafts")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path / "sales_drafts.json"


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


def save_draft(draft: SalesDraft) -> None:
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
) -> SalesDraft | None:
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
        draft = SalesDraft.from_dict(raw)
        if draft.status in {"posted", "cancelled"}:
            return None
        return draft


def mark_posted(draft: SalesDraft, result: dict[str, Any]) -> SalesDraft:
    draft.status = "posted"
    draft.posted_result = result
    save_draft(draft)
    return draft


def get_posted_result(draft_id: str) -> dict[str, Any] | None:
    with _LOCK:
        data = _load_all()
        raw = data.get(draft_id)
        if not raw:
            return None
        draft = SalesDraft.from_dict(raw)
        if draft.status == "posted":
            return draft.posted_result
        return None

