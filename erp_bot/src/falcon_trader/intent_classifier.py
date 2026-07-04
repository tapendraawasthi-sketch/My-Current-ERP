from __future__ import annotations

import re

INTENT_LABELS = (
    "khata_credit_sale",
    "khata_cash_sale",
    "khata_payment_in",
    "khata_purchase",
    "khata_payment_out",
    "khata_expense",
)

_CREDIT_SALE = re.compile(
    r"\b(udhaar|udhar|credit|उधार)\b.*\b(diye|die|diya|diae|दिए|दिए)\b|\b"
    r"(udhaar|udhar|credit|उधार)\b|\b"
    r"(udhaar|udhar|उधार)\s+(diye|die|diya|diae|दिए)\b",
    re.IGNORECASE,
)

_PAYMENT_IN = re.compile(
    r"\b(tiryo|tireko|tira|received|aayo|aayeko|payment\s+received|"
    r"paisa\s+aayo|jama)\b",
    re.IGNORECASE,
)

_CASH_SALE = re.compile(
    r"\b(cash|nakit)\b.*\b(becheko|beche|sale|sold)\b|\b"
    r"(becheko|beche|sold)\b.*\b(cash|nakit)\b|\b"
    r"cash\s+ma\b|\b"
    r"sold\b.*\bfor\b",
    re.IGNORECASE,
)

_PURCHASE = re.compile(
    r"\b(kineko|kine|kinna|purchase|kharid)\b",
    re.IGNORECASE,
)

_PAYMENT_OUT = re.compile(
    r"\b(payment\s+gareko|payment\s+made|paisa\s+diye|tirna\s+diye|"
    r"bhugtan|tiryo\s+diye)\b|\b"
    r"payment\b.*\bgareko\b",
    re.IGNORECASE,
)

_EXPENSE = re.compile(
    r"\b(kharcha|expense|kharch)\b",
    re.IGNORECASE,
)


def classify(text: str) -> str | None:
    q = text.strip()
    if not q:
        return None

    if _CREDIT_SALE.search(q):
        return "khata_credit_sale"
    if _PAYMENT_IN.search(q):
        return "khata_payment_in"
    if _CASH_SALE.search(q):
        return "khata_cash_sale"
    if _PURCHASE.search(q):
        return "khata_purchase"
    if _PAYMENT_OUT.search(q):
        return "khata_payment_out"
    if _EXPENSE.search(q):
        return "khata_expense"

    if re.search(r"\b(diye|die|diya|diae)\b", q, re.IGNORECASE):
        if re.search(r"\b(lai|le)\b", q, re.IGNORECASE):
            return "khata_credit_sale"
        return None

    return None
