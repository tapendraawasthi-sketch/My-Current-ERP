"""CA-level intent classifier for e-Khata — mirrors TypeScript parseKhata.ts"""

from __future__ import annotations

import re

from .normalizer import normalize

INTENT_LABELS = (
    "khata_credit_sale",
    "khata_cash_sale",
    "khata_payment_in",
    "khata_purchase",
    "khata_payment_out",
    "khata_expense",
    "khata_credit_purchase",
    "khata_outstanding_expense",
    "khata_prepaid_expense",
    "khata_bad_debt_writeoff",
    "khata_bad_debt_recovery",
    "khata_provision_bad_debt",
    "khata_salary_payment",
    "khata_salary_accrual",
    "khata_ssf_employee",
    "khata_ssf_employer",
    "khata_gratuity_provision",
    "khata_gratuity_payment",
    "khata_vat_sales",
    "khata_vat_purchase",
    "khata_vat_payment",
    "khata_tds_deducted",
    "khata_tds_paid",
    "khata_other_income",
    "khata_depreciation",
    "khata_bank_charges",
    "khata_discount_allowed",
    "khata_discount_received",
    "khata_capital_introduced",
    "khata_drawings",
    "khata_loan_received",
    "khata_loan_repayment",
    "khata_stock_purchase",
    "khata_stock_sale_cogs",
    "khata_contra_cash_bank",
    "khata_sales_return",
    "khata_purchase_return",
    "khata_customer_advance",
    "khata_employee_advance",
    "khata_opening_balance",
    "khata_asset_disposal",
    "khata_inventory_write_down",
    "khata_commission_income",
    "khata_rent_expense",
)

CA_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("khata_ssf_employer", re.compile(r"\b(ssf\s*employer|employer\s*ssf|11\s*%\s*ssf)\b", re.I)),
    ("khata_ssf_employee", re.compile(r"\b(ssf\s*employee|employee\s*ssf|10\s*%\s*ssf)\b", re.I)),
    ("khata_gratuity_provision", re.compile(r"\bgratuity\s*provision\b", re.I)),
    ("khata_gratuity_payment", re.compile(r"\bgratuity\s*(payment|diyo|tiryo|paid)\b", re.I)),
    ("khata_provision_bad_debt", re.compile(r"\bprovision\s*(for\s*)?bad\s*debt\b", re.I)),
    ("khata_bad_debt_recovery", re.compile(r"\bbad\s*debt\s*recover\w*\b", re.I)),
    ("khata_bad_debt_writeoff", re.compile(r"\b(bad\s*debt\s*(write\s*off|writeoff)|write\s*off)\b", re.I)),
    ("khata_vat_payment", re.compile(r"\bvat\s*(payment|tiryo|paid|jama)\b", re.I)),
    ("khata_vat_sales", re.compile(r"\bvat\s*(sale|bikri)\b", re.I)),
    ("khata_vat_purchase", re.compile(r"\bvat\s*(purchase|kharid|kineko)\b", re.I)),
    ("khata_tds_paid", re.compile(r"\btds\s*(paid|tiryo|remittance)\b", re.I)),
    ("khata_tds_deducted", re.compile(r"\b(tds\s*(deducted|deduct|kateko|withhold)|withholding\s*tax)\b", re.I)),
    ("khata_sales_return", re.compile(r"\b(sales\s*return|credit\s*note|saman\s*firta|firtayo|return\s+gare)\b", re.I)),
    ("khata_purchase_return", re.compile(r"\b(purchase\s*return|debit\s*note|supplier\s*return)\b", re.I)),
    ("khata_customer_advance", re.compile(r"\b(customer\s*advance|advance\s*(received|liyo|aayo)|unearned\s*revenue)\b", re.I)),
    ("khata_employee_advance", re.compile(r"\b(employee\s*advance|staff\s*advance|talab\s*advance)\b", re.I)),
    ("khata_opening_balance", re.compile(r"\b(opening\s*balance|opening\s*entry|suruwati\s*khata)\b", re.I)),
    ("khata_commission_income", re.compile(r"\b(commission\s*(income|received|aayo|aamdani))\b", re.I)),
    ("khata_rent_expense", re.compile(r"\b(rent\s*(expense|paid|tiryo)|bhaada|bhada)\b", re.I)),
    ("khata_salary_accrual", re.compile(r"\b(salary\s*accrual|talab\s*provision|accrued\s*salary)\b", re.I)),
    ("khata_salary_payment", re.compile(r"\bsalary\s*(payment|diyo|tiryo|paid)\b", re.I)),
    ("khata_outstanding_expense", re.compile(r"\boutstanding\s*(expense|kharcha)\b", re.I)),
    ("khata_prepaid_expense", re.compile(r"\bprepaid\b", re.I)),
    ("khata_depreciation", re.compile(r"\bdepreciation\b", re.I)),
    ("khata_bank_charges", re.compile(r"\bbank\s*(charge|fee)\b", re.I)),
    ("khata_discount_allowed", re.compile(r"\b(discount\s*allowed|chhut\s*diyo)\b", re.I)),
    ("khata_discount_received", re.compile(r"\b(discount\s*received|chhut\s*paayo|chhut\s*milyo)\b", re.I)),
    ("khata_other_income", re.compile(r"\b(interest\s*received|rent\s*received|other\s*income)\b", re.I)),
    ("khata_capital_introduced", re.compile(r"\bcapital\s*introduced\b", re.I)),
    ("khata_drawings", re.compile(r"\bdrawings\b", re.I)),
    ("khata_loan_received", re.compile(r"\bloan\s*received\b", re.I)),
    ("khata_loan_repayment", re.compile(r"\bloan\s*(repay\w*|payment|tiryo)\b", re.I)),
    ("khata_credit_purchase", re.compile(r"\b(udhaar\s*ma\b.*\b(kineko|kharid)\b|credit\s*purchase)\b", re.I)),
    ("khata_inventory_write_down", re.compile(
        r"\b(inventory\s*write\s*down|stock\s*adjustment|shrinkage|obsolete\s*stock|stock\s*count\s*difference|saman\s*bigryo)\b",
        re.I,
    )),
    ("khata_asset_disposal", re.compile(
        r"\b(asset\s*disposal|sold\s*(old\s*)?(vehicle|machine|asset|computer|equipment)|fixed\s*asset\s*sold|machine\s*becheko)\b",
        re.I,
    )),
    ("khata_stock_purchase", re.compile(
        r"\b(stock\s*(purchase|kineko)|stock\s*kineko|saman\s*kineko)\b", re.I
    )),
    ("khata_stock_sale_cogs", re.compile(r"\bcogs\b", re.I)),
    ("khata_contra_cash_bank", re.compile(r"\bcontra\b", re.I)),
]

_CREDIT_TERMS = r"(udhaar|udharo|udhar|credit|उधार|on\s+account|on\s+tab|deferred\s*payment)"
_SALE_TERMS = r"(becheko|beche|bikri|bik|sale|sold|diye|die|diya|extended|invoiced|dispatched|दिए)"


def _has_credit_sale_cue(text: str) -> bool:
    if re.search(r"\b(kineko|kine|kiniyo|kharid|purchase|saman)\b", text, re.I):
        return False
    if re.search(r"\b(tiryo|tireko|tira|clear|jama|payment\s+received|paisa\s+aayo|collected|outstanding\s+dues)\b", text, re.I):
        return False
    return bool(
        re.search(rf"\b{_CREDIT_TERMS}\b.*\b{_SALE_TERMS}\b", text, re.I)
        or re.search(r"\b(udhaar|udharo|udhar)\s+becheko\b", text, re.I)
        or re.search(r"\bbecheko\b.*\b(udhaar|udharo|udhar)\b", text, re.I)
        or (
            re.search(r"\b(diye|die|diya|diae|दिए)\b", text, re.I)
            and re.search(r"\b(lai|लाई)\b", text, re.I)
            and not re.search(r"\b(tiryo|tireko)\b", text, re.I)
        )
    )


def _has_payment_in_cue(text: str) -> bool:
    if re.search(r"\b(interest|discount|rent|dividend|commission)\s*(received|aayo)\b", text, re.I):
        return False
    if (
        re.search(r"\b(lai|लाई)\b", text, re.I)
        and re.search(r"\b(diye|diyo|die|diya|दिए)\b", text, re.I)
        and not re.search(r"\b(tiryo|tireko|clear)\b", text, re.I)
    ):
        return False
    return bool(
        re.search(
            r"\b(tiryo|tireko|tira|tire|payment\s+received|paisa\s+aayo|jama|jama\s+gareko|payo|paye|collected|settled|outstanding\s+dues)\b",
            text,
            re.I,
        )
        or (
            re.search(r"\breceived\b", text, re.I)
            and re.search(r"\b(payment|paisa|debtor|debt|cheque|check)\b", text, re.I)
        )
        or (
            re.search(r"\b(le|bata|from)\b", text, re.I)
            and re.search(r"\b(diyo|diye|tiryo|tireko|payo|paye|aayo)\b", text, re.I)
            and not re.search(r"\b(lai|लाई)\b", text, re.I)
        )
    )


def _has_cash_sale_cue(text: str) -> bool:
    if re.search(r"\b(asset\s*disposal|sold\s+asset|fixed\s*asset|machine\s*becheko)\b", text, re.I):
        return False
    if (
        re.search(r"\b(sold|sale|sales|revenue|earned|selling)\b", text, re.I)
        and not re.search(r"\b(udhaar|udhar|udharo|credit|bought|purchase|kineko|kharid)\b", text, re.I)
    ):
        return True
    return bool(
        re.search(r"\b(cash|nakit|nagad|nakad)\b", text, re.I)
        and re.search(r"\b(bikri|becheko|beche|bik|sale|sold)\b", text, re.I)
    )


def _has_purchase_cue(text: str) -> bool:
    if re.search(r"\b(inventory\s*write\s*down|write\s*down|shrinkage)\b", text, re.I):
        return False
    return bool(
        re.search(
            r"\b(kineko|kine|kiniyo|kinyo|kinna|kharid|kharido|purchase|bought|buy|purchased|procured|extended\s+credit\s+to\s+buy)\b",
            text,
            re.I,
        )
        and not re.search(r"\b(udhaar|udhar|credit\s+sale|becheko|sold)\b", text, re.I)
    )


def _has_payment_out_cue(text: str) -> bool:
    return bool(
        re.search(
            r"\b(payment\s+gareko|payment\s+made|paisa\s+diye|tirna\s+diye|bhugtan|tiryo\s+diye)\b|\bpayment\b.*\bgareko\b",
            text,
            re.I,
        )
    )


def _has_expense_cue(text: str) -> bool:
    return bool(re.search(r"\b(kharcha|kharcho|expense|kharch)\b", text, re.I))


def _classify_work_intent(text: str) -> str | None:
    t = text.lower()
    if re.search(r"\b(udhaar|udhar|udharo|credit\s+sale|on\s+credit)\b", t) and re.search(
        r"\b(sold|sale|becheko|bikri|diye)\b", t
    ):
        return "khata_credit_sale"
    if re.search(r"\b(tds\s*deduct|withhold)\b", t):
        return "khata_tds_deducted"
    if re.search(r"\b(discount\s*allowed|chhut\s*diyo)\b", t):
        return "khata_discount_allowed"
    return None


def classify(text: str, raw_text: str | None = None) -> str | None:
    sources = [s.strip() for s in [raw_text or "", text] if s.strip()]

    for source in sources:
        for intent, pattern in CA_PATTERNS:
            if intent == "khata_bad_debt_writeoff" and re.search(r"\brecover\w*\b", source, re.I):
                continue
            if intent == "khata_loan_received" and re.search(r"\b(repay|repayment|tiryo|payment)\b", source, re.I):
                if not re.search(r"\breceived\b", source, re.I):
                    continue
            if pattern.search(source):
                return intent

    for source in sources:
        if _has_credit_sale_cue(source):
            return "khata_credit_sale"
        if _has_payment_in_cue(source):
            return "khata_payment_in"
        if _has_cash_sale_cue(source):
            return "khata_cash_sale"
        if _has_purchase_cue(source):
            if re.search(r"\b(udhaar|udhar|credit)\b", source, re.I):
                return "khata_credit_purchase"
            return "khata_purchase"
        if _has_payment_out_cue(source):
            return "khata_payment_out"
        if _has_expense_cue(source) and not re.search(r"\boutstanding\b", source, re.I):
            return "khata_expense"

        work = _classify_work_intent(source)
        if work:
            return work

        if re.search(r"\b(diye|die|diya|diae|दिए)\b", source, re.I) and re.search(r"\b(lai|लाई)\b", source, re.I):
            return "khata_credit_sale"

    return None
