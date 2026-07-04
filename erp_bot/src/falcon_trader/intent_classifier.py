"""CA-level intent classifier for e-Khata — mirrors TypeScript parseKhata.ts"""

from __future__ import annotations

import re

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
    ("khata_tds_deducted", re.compile(r"\b(tds\s*(deduct|kateko)|withholding\s*tax)\b", re.I)),
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
    ("khata_discount_allowed", re.compile(r"\bdiscount\s*allowed\b", re.I)),
    ("khata_discount_received", re.compile(r"\bdiscount\s*received\b", re.I)),
    ("khata_other_income", re.compile(r"\b(interest\s*received|rent\s*received|other\s*income)\b", re.I)),
    ("khata_capital_introduced", re.compile(r"\bcapital\s*introduced\b", re.I)),
    ("khata_drawings", re.compile(r"\bdrawings\b", re.I)),
    ("khata_loan_received", re.compile(r"\bloan\s*received\b", re.I)),
    ("khata_loan_repayment", re.compile(r"\bloan\s*(repay\w*|payment|tiryo)\b", re.I)),
    ("khata_credit_purchase", re.compile(r"\b(udhaar\s*ma\b.*\b(kineko|kharid)\b|credit\s*purchase)\b", re.I)),
    ("khata_stock_purchase", re.compile(r"\b(stock\s*purchase|inventory)\b", re.I)),
    ("khata_stock_sale_cogs", re.compile(r"\bcogs\b", re.I)),
    ("khata_contra_cash_bank", re.compile(r"\bcontra\b", re.I)),
]

_CREDIT_SALE = re.compile(
    r"\b(udhaar|udhar|credit|on\s+account|on\s+tab)\b.*\b(becheko|beche|bikri|sale|sold|diye|extended|invoiced)\b|\b"
    r"(udhaar|udhar)\s+becheko\b|\b"
    r"(diye|die|diya)\b.*\blai\b",
    re.IGNORECASE,
)

_PAYMENT_IN = re.compile(
    r"\b(tiryo|tireko|tira|payment\s+received|paisa\s+aayo|jama|collected|settled)\b|"
    r"\b(le|bata|from)\b.*\b(diyo|diye|tiryo|tireko|payo|aayo)\b",
    re.IGNORECASE,
)

_CASH_SALE = re.compile(
    r"\b(cash|nakit|nagad)\b.*\b(becheko|beche|sale|sold|bikri)\b",
    re.IGNORECASE,
)

_PURCHASE = re.compile(
    r"\b(kineko|kine|kinna|purchase|kharid)\b",
    re.IGNORECASE,
)

_PAYMENT_OUT = re.compile(
    r"\b(payment\s+gareko|payment\s+made|paisa\s+diye|bhugtan)\b",
    re.IGNORECASE,
)

_EXPENSE = re.compile(
    r"\b(kharcha|expense|kharch)\b",
    re.IGNORECASE,
)


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
        if _CREDIT_SALE.search(source) and not _PURCHASE.search(source):
            if not re.search(r"\b(tiryo|tireko|clear|collected)\b", source, re.I):
                return "khata_credit_sale"
        if _PAYMENT_IN.search(source) and not re.search(
            r"\b(interest|discount|rent|dividend|commission)\s*(received|aayo)\b", source, re.I
        ):
            if not (re.search(r"\blai\b", source, re.I) and re.search(r"\b(diye|diyo)\b", source, re.I)):
                return "khata_payment_in"
        if _CASH_SALE.search(source):
            return "khata_cash_sale"
        if _PURCHASE.search(source) and not re.search(r"\b(udhaar|udhar|credit)\b", source, re.I):
            return "khata_purchase"
        if _PAYMENT_OUT.search(source):
            return "khata_payment_out"
        if _EXPENSE.search(source) and not re.search(r"\boutstanding\b", source, re.I):
            return "khata_expense"

    return None
