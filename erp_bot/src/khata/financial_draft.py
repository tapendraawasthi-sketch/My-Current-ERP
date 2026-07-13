"""Financial settlement draft lifecycle (Phase 9).

Structured draft → confirmation card only. Frontend posts via
postReceiptTransaction / postPaymentTransaction / postContraTransaction /
postJournalTransaction (never confirmKhataEntry).
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

FinancialKind = Literal["receipt", "payment", "contra", "journal"]
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

_RECEIPT = re.compile(
    r"\b("
    r"receipt|received|payment\s+in|customer\s+paid|collected|"
    r"prapti"
    r")\b",
    re.I,
)
_PAYMENT = re.compile(
    r"\b("
    r"payment\s+out|paid(?:\s+to)?|supplier\s+payment|expense\s+paid|"
    r"bhuktani|pay(?:ment)?\s+(?:to|against)"
    r")\b",
    re.I,
)
_CONTRA = re.compile(
    r"\b("
    r"contra|cash\s+to\s+bank|bank\s+to\s+cash|transfer\s+(?:cash|bank)|"
    r"deposit\s+cash|withdraw(?:al)?\s+from\s+bank|bank\s+to\s+bank|"
    r"transfer\s+(?:from|between)\s+bank|"
    r"transfer\s+(?:rs\.?|npr)?\s*[0-9,.]*.{0,40}?bank|"
    r"from\s+(?:e2e\s+)?bank\s*a\s+to\s+(?:e2e\s+)?bank\s*b"
    r")\b",
    re.I,
)
_JOURNAL = re.compile(
    r"\b("
    r"journal\s+(?:entry|voucher)|general\s+journal|adjustment\s+entry|"
    r"accrual|reclass(?:ification)?|opening\s+balance|"
    r"debit\s+.+\s+and\s+credit|debit\s+.+\s+credit"
    r")\b",
    re.I,
)
_EXPLANATION_Q = re.compile(
    r"^\s*(how\s+(?:is|are|do|does|to)|what\s+is|explain|define|meaning\s+of)\b",
    re.I,
)
_INVENTORY_STEAL = re.compile(
    r"\b("
    r"bought|purchased|purchase\s+invoice|kineko|kinyo|kharid|"
    r"sold|sell(?:ing)?|sale(?:s)?\s+invoice|becheko|bikri|"
    r"create\s+(?:a\s+)?(?:purchase|sale|sales)\s+invoice|"
    r"enter\s+(?:a\s+)?(?:purchase|sale)"
    r")\b",
    re.I,
)
_AMOUNT = re.compile(
    r"(?:rs\.?|npr|रु\.?)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)",
    re.I,
)
_AMOUNT_BARE = re.compile(
    r"\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+\.[0-9]{2})\b",
)
_PARTY_FROM = re.compile(
    r"\b(?:from|by)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F0-9\s&.']{1,60}?)(?:"
    r"\s+against|\s+for|\s+by\s+(?:cash|bank)|\s+via|\s+into|\s+in\s+cash|"
    r"\s+as\s+advance|\s*,|\s*$)",
    re.I,
)
_PARTY_TO = re.compile(
    r"\b(?:to|paid)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F0-9\s&.']{1,60}?)(?:"
    r"\s+against|\s+for|\s+by\s+(?:cash|bank)|\s+via|\s+as\s+advance|"
    r"\s+withholding|\s*,|\s*$)",
    re.I,
)
_INVOICE_NO = re.compile(r"\b((?:SI|PI|CN|DN)-[A-Z0-9][A-Z0-9-]*)\b", re.I)
_MULTI_ALLOC = re.compile(
    r"(?:adjust|allocate|apply)?\s*(?:rs\.?|npr)?\s*"
    r"([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)"
    r"\s*(?:against|to|on)\s+((?:SI|PI)-[A-Z0-9][A-Z0-9-]*)",
    re.I,
)
_ADVANCE = re.compile(r"\b(advance|unapplied|as\s+advance|customer\s+advance|supplier\s+advance)\b", re.I)
_CASH = re.compile(r"\b(cash|nagar|नगद)\b", re.I)
_BANK = re.compile(r"\b(bank|cheque|check|neft|rtgs)\b", re.I)
_E2E_BANK_A = re.compile(r"\b(?:e2e\s+)?bank\s*a\b|\bbank\s+a\b", re.I)
_E2E_BANK_B = re.compile(r"\b(?:e2e\s+)?bank\s*b\b|\bbank\s+b\b", re.I)
_BANK_CHARGE = re.compile(
    r"\b(?:bank\s+charge|charges?|fee)\s*(?:of\s*)?(?:rs\.?|npr)?\s*"
    r"([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)",
    re.I,
)
_WITHHOLDING = re.compile(
    r"\b(?:withholding|tds)\s*(?:of\s*)?(?:rs\.?|npr)?\s*"
    r"([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)",
    re.I,
)
_CONTRA_CASH_BANK = re.compile(r"\b(cash\s+to\s+bank|deposit\s+cash(?:\s+to\s+bank)?)\b", re.I)
_CONTRA_BANK_CASH = re.compile(r"\b(bank\s+to\s+cash|withdraw(?:al)?(?:\s+from\s+bank)?)\b", re.I)
_CONTRA_BANK_BANK = re.compile(
    r"\b(bank\s+to\s+bank|transfer\s+(?:from\s+)?(?:e2e\s+)?bank)",
    re.I,
)
_JOURNAL_LINES = re.compile(
    r"debit\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F0-9\s&.']{1,60}?)\s+"
    r"(?:rs\.?|npr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)"
    r".{0,40}?"
    r"credit\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F0-9\s&.']{1,60}?)\s+"
    r"(?:rs\.?|npr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)",
    re.I | re.S,
)

_E2E_PARTIES = {
    "ram traders": ("party-e2e-customer", "Ram Traders"),
    "abc suppliers": ("party-e2e-supplier", "ABC Suppliers"),
}

_ACCOUNT_NAME_MAP = {
    "rent expense": "acc-rent-expense",
    "rent": "acc-rent-expense",
    "outstanding expenses": "acc-outstanding-expense",
    "outstanding expense": "acc-outstanding-expense",
}


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


def is_explanation_query(text: str) -> bool:
    return bool(_EXPLANATION_Q.search(text or ""))


def explanation_response(text: str) -> str:
    """Non-mutating educational reply for settlement explanation questions."""
    t = (text or "").lower()
    if "receipt" in t:
        return (
            "A customer receipt records money received from a customer. "
            "You can allocate it against one or more sales invoices, or leave it "
            "unapplied as a customer advance. Cash or bank is debited; receivables "
            "or advances are credited. Nothing is posted from an explanation."
        )
    if "payment" in t:
        return (
            "A supplier payment records money paid to a supplier. "
            "Allocate against purchase invoices or post as a supplier advance. "
            "Optional withholding/TDS reduces the cash out. Nothing is posted from an explanation."
        )
    if "contra" in t:
        return (
            "A contra voucher moves funds between cash and bank (or bank to bank). "
            "It does not affect party balances. Optional bank charges can be recorded. "
            "Nothing is posted from an explanation."
        )
    if "journal" in t:
        return (
            "A general journal posts balanced debit and credit lines without "
            "creating settlement allocations. Frontend validates the lines before posting. "
            "Nothing is posted from an explanation."
        )
    return (
        "Settlement vouchers (receipt, payment, contra, journal) record money movement "
        "and allocations. Ask mode and explanations never mutate the ledger."
    )


def detect_financial_kind(text: str) -> FinancialKind | None:
    """Return settlement kind if language clearly matches; else None."""
    if not text or is_explanation_query(text):
        return None
    if _CONTRA.search(text):
        return "contra"
    if _JOURNAL.search(text):
        return "journal"
    if _RECEIPT.search(text):
        return "receipt"
    if _PAYMENT.search(text):
        return "payment"
    return None


def is_financial_settlement_utterance(text: str) -> bool:
    return detect_financial_kind(text) is not None


def has_inventory_create_language(text: str) -> bool:
    """True when buy/sell/purchase-invoice language should steal over settlement."""
    return bool(_INVENTORY_STEAL.search(text or ""))


def prefer_financial_settlement(text: str) -> bool:
    """Prefer settlement when money-in/out language is present without inventory create."""
    if not is_financial_settlement_utterance(text):
        return False
    if has_inventory_create_language(text):
        return False
    return True


@dataclass
class FinancialDraft:
    draft_id: str
    kind: FinancialKind
    draft_version: int = 1
    amount: Decimal | None = None
    party_name: str | None = None
    party_id: str | None = None
    cash_or_bank_account_id: str | None = None
    from_account_id: str | None = None
    to_account_id: str | None = None
    allocations: list[dict[str, Any]] = field(default_factory=list)
    invoice_nos: list[str] = field(default_factory=list)
    bank_charge: Decimal | None = None
    withholding: Decimal | None = None
    missing_fields: list[str] = field(default_factory=list)
    status: DraftStatus = "draft"
    session_id: str = ""
    company_id: str = ""
    tenant_id: str = ""
    narration: str | None = None
    journal_lines: list[dict[str, Any]] = field(default_factory=list)
    is_advance: bool | None = None
    contra_type: str | None = None
    receipt_type: str | None = None
    payment_type: str | None = None
    transaction_date: str | None = None
    source_messages: list[str] = field(default_factory=list)
    preview: dict[str, Any] | None = None
    preview_hash: str | None = None
    posted_result: dict[str, Any] | None = None
    idempotency_key: str | None = None
    created_by: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        for key in ("amount", "bank_charge", "withholding"):
            if data.get(key) is not None:
                data[key] = _money(_d(data[key]))
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FinancialDraft:
        return cls(
            draft_id=data["draft_id"],
            kind=data.get("kind") or "receipt",
            draft_version=int(data.get("draft_version") or 1),
            amount=_d(data.get("amount")),
            party_name=data.get("party_name"),
            party_id=data.get("party_id"),
            cash_or_bank_account_id=data.get("cash_or_bank_account_id"),
            from_account_id=data.get("from_account_id"),
            to_account_id=data.get("to_account_id"),
            allocations=list(data.get("allocations") or []),
            invoice_nos=list(data.get("invoice_nos") or []),
            bank_charge=_d(data.get("bank_charge")),
            withholding=_d(data.get("withholding")),
            missing_fields=list(data.get("missing_fields") or []),
            status=data.get("status") or "draft",
            session_id=data.get("session_id") or "",
            company_id=data.get("company_id") or "",
            tenant_id=data.get("tenant_id") or "",
            narration=data.get("narration"),
            journal_lines=list(data.get("journal_lines") or []),
            is_advance=data.get("is_advance"),
            contra_type=data.get("contra_type"),
            receipt_type=data.get("receipt_type"),
            payment_type=data.get("payment_type"),
            transaction_date=data.get("transaction_date"),
            source_messages=list(data.get("source_messages") or []),
            preview=data.get("preview"),
            preview_hash=data.get("preview_hash"),
            posted_result=data.get("posted_result"),
            idempotency_key=data.get("idempotency_key"),
            created_by=data.get("created_by") or "",
        )


def _clean_party(name: str | None) -> str | None:
    if not name:
        return None
    cleaned = re.sub(r"\s+", " ", name).strip(" .,;:")
    cleaned = re.sub(
        r"\b(against|for|by|via|cash|bank|advance|withholding|tds)\b.*$",
        "",
        cleaned,
        flags=re.I,
    ).strip(" .,;:")
    if not cleaned or cleaned.lower() in {"the", "a", "an", "supplier", "customer"}:
        return None
    return cleaned.title() if cleaned.islower() or cleaned.isupper() else cleaned


def _map_party(name: str | None) -> tuple[str | None, str | None]:
    if not name:
        return None, None
    key = name.lower().strip()
    if key in _E2E_PARTIES:
        pid, pname = _E2E_PARTIES[key]
        return pid, pname
    for alias, (pid, pname) in _E2E_PARTIES.items():
        if alias in key or key in alias:
            return pid, pname
    return None, name


def _resolve_cash_bank(text: str) -> str | None:
    if _E2E_BANK_A.search(text):
        return "acc-bank-a"
    if _E2E_BANK_B.search(text):
        return "acc-bank-b"
    if re.search(r"\be2e\s+bank\b", text, re.I):
        return "acc-bank-a"
    if _CASH.search(text) and not _BANK.search(text):
        return "acc-cash"
    if _BANK.search(text):
        return "acc-bank"
    if _CASH.search(text):
        return "acc-cash"
    return None


def _account_id_for_name(name: str) -> str:
    key = name.lower().strip()
    if key in _ACCOUNT_NAME_MAP:
        return _ACCOUNT_NAME_MAP[key]
    for alias, aid in _ACCOUNT_NAME_MAP.items():
        if alias in key:
            return aid
    # Stable synthetic id for unknown accounts — frontend validates
    slug = re.sub(r"[^a-z0-9]+", "-", key).strip("-")[:40]
    return f"acc-{slug or 'unknown'}"


def extract_financial_fields(text: str) -> dict[str, Any]:
    """Extract known settlement fields. Unknown stay absent."""
    fields: dict[str, Any] = {}
    t = text or ""
    kind = detect_financial_kind(t)
    if kind:
        fields["kind"] = kind

    multi = list(_MULTI_ALLOC.finditer(t))
    if multi:
        allocations = []
        invoice_nos = []
        total = Decimal("0.00")
        for m in multi:
            amt = _d(m.group(1))
            inv = m.group(2).upper()
            if amt is None:
                continue
            allocations.append({"invoice_no": inv, "amount": _money(amt)})
            invoice_nos.append(inv)
            total += amt
        if allocations:
            fields["allocations"] = allocations
            fields["invoice_nos"] = invoice_nos
            fields["amount"] = total

    if "amount" not in fields:
        money = _AMOUNT.search(t) or _AMOUNT_BARE.search(t)
        if money:
            fields["amount"] = _d(money.group(1))

    if kind == "receipt" or (kind is None and _RECEIPT.search(t)):
        pm = _PARTY_FROM.search(t)
        if pm:
            fields["party_name"] = _clean_party(pm.group(1))
    if kind == "payment" or (kind is None and _PAYMENT.search(t)):
        pm = _PARTY_TO.search(t)
        if pm:
            name = _clean_party(pm.group(1))
            # "Paid ABC Suppliers" — group may include supplier name after "Paid "
            if name and name.lower() in {"rs", "npr"}:
                name = None
            if name:
                fields["party_name"] = name

    invs = [m.group(1).upper() for m in _INVOICE_NO.finditer(t)]
    if invs:
        fields["invoice_nos"] = list(dict.fromkeys(invs + list(fields.get("invoice_nos") or [])))
        if "allocations" not in fields and fields.get("amount") is not None and len(invs) == 1:
            fields["allocations"] = [
                {"invoice_no": invs[0], "amount": _money(_d(fields["amount"]))}
            ]

    if _ADVANCE.search(t):
        fields["is_advance"] = True

    cash_bank = _resolve_cash_bank(t)
    if cash_bank:
        fields["cash_or_bank_account_id"] = cash_bank

    bc = _BANK_CHARGE.search(t)
    if bc:
        fields["bank_charge"] = _d(bc.group(1))

    wh = _WITHHOLDING.search(t)
    if wh:
        fields["withholding"] = _d(wh.group(1))

    if kind == "contra" or _CONTRA.search(t):
        if _CONTRA_CASH_BANK.search(t):
            fields["contra_type"] = "cash_to_bank"
            fields["from_account_id"] = "acc-cash"
            fields["to_account_id"] = cash_bank if cash_bank and cash_bank != "acc-cash" else "acc-bank"
        elif _CONTRA_BANK_CASH.search(t):
            fields["contra_type"] = "bank_to_cash"
            fields["from_account_id"] = cash_bank if cash_bank and cash_bank != "acc-cash" else "acc-bank"
            fields["to_account_id"] = "acc-cash"
        elif _CONTRA_BANK_BANK.search(t) or (_E2E_BANK_A.search(t) and _E2E_BANK_B.search(t)):
            fields["contra_type"] = "bank_to_bank"
            fields["from_account_id"] = "acc-bank-a"
            fields["to_account_id"] = "acc-bank-b"
        else:
            fields["contra_type"] = "cash_to_bank"
            fields["from_account_id"] = fields.get("from_account_id") or "acc-cash"
            fields["to_account_id"] = fields.get("to_account_id") or "acc-bank"

    jl = _JOURNAL_LINES.search(t)
    if jl:
        debit_name = jl.group(1).strip()
        debit_amt = _d(jl.group(2))
        credit_name = jl.group(3).strip()
        credit_amt = _d(jl.group(4))
        fields["kind"] = "journal"
        fields["amount"] = debit_amt or credit_amt
        fields["journal_lines"] = [
            {
                "accountId": _account_id_for_name(debit_name),
                "accountName": debit_name.title(),
                "debit": float(debit_amt or 0),
                "credit": 0,
            },
            {
                "accountId": _account_id_for_name(credit_name),
                "accountName": credit_name.title(),
                "debit": 0,
                "credit": float(credit_amt or debit_amt or 0),
            },
        ]

    if fields.get("party_name"):
        pid, pname = _map_party(fields["party_name"])
        if pid:
            fields["party_id"] = pid
        if pname:
            fields["party_name"] = pname

    return fields


def merge_fields(draft: FinancialDraft, fields: dict[str, Any], message: str) -> FinancialDraft:
    draft.source_messages.append(message)
    changed = False

    if fields.get("kind") and draft.kind != fields["kind"]:
        draft.kind = fields["kind"]
        changed = True
    if fields.get("amount") is not None and draft.amount != fields["amount"]:
        draft.amount = fields["amount"] if isinstance(fields["amount"], Decimal) else _d(fields["amount"])
        changed = True
    if fields.get("party_name") and draft.party_name != fields["party_name"]:
        draft.party_name = fields["party_name"]
        changed = True
    if fields.get("party_id") and draft.party_id != fields["party_id"]:
        draft.party_id = fields["party_id"]
        changed = True
    if fields.get("cash_or_bank_account_id") and draft.cash_or_bank_account_id != fields["cash_or_bank_account_id"]:
        draft.cash_or_bank_account_id = fields["cash_or_bank_account_id"]
        changed = True
    if fields.get("from_account_id") and draft.from_account_id != fields["from_account_id"]:
        draft.from_account_id = fields["from_account_id"]
        changed = True
    if fields.get("to_account_id") and draft.to_account_id != fields["to_account_id"]:
        draft.to_account_id = fields["to_account_id"]
        changed = True
    if fields.get("allocations"):
        draft.allocations = list(fields["allocations"])
        changed = True
    if fields.get("invoice_nos"):
        draft.invoice_nos = list(dict.fromkeys(list(draft.invoice_nos) + list(fields["invoice_nos"])))
        changed = True
    if fields.get("bank_charge") is not None and draft.bank_charge != fields["bank_charge"]:
        draft.bank_charge = fields["bank_charge"] if isinstance(fields["bank_charge"], Decimal) else _d(fields["bank_charge"])
        changed = True
    if fields.get("withholding") is not None and draft.withholding != fields["withholding"]:
        draft.withholding = fields["withholding"] if isinstance(fields["withholding"], Decimal) else _d(fields["withholding"])
        changed = True
    if fields.get("is_advance") is not None and draft.is_advance != fields["is_advance"]:
        draft.is_advance = fields["is_advance"]
        changed = True
    if fields.get("contra_type") and draft.contra_type != fields["contra_type"]:
        draft.contra_type = fields["contra_type"]
        changed = True
    if fields.get("journal_lines"):
        draft.journal_lines = list(fields["journal_lines"])
        changed = True

    if changed and len(draft.source_messages) > 1:
        draft.draft_version = int(draft.draft_version or 1) + 1
        draft.preview = None
        draft.preview_hash = None
    return draft


def compute_missing_fields(draft: FinancialDraft) -> list[str]:
    missing: list[str] = []
    if draft.amount is None:
        missing.append("amount")

    if draft.kind in {"receipt", "payment"}:
        if not draft.party_name and not draft.party_id:
            missing.append("party")
        if not draft.cash_or_bank_account_id:
            missing.append("cash_or_bank_account")
        # Allocation vs advance: need invoices OR explicit advance
        if not draft.is_advance and not draft.invoice_nos and not draft.allocations:
            missing.append("allocation_or_advance")
    elif draft.kind == "contra":
        if not draft.from_account_id:
            missing.append("from_account")
        if not draft.to_account_id:
            missing.append("to_account")
    elif draft.kind == "journal":
        if not draft.journal_lines or len(draft.journal_lines) < 2:
            missing.append("journal_lines")

    return missing


def validate_and_complete(draft: FinancialDraft) -> FinancialDraft:
    if not draft.transaction_date:
        draft.transaction_date = date.today().isoformat()

    # Ensure receipt/payment/contra never carry journal lines
    if draft.kind in {"receipt", "payment", "contra"}:
        draft.journal_lines = []

    if draft.kind == "receipt":
        if draft.is_advance:
            draft.receipt_type = "customer_advance_receipt"
            draft.allocations = []
        else:
            draft.receipt_type = "customer_receipt"
            if draft.invoice_nos and not draft.allocations and draft.amount is not None:
                draft.allocations = [
                    {"invoice_no": draft.invoice_nos[0], "amount": _money(draft.amount)}
                ]
        if not draft.party_id and draft.party_name:
            pid, pname = _map_party(draft.party_name)
            draft.party_id = pid
            if pname:
                draft.party_name = pname
        if not draft.cash_or_bank_account_id:
            # Default cash only when advance/cash language was present elsewhere — leave missing
            pass
    elif draft.kind == "payment":
        if draft.is_advance:
            draft.payment_type = "supplier_advance_payment"
            draft.allocations = []
        else:
            draft.payment_type = "supplier_payment"
            if draft.invoice_nos and not draft.allocations and draft.amount is not None:
                draft.allocations = [
                    {"invoice_no": draft.invoice_nos[0], "amount": _money(draft.amount)}
                ]
        if not draft.party_id and draft.party_name:
            pid, pname = _map_party(draft.party_name)
            draft.party_id = pid
            if pname:
                draft.party_name = pname
    elif draft.kind == "contra":
        if not draft.contra_type:
            draft.contra_type = "cash_to_bank"
        if not draft.from_account_id:
            draft.from_account_id = "acc-cash"
        if not draft.to_account_id:
            draft.to_account_id = "acc-bank"

    draft.missing_fields = compute_missing_fields(draft)
    if draft.missing_fields:
        draft.status = "awaiting_clarification"
        return draft

    draft.status = "validated"
    return draft


def clarification_message(draft: FinancialDraft) -> str:
    parts = [f"I have started a {draft.kind} entry."]
    if draft.party_name:
        parts.append(f"Party: {draft.party_name}.")
    if draft.amount is not None:
        parts.append(f"Amount: NPR {_money(draft.amount)}.")
    if draft.invoice_nos:
        parts.append(f"Invoices: {', '.join(draft.invoice_nos)}.")

    asks: list[str] = []
    if "amount" in draft.missing_fields:
        asks.append("the amount")
    if "party" in draft.missing_fields:
        asks.append("the customer or supplier name")
    if "cash_or_bank_account" in draft.missing_fields:
        asks.append("whether it was cash or bank")
    if "allocation_or_advance" in draft.missing_fields:
        asks.append("which invoice to allocate against, or say it is an advance")
    if "from_account" in draft.missing_fields or "to_account" in draft.missing_fields:
        asks.append("the from and to accounts")
    if "journal_lines" in draft.missing_fields:
        asks.append("the debit and credit accounts and amounts")

    if asks:
        if len(asks) == 1:
            parts.append(f"Please tell me {asks[0]}.")
        elif len(asks) == 2:
            parts.append(f"Please tell me {asks[0]} and {asks[1]}.")
        else:
            parts.append("Please tell me " + ", ".join(asks[:-1]) + f", and {asks[-1]}.")
    return " ".join(parts)


def build_preview(draft: FinancialDraft) -> dict[str, Any]:
    intent = _intent_for_draft(draft)
    return {
        "draft_id": draft.draft_id,
        "kind": draft.kind,
        "intent": intent,
        "amount": _money(draft.amount),
        "party": draft.party_name,
        "party_id": draft.party_id,
        "cash_or_bank_account_id": draft.cash_or_bank_account_id,
        "from_account_id": draft.from_account_id,
        "to_account_id": draft.to_account_id,
        "allocations": draft.allocations,
        "invoice_nos": draft.invoice_nos,
        "is_advance": draft.is_advance,
        "contra_type": draft.contra_type,
        "journal_lines": draft.journal_lines if draft.kind == "journal" else [],
        "tags": ["phase9_settlement", draft.kind],
        "method": "financial_draft",
        "draft_version": draft.draft_version,
    }


def _preview_hash(preview: dict[str, Any]) -> str:
    payload = {
        "draft_id": preview.get("draft_id"),
        "kind": preview.get("kind"),
        "amount": preview.get("amount"),
        "party_id": preview.get("party_id"),
        "allocations": preview.get("allocations"),
        "contra_type": preview.get("contra_type"),
    }
    return uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(payload, sort_keys=True, default=str)).hex


def _intent_for_draft(draft: FinancialDraft) -> str:
    if draft.kind == "receipt":
        if draft.is_advance:
            return "khata_customer_advance"
        return "customer_receipt"
    if draft.kind == "payment":
        if draft.is_advance:
            return "khata_payment_out"
        return "supplier_payment"
    if draft.kind == "contra":
        return draft.contra_type or "cash_to_bank"
    return "general_journal"


def preview_message(draft: FinancialDraft) -> str:
    p = draft.preview or {}
    lines = [f"**{draft.kind.title()} preview**", ""]
    if p.get("party"):
        lines.append(f"Party: {p.get('party')}")
    if p.get("amount"):
        lines.append(f"Amount: NPR {p.get('amount')}")
    if p.get("cash_or_bank_account_id"):
        lines.append(f"Cash/Bank: {p.get('cash_or_bank_account_id')}")
    if p.get("from_account_id") and p.get("to_account_id"):
        lines.append(f"From {p.get('from_account_id')} → {p.get('to_account_id')}")
    if p.get("allocations"):
        for a in p["allocations"]:
            lines.append(f"Allocation: {a.get('invoice_no')} NPR {a.get('amount')}")
    if draft.is_advance:
        lines.append("Type: advance (unapplied)")
    if draft.kind == "journal" and draft.journal_lines:
        for jl in draft.journal_lines:
            lines.append(
                f"JE: {jl.get('accountName')} Dr {jl.get('debit')} Cr {jl.get('credit')}"
            )
    lines.append("")
    lines.append("Click **Confirm** to post, or reply with corrections.")
    return "\n".join(lines)


def start_or_merge_financial(
    message: str,
    *,
    session_id: str,
    tenant_id: str = "",
    company_id: str = "",
    user_id: str = "",
    existing: FinancialDraft | None = None,
) -> FinancialDraft:
    fields = extract_financial_fields(message)
    if existing is None:
        kind = fields.get("kind") or detect_financial_kind(message) or "receipt"
        draft = FinancialDraft(
            draft_id=str(uuid.uuid4()),
            kind=kind,
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
    if not draft.narration:
        draft.narration = message.strip()[:240] or None
    validate_and_complete(draft)
    if draft.status == "validated":
        draft.preview = build_preview(draft)
        draft.preview_hash = _preview_hash(draft.preview)
        draft.status = "previewed"
    return draft


def to_confirmation_card(draft: FinancialDraft) -> dict[str, Any] | None:
    if draft.status != "previewed" or not draft.preview:
        return None

    intent = _intent_for_draft(draft)
    tags = ["phase9_settlement", draft.kind]
    if draft.is_advance:
        tags.append("advance")
    if draft.kind == "payment":
        tags.append("payment")
    if draft.kind == "receipt":
        tags.append("receipt")
    if draft.kind == "contra":
        tags.append("contra")
    if draft.kind == "journal":
        tags.append("journal")

    raw_text = " | ".join(draft.source_messages) if draft.source_messages else (draft.narration or "")
    amount = float(draft.amount) if draft.amount is not None else 0.0

    card: dict[str, Any] = {
        "intent": intent,
        "party": draft.party_name,
        "party_id": draft.party_id,
        "amount": amount,
        "date": draft.transaction_date or date.today().isoformat(),
        "raw_text": raw_text,
        "draft_id": draft.draft_id,
        "draft_version": draft.draft_version,
        "preview_hash": draft.preview_hash,
        "preview_version": draft.draft_version,
        "idempotency_key": draft.idempotency_key,
        "tags": tags,
        "narration": draft.narration,
        "method": "financial_draft",
        "settlement_kind": draft.kind,
        "cash_or_bank_account_id": draft.cash_or_bank_account_id,
        "from_account_id": draft.from_account_id,
        "to_account_id": draft.to_account_id,
        "allocations": list(draft.allocations or []),
        "invoice_nos": list(draft.invoice_nos or []),
        # ALWAYS empty for receipt/payment/contra; journal may propose lines
        "journalLines": list(draft.journal_lines) if draft.kind == "journal" else [],
        "confidence": 0.9,
    }
    if draft.kind == "receipt":
        card["receipt_type"] = draft.receipt_type or "customer_receipt"
    if draft.kind == "payment":
        card["payment_type"] = draft.payment_type or "supplier_payment"
        if draft.withholding is not None:
            card["withholding"] = _money(draft.withholding)
    if draft.kind == "contra":
        card["contra_type"] = draft.contra_type or "cash_to_bank"
        if draft.bank_charge is not None:
            card["bank_charges"] = _money(draft.bank_charge)
    return card


# ── Draft store (session-scoped, file-backed) ──────────────────────────────

_LOCK = threading.Lock()
_MEMORY: dict[str, dict[str, Any]] = {}


def _store_path() -> Path:
    base = os.environ.get("ORBIX_DRAFT_STORE_DIR") or os.path.join(
        tempfile.gettempdir(), "orbix_drafts"
    )
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path / "financial_drafts.json"


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
    return f"{tenant_id}:{company_id}:{session_id}"


def save_draft(draft: FinancialDraft) -> None:
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
) -> FinancialDraft | None:
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
        draft = FinancialDraft.from_dict(raw)
        if draft.status in {"posted", "cancelled"}:
            return None
        return draft


def mark_posted(draft: FinancialDraft, result: dict[str, Any]) -> FinancialDraft:
    draft.status = "posted"
    draft.posted_result = result
    save_draft(draft)
    return draft
