"""Request operation classification — separate from authorization.

Classifies what the user wants; mode policy decides whether it is allowed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any


class OperationClass(str, Enum):
    GENERAL_QUESTION = "general_question"
    ACCOUNTING_QUESTION = "accounting_question"
    ERP_DATA_QUERY = "erp_data_query"
    REPORT_REQUEST = "report_request"
    REPORT_FOLLOW_UP = "report_follow_up"
    TRANSACTION_CREATE = "transaction_create"
    TRANSACTION_MODIFY = "transaction_modify"
    TRANSACTION_REVERSE = "transaction_reverse"
    MASTER_DATA_CREATE = "master_data_create"
    MASTER_DATA_MODIFY = "master_data_modify"
    CONFIRMATION = "confirmation"
    CANCELLATION = "cancellation"
    CLARIFICATION_REPLY = "clarification_reply"


_GREETING = re.compile(
    r"^\s*(hi|hello|hey|namaste|namaskar|good\s+(morning|afternoon|evening)|"
    r"k\s*(?:xa|cha)|ke\s*(?:xa|cha)|kasto\s*(?:xa|cha)|halkhabar|hal\s*khabar|"
    r"sanchai(?:\s*(?:xa|cha))?|"
    r"what\s+can\s+you\s+do|help(?:\s+me)?|thanks|thank\s+you)\b",
    re.I,
)
_ACCOUNTING_Q = re.compile(
    r"\b(what\s+is|explain|how\s+(?:is|are|was|were|do|does|to)|define|meaning\s+of)\b.*"
    r"\b(depreciation|journal|ledger|double[\s-]?entry|vat|output\s+vat|tds|nfrs|ifrs|"
    r"balance\s+sheet|trial\s+balance|accrual|provision|sales\s+return|credit\s*note)\b",
    re.I,
)
_REPORT = re.compile(
    r"\b(balance\s+sheet|trial\s+balance|profit\s*(and|&)\s*loss|p\s*&\s*l|"
    r"cash\s+flow|day\s*book|aging|stock\s+summary|vat\s+report|"
    r"show\s+(my\s+)?(bs|tb|pnl)|vasalat|parikshan)\b",
    re.I,
)
_REPORT_FOLLOW = re.compile(
    r"^\s*(compare|include|exclude|expand|collapse|hide\s+zero|show\s+zero|"
    r"drill\s*down|add\s+comparison|remove\s+comparison|with\s+subgroups?|"
    r"with\s+ledgers?|previous\s+year|last\s+year|more\s+detail|less\s+detail|"
    r"only\s+major|groups?\s+and\s+subgroups?)\b",
    re.I,
)
_TXN_CREATE = re.compile(
    r"\b(enter|create|record|post|pass|make)\b.*\b(purchase|sale|sales|payment|"
    r"receipt|journal|voucher|entry|invoice|return|credit\s*note|contra)\b|"
    r"\b(bought|purchased|kineko|kinyo|kinye|kine|kinne|kharid|sold|becheko|bikri|paid|received|"
    r"tiryo|diyo|payo|returned|return(?:ing)?|firta|deposit|withdraw(?:al)?|"
    r"transfer)\b|"
    r"\b(sales\s+return|credit\s*notes?|cash\s+to\s+bank|bank\s+to\s+cash|"
    r"general\s+journal)\b",
    re.I,
)
_TXN_MODIFY = re.compile(
    r"\b(edit|modify|update|correct|change)\b.*\b(voucher|entry|invoice|journal)\b",
    re.I,
)
_TXN_REVERSE = re.compile(
    r"\b(reverse|cancel|void|delete)\b.*\b(voucher|entry|invoice|transaction)\b",
    re.I,
)
_MASTER_CREATE = re.compile(
    r"\b(create|add|new)\b.*\b(ledger|customer|supplier|party|item|account)\b",
    re.I,
)
_MASTER_MODIFY = re.compile(
    r"\b(edit|rename|update|modify)\b.*\b(ledger|customer|supplier|party|item|account)\b",
    re.I,
)
_CONFIRM = re.compile(r"^\s*(yes|y|ok|okay|confirm|thik|thik\s*cha|sahi|go\s*ahead)\s*[.!]?$", re.I)
_CANCEL = re.compile(r"^\s*(no|n|cancel|nahi|nahin|stop|abort)\s*[.!]?$", re.I)
_ERP_QUERY = re.compile(
    r"\b(balance\s+of|who\s+owes|top\s+debtors|overdue|stock\s+below|"
    r"how\s+much\s+(vat|payable|receivable)|show\s+vouchers|"
    r"ledger\s+of|party\s+statement|"
    r"(?:[A-Za-z\u0900-\u097F]{2,40})\s+ko\s+(?:baki|balance|khata|udhaar|udhar|hisab)|"
    r"(?:[A-Za-z\u0900-\u097F]{2,40})\s+lai\s+(?:kati\s+)?(?:dinu|tirnu|paunu)|"
    r"kati\s+(?:dinu|tirnu|paunu|baki)|"
    r"paisa\s+kati\s+(?:tirnu|dinu|paunu))\b",
    re.I,
)


@dataclass(frozen=True)
class ClassificationResult:
    operation_class: OperationClass
    confidence: float
    intent_hint: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "operation_class": self.operation_class.value,
            "confidence": self.confidence,
            "intent_hint": self.intent_hint,
            "metadata": self.metadata or {},
        }


def classify_operation(
    message: str,
    *,
    has_pending_draft: bool = False,
    has_active_report: bool = False,
    has_pending_confirmation: bool = False,
) -> ClassificationResult:
    """Classify a user message into an operation class."""
    from ..nlu.text_normalize import normalize_accounting_text

    text = normalize_accounting_text(message or "").strip() or (message or "").strip()
    if not text:
        return ClassificationResult(OperationClass.GENERAL_QUESTION, 0.5)

    if has_pending_confirmation and _CONFIRM.search(text):
        return ClassificationResult(OperationClass.CONFIRMATION, 0.95, "confirm")
    if has_pending_confirmation and _CANCEL.search(text):
        return ClassificationResult(OperationClass.CANCELLATION, 0.95, "cancel")

    if has_pending_draft:
        # Prefer merging into the open draft unless the user clearly starts a new txn/report
        new_txn = re.search(
            r"\b(enter|create|record|post)\b.*\b(purchase|sale|payment|receipt|journal|voucher|entry|return|credit\s*note)\b|"
            r"\b(i\s+)?(bought|purchased|sold|kineko|kinyo|kharid|becheko|returned|firta)\b|"
            r"\b(sales\s+return|credit\s*notes?)\b",
            text,
            re.I,
        )
        if not new_txn and not _REPORT.search(text):
            return ClassificationResult(
                OperationClass.CLARIFICATION_REPLY,
                0.9,
                "purchase_clarification",
            )

    if has_active_report and _REPORT_FOLLOW.search(text):
        return ClassificationResult(OperationClass.REPORT_FOLLOW_UP, 0.9, "report_follow_up")

    if _CONFIRM.search(text):
        return ClassificationResult(OperationClass.CONFIRMATION, 0.7, "confirm")
    if _CANCEL.search(text):
        return ClassificationResult(OperationClass.CANCELLATION, 0.7, "cancel")

    if _GREETING.search(text) and len(text) < 80:
        return ClassificationResult(OperationClass.GENERAL_QUESTION, 0.95, "greeting")

    if _REPORT.search(text):
        return ClassificationResult(OperationClass.REPORT_REQUEST, 0.92, "report_generation")

    # Conceptual VAT / return questions must win over return-language txn create
    if _ACCOUNTING_Q.search(text):
        return ClassificationResult(OperationClass.ACCOUNTING_QUESTION, 0.85, "accounting_qa")

    if _TXN_REVERSE.search(text):
        return ClassificationResult(OperationClass.TRANSACTION_REVERSE, 0.88, "transaction_reverse")
    if _TXN_MODIFY.search(text):
        return ClassificationResult(OperationClass.TRANSACTION_MODIFY, 0.85, "transaction_modify")
    if _MASTER_CREATE.search(text):
        return ClassificationResult(OperationClass.MASTER_DATA_CREATE, 0.85, "master_create")
    if _MASTER_MODIFY.search(text):
        return ClassificationResult(OperationClass.MASTER_DATA_MODIFY, 0.85, "master_modify")
    if _TXN_CREATE.search(text):
        if re.search(r"\b(bought|purchase|kineko|kinyo|kinye|kine|kharid)\b", text, re.I) and not re.search(
            r"\b(paid|received|deposit|transfer|contra)\b", text, re.I
        ):
            intent = "purchase_entry"
        elif re.search(r"\b(returned|return|firta|credit\s*note|sales\s+return)\b", text, re.I):
            intent = "sales_return_entry"
        elif re.search(r"\b(received|payment\s+in|customer\s+paid|collected)\b", text, re.I):
            intent = "customer_receipt"
        elif re.search(r"\b(paid|payment\s+out|supplier\s+payment)\b", text, re.I):
            intent = "supplier_payment"
        elif re.search(r"\b(contra|cash\s+to\s+bank|deposit|withdraw|transfer)\b", text, re.I):
            intent = "cash_to_bank"
        elif re.search(r"\b(journal|debit\s+.\s+credit)\b", text, re.I):
            intent = "general_journal"
        else:
            intent = "transaction_create"
        return ClassificationResult(OperationClass.TRANSACTION_CREATE, 0.9, intent)

    if _ERP_QUERY.search(text):
        return ClassificationResult(OperationClass.ERP_DATA_QUERY, 0.85, "erp_query")

    if has_active_report and len(text) < 120:
        return ClassificationResult(OperationClass.REPORT_FOLLOW_UP, 0.6, "report_follow_up")

    return ClassificationResult(OperationClass.GENERAL_QUESTION, 0.6, "general_qa")


MUTATING_CLASSES = frozenset(
    {
        OperationClass.TRANSACTION_CREATE,
        OperationClass.TRANSACTION_MODIFY,
        OperationClass.TRANSACTION_REVERSE,
        OperationClass.MASTER_DATA_CREATE,
        OperationClass.MASTER_DATA_MODIFY,
        OperationClass.CONFIRMATION,
    }
)


def is_mutating_operation(op: OperationClass) -> bool:
    return op in MUTATING_CLASSES
