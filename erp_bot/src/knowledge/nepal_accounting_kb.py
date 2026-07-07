"""
Nepal Accounting Knowledge Base

Covers: NFRS/NAS, Income Tax Act 2058, VAT Act 2052, SSF Act 2074,
Labour Act 2074, Company Act 2063, Nepal Rastra Bank directives.

Queryable structured data for the accounting reasoner and RAG layer.
"""

from __future__ import annotations

import math
import re
from typing import Any, Literal, TypedDict

Side = Literal["debit", "credit"]


class AccountDef(TypedDict, total=False):
    code: str
    name: str
    type: str
    group: str
    contra: bool


class LineSpec(TypedDict):
    account: str
    amount_expr: str
    description: str
    side: Side


class EntryRule(TypedDict, total=False):
    description: str
    debit: list[tuple[str, str, str]]
    credit: list[tuple[str, str, str]]
    vat_variant: dict[str, list[tuple[str, str, str]]]
    validation: list[str]
    nepali_explanation: str
    english_explanation: str
    khata_intent: str
    tags: list[str]


# ── Chart of accounts (KH-* codes used by e-Khata) ────────────────────────────

CHART_OF_ACCOUNTS: dict[str, AccountDef] = {
    # ASSETS (1xxx)
    "KH-CASH": {"code": "1001", "name": "Cash in Hand", "type": "asset", "group": "current_asset"},
    "KH-BANK": {"code": "1002", "name": "Bank Account", "type": "asset", "group": "current_asset"},
    "KH-DEBT": {"code": "1100", "name": "Sundry Debtors", "type": "asset", "group": "current_asset"},
    "KH-STOCK": {"code": "1200", "name": "Stock/Inventory", "type": "asset", "group": "current_asset"},
    "KH-PREPAID": {"code": "1300", "name": "Prepaid Expenses", "type": "asset", "group": "current_asset"},
    "KH-VAT-IN": {"code": "1400", "name": "Input VAT (Tax Credit)", "type": "asset", "group": "current_asset"},
    "KH-TDS-ADV": {"code": "1500", "name": "TDS Advance (Tax Deducted on Us)", "type": "asset", "group": "current_asset"},
    "KH-FIXED": {"code": "1600", "name": "Fixed Assets", "type": "asset", "group": "fixed_asset"},
    "KH-ACC-DEP": {
        "code": "1601",
        "name": "Accumulated Depreciation",
        "type": "asset",
        "group": "fixed_asset",
        "contra": True,
    },
    "KH-EMP-ADV": {"code": "1700", "name": "Employee Advance", "type": "asset", "group": "current_asset"},
    "KH-PPE": {"code": "1602", "name": "Property Plant & Equipment", "type": "asset", "group": "fixed_asset"},
    # LIABILITIES (2xxx)
    "KH-CRED": {"code": "2001", "name": "Sundry Creditors", "type": "liability", "group": "current_liability"},
    "KH-VAT-OUT": {"code": "2100", "name": "Output VAT Payable", "type": "liability", "group": "current_liability"},
    "KH-TDS-PAY": {"code": "2200", "name": "TDS Payable", "type": "liability", "group": "current_liability"},
    "KH-SAL-PAY": {"code": "2300", "name": "Salary Payable", "type": "liability", "group": "current_liability"},
    "KH-SSF-EMP": {"code": "2301", "name": "SSF Employee Payable", "type": "liability", "group": "current_liability"},
    "KH-SSF-ER": {"code": "2302", "name": "SSF Employer Payable", "type": "liability", "group": "current_liability"},
    "KH-GRAT-PROV": {"code": "2400", "name": "Gratuity Provision", "type": "liability", "group": "non_current_liability"},
    "KH-LOAN": {"code": "2500", "name": "Loan Payable", "type": "liability", "group": "non_current_liability"},
    "KH-OUT-EXP": {"code": "2600", "name": "Outstanding Expenses", "type": "liability", "group": "current_liability"},
    "KH-BD-PROV": {"code": "2700", "name": "Provision for Bad Debts", "type": "liability", "group": "current_liability"},
    "KH-CUST-ADV": {"code": "2800", "name": "Customer Advance", "type": "liability", "group": "current_liability"},
    # EQUITY (3xxx)
    "KH-CAP": {"code": "3001", "name": "Capital Account", "type": "equity", "group": "equity"},
    "KH-DRAW": {"code": "3002", "name": "Drawings", "type": "equity", "group": "equity"},
    "KH-RETAINED": {"code": "3003", "name": "Retained Earnings", "type": "equity", "group": "equity"},
    # INCOME (4xxx)
    "KH-SALE": {"code": "4001", "name": "Sales Revenue", "type": "income", "group": "operating_income"},
    "KH-OTH-INC": {"code": "4100", "name": "Other Income", "type": "income", "group": "non_operating_income"},
    "KH-DISC-REC": {"code": "4200", "name": "Discount Received", "type": "income", "group": "operating_income"},
    "KH-BD-REC": {"code": "4300", "name": "Bad Debts Recovered", "type": "income", "group": "non_operating_income"},
    "KH-INT-INC": {"code": "4400", "name": "Interest Income", "type": "income", "group": "non_operating_income"},
    # EXPENSES (5xxx)
    "KH-PUR": {"code": "5001", "name": "Purchases / COGS", "type": "expense", "group": "direct_expense"},
    "KH-SAL": {"code": "5100", "name": "Salary & Wages", "type": "expense", "group": "operating_expense"},
    "KH-EXP": {"code": "5200", "name": "Operating Expenses", "type": "expense", "group": "operating_expense"},
    "KH-DEPR": {"code": "5300", "name": "Depreciation Expense", "type": "expense", "group": "operating_expense"},
    "KH-BD-EXP": {"code": "5400", "name": "Bad Debts Expense", "type": "expense", "group": "operating_expense"},
    "KH-BANK-CHG": {"code": "5500", "name": "Bank Charges", "type": "expense", "group": "operating_expense"},
    "KH-DISC-ALL": {"code": "5600", "name": "Discount Allowed", "type": "expense", "group": "operating_expense"},
    "KH-SSF-ER-EXP": {"code": "5700", "name": "SSF Employer Expense", "type": "expense", "group": "operating_expense"},
    "KH-GRAT-EXP": {"code": "5800", "name": "Gratuity Expense", "type": "expense", "group": "operating_expense"},
    "KH-INT-EXP": {"code": "5900", "name": "Interest Expense", "type": "expense", "group": "non_operating_expense"},
}

# ── Nepal tax & statutory rates ───────────────────────────────────────────────

NEPAL_TAX_RATES: dict[str, Any] = {
    "vat": {
        "standard_rate": 0.13,
        "threshold": 5_000_000,
        "filing": "monthly_by_25th",
        "act": "VAT Act 2052",
    },
    "tds": {
        "rent_natural_person": 0.10,
        "rent_organization": 0.15,
        "service_fee": 0.15,
        "commission": 0.15,
        "interest": 0.15,
        "interest_bank": 0.05,
        "dividend": 0.05,
        "royalty": 0.15,
        "natural_resource_payment": 0.15,
        "meeting_allowance": 0.15,
        "contract_payment": 0.015,
        "default": 0.15,
    },
    "income_tax": {
        "individual_slabs": [
            (500_000, 0.01),
            (200_000, 0.10),
            (300_000, 0.20),
            (1_000_000, 0.30),
            (math.inf, 0.36),
        ],
        "company_general": 0.25,
        "company_manufacturing": 0.20,
        "company_special_industry": 0.20,
        "act": "Income Tax Act 2058",
    },
    "ssf": {
        "employee_contribution": 0.10,
        "employer_contribution": 0.11,
        "total_on_basic": 0.21,
        "retirement_age": 60,
        "act": "SSF Act 2074",
    },
    "gratuity": {
        "provision_rate": 0.0833,
        "note": "Approx 1 month basic per year of service (Labour Act 2074)",
    },
    "bonus": {
        "mandatory_rate": 0.10,
        "note": "10% of net profit for profitable companies",
    },
    "depreciation_rates": {
        "building": 0.05,
        "furniture": 0.25,
        "vehicle": 0.20,
        "computer": 0.25,
        "machinery": 0.15,
        "intangible": 0.25,
        "goodwill": 0.10,
    },
    "fiscal_year": {
        "start": "Shrawan 1",
        "end": "Ashad 31",
        "note": "Mid-July to mid-July (Nepal Bikram Sambat)",
    },
}

# ── IFRS/NAS glossary (offline Q&A without Ollama) ───────────────────────────

ACCOUNTING_GLOSSARY: dict[str, dict[str, str]] = {
    "sampatti": {
        "english": "Asset",
        "aliases": "sampati asset sampatti",
        "definition": (
            "Present economic resource controlled by the entity as a result of past events "
            "(IFRS Conceptual Framework Para 4.3)."
        ),
        "nepali": (
            "Sampatti (सम्पत्ति) = entity le niyantran ma rakhne arthik srot, "
            "bhootpurba ghatna bata prapta. Udaharan: Cash, Bank, Debtors, Stock, Fixed Assets."
        ),
        "ifrs_para": "Para 4.3",
    },
    "dayitwo": {
        "english": "Liability",
        "aliases": "dayitwo rin liability payable",
        "definition": "Present obligation to transfer an economic resource from past events (Para 4.26).",
        "nepali": "Dayitwo/Rin = arthik srot transfer garne ahileko dayitwo, bhootpurva ghatna bata.",
        "ifrs_para": "Para 4.26",
    },
    "puni": {
        "english": "Equity",
        "aliases": "puni equity capital",
        "definition": "Residual interest in assets after deducting liabilities (Para 4.63).",
        "nepali": "Puni = sampatti ma dayitwo ghataepachi bachi raheko hissa.",
        "ifrs_para": "Para 4.63",
    },
    "aamdani": {
        "english": "Income / Revenue",
        "aliases": "aamdani amdani income revenue bikri",
        "definition": (
            "Increases in assets or decreases in liabilities that increase equity "
            "(IFRS Conceptual Framework Para 4.68)."
        ),
        "nepali": (
            "Aamdani (आम्दानी / Income) = vyavsay bata prapta arthik labh jun puni (equity) badhauxa. "
            "Udaharan: saman bikri, sewa bikri, byaj aamdani. "
            "Journal: Dr Cash/Debtor, Cr Sales/Income."
        ),
        "ifrs_para": "Para 4.68",
    },
    "kharcha": {
        "english": "Expense",
        "aliases": "kharcha expense cost kharch",
        "definition": (
            "Decreases in assets or increases in liabilities that decrease equity "
            "(IFRS Conceptual Framework Para 4.73)."
        ),
        "nepali": (
            "Kharcha (खर्च / Expense) = vyavsay chalna lagnne kharcha jun puni (equity) ghatcha. "
            "Yo sampatti hoina — yo kharcha ho. "
            "Udaharan: talab, bhada (rent), bijuli, marketing, kharidiya saman ko mulya (COGS). "
            "Journal: Dr Expense Account, Cr Cash/Bank/Creditor."
        ),
        "ifrs_para": "Para 4.73",
    },
    "depreciation": {
        "english": "Depreciation",
        "aliases": "depreciation ghasai mulya ghataunu",
        "definition": "Systematic allocation of depreciable amount of an asset over its useful life.",
        "nepali": "Depreciation = fixed asset ko upayogi jiwanko lagi mulya ko vyavasthit ghatai.",
    },
    "faithful representation": {
        "english": "Faithful Representation",
        "aliases": "faithful representation biswasilo pratinidhitwo",
        "definition": "Information is complete, neutral, and free from error (Para 2.12).",
        "nepali": "Biswasilo pratinidhitwo = jaankari pura, neutral, ra truti-rahit hunu.",
        "ifrs_para": "Para 2.12",
    },
    "recognition": {
        "english": "Recognition",
        "aliases": "recognition manyata",
        "definition": "Item meets element definition and provides relevant + faithfully represented info (Ch. 5).",
        "nepali": "Manyata = item le paribhasha pura garyo ra jaankari sambandhit + biswasilo cha.",
    },
    "vat": {
        "english": "Value Added Tax",
        "aliases": "vat bhyaat",
        "definition": "Nepal standard VAT rate 13% on taxable supplies; monthly filing by 25th.",
        "nepali": "Nepal ma standard VAT 13%. Darta threshold NPR 50 lakh; mahina ko 25 gatilai return.",
    },
    "tds": {
        "english": "Tax Deducted at Source",
        "aliases": "tds withholding katauti",
        "definition": "Withholding tax on payments (rent, service, interest, etc.) per Income Tax Act.",
        "nepali": "TDS = bhugtan ma source ma kataune income tax (rent 10-15%, service 15%, etc.).",
    },
    "ssf": {
        "english": "Social Security Fund",
        "aliases": "ssf social security",
        "definition": "Employee 10% + Employer 11% on basic salary (SSF Act 2074).",
        "nepali": "SSF: karmachari 10% + employer 11% basic ma.",
    },
    "udhaar": {
        "english": "Credit / Receivable-Payable",
        "aliases": "udhaar credit receivable payable",
        "definition": "Udhaar deko = credit sale; udhaar tiryo = payment received on credit.",
        "nepali": "Udhaar deko = credit sale (debtor badhcha). Udhaar tiryo = payment aayo (debtor ghatcha).",
    },
    "debit": {
        "english": "Debit",
        "aliases": "debit dr",
        "definition": "Left side of account; increases assets/expenses, decreases liabilities/income.",
        "nepali": "Debit (Dr) = baaya patra; asset/kharcha badhauxa, dayitwo/aamdani ghatauxa.",
    },
    "credit": {
        "english": "Credit",
        "aliases": "credit cr",
        "definition": "Right side of account; increases liabilities/income, decreases assets/expenses.",
        "nepali": "Credit (Cr) = daaya patra; dayitwo/aamdani badhauxa, asset/kharcha ghatauxa.",
    },
    "trial balance": {
        "english": "Trial Balance",
        "aliases": "trial balance",
        "definition": "List of all ledger balances; total debits must equal total credits.",
        "nepali": "Trial balance = sabai khata ko balance; kul Dr = kul Cr hunu parcha.",
    },
    "going concern": {
        "english": "Going Concern",
        "aliases": "going concern chalirakhne",
        "definition": "Entity will continue operating for foreseeable future (Para 3.8).",
        "nepali": "Chalirakhne aadhar = entity agami samay ma pani sanchalan ma rahane.",
        "ifrs_para": "Para 3.8",
    },
    "fair value": {
        "english": "Fair Value",
        "aliases": "fair value nyaya mulya",
        "definition": "Price received to sell asset or paid to transfer liability in orderly transaction.",
        "nepali": "Nyaya mulya = asset bechda athawa dayitwo transfer garda prapta/haruine mulya.",
    },
    "accrual": {
        "english": "Accrual Basis",
        "aliases": "accrual prapti aadhar",
        "definition": "Transactions recorded when they occur, not only when cash moves.",
        "nepali": "Prapti aadhar = ghatna vayeko bela nai record; cash auna pardaina.",
    },
    "provision": {
        "english": "Provision",
        "aliases": "provision reserve",
        "definition": "Liability of uncertain timing or amount (IAS 37).",
        "nepali": "Provision = samay athawa rakam anishchit dayitwo (bad debt, warranty, etc.).",
    },
    "goodwill": {
        "english": "Goodwill",
        "aliases": "goodwill",
        "definition": "Intangible asset from business combination; excess of consideration over net assets.",
        "nepali": "Goodwill = business combination ma net asset bhanda badhi tirne rakam.",
    },
}


def _term_in_query(alias: str, q: str) -> bool:
    """Match alias as whole word/phrase to avoid kharcha matching prepaid kharcha."""
    alias = alias.strip().lower()
    if not alias:
        return False
    if " " in alias:
        return alias in q
    return bool(re.search(rf"\b{re.escape(alias)}\b", q))


def lookup_glossary(query: str) -> list[tuple[str, dict[str, str]]]:
    """Match accounting terms in user query against glossary + COA aliases."""
    q = (query or "").lower()
    if not q:
        return []
    matches: list[tuple[str, dict[str, str]]] = []
    seen: set[str] = set()
    for term, defn in ACCOUNTING_GLOSSARY.items():
        aliases = [term] + (defn.get("aliases") or "").split()
        if any(_term_in_query(a, q) for a in aliases):
            matches.append((term, defn))
            seen.add(term)

    # COA universal account aliases (broader language understanding)
    try:
        from .chart_of_accounts_framework import lookup_account_terms

        for acct in lookup_account_terms(query, limit=4):
            key = acct["canonical"].lower().replace(" ", "_")[:40]
            if key in seen:
                continue
            # Skip COA noise when exact glossary term already matched
            if matches and any(_term_in_query(m[0], q) for m in matches):
                break
            seen.add(key)
            matches.append(
                (
                    acct["canonical"],
                    {
                        "english": acct["canonical"],
                        "definition": f"Category: {acct['category']}. Aliases: {acct.get('aliases', '')[:200]}",
                        "nepali": acct.get("nepali", ""),
                    },
                )
            )
    except Exception:
        pass

    return matches


def format_glossary_answer(query: str, *, prefer_nepali: bool = True) -> str:
    """Format CA-curated glossary answer for education/Q&A."""
    matches = lookup_glossary(query)
    if not matches:
        return ""
    parts: list[str] = []
    for term, defn in matches[:2]:
        en = defn.get("english", term.title())
        if prefer_nepali and defn.get("nepali"):
            body = defn["nepali"]
            parts.append(f"**{en}** ({term})\n{body}")
        else:
            body = defn.get("definition", "")
            parts.append(f"**{en}**\n{body}")
        if defn.get("ifrs_para"):
            parts.append(f"📘 IFRS {defn['ifrs_para']}")
    return "\n\n".join(parts)


def is_definition_question(text: str) -> bool:
    """True when user asks what a term means."""
    t = (text or "").lower()
    return bool(
        re.search(
            r"\b(k\s*ho|ke\s*ho|what\s+is|what\s+are|define|meaning|matlab|"
            r"artha|bujhau|samjha|explain|difference|compare)\b|\?",
            t,
            re.I,
        )
    )


# NLU intent → ENTRY_RULES key
KHATA_INTENT_TO_RULE_KEY: dict[str, str] = {
    "khata_credit_sale": "credit_sale",
    "khata_cash_sale": "cash_sale",
    "khata_payment_in": "payment_received",
    "khata_payment_out": "payment_made",
    "khata_purchase": "cash_purchase",
    "khata_credit_purchase": "credit_purchase",
    "khata_expense": "expense",
    "khata_salary_payment": "salary_payment",
    "khata_salary_accrual": "salary_accrual",
    "khata_ssf_employee": "ssf_employee",
    "khata_ssf_employer": "ssf_employer",
    "khata_gratuity_provision": "gratuity_provision",
    "khata_gratuity_payment": "gratuity_payment",
    "khata_vat_sales": "vat_sale",
    "khata_vat_purchase": "vat_purchase",
    "khata_vat_payment": "vat_payment",
    "khata_tds_deducted": "tds_deducted",
    "khata_tds_paid": "tds_paid",
    "khata_other_income": "interest_income",
    "khata_depreciation": "depreciation",
    "khata_bank_charges": "bank_charges",
    "khata_discount_allowed": "discount_allowed",
    "khata_discount_received": "discount_received",
    "khata_capital_introduced": "capital_introduced",
    "khata_drawings": "drawings",
    "khata_drawings_cash": "drawings_cash",
    "khata_drawings_goods": "drawings",
    "khata_loan_received": "loan_received",
    "khata_loan_repayment": "loan_repayment",
    "khata_stock_purchase": "stock_purchase",
    "khata_stock_sale_cogs": "stock_sale_cogs",
    "khata_contra_cash_bank": "contra",
    "khata_sales_return": "sales_return",
    "khata_purchase_return": "purchase_return",
    "khata_customer_advance": "customer_advance",
    "khata_employee_advance": "employee_advance",
    "khata_opening_balance": "opening_balance",
    "khata_asset_disposal": "asset_disposal",
    "khata_inventory_write_down": "stock_adjustment",
    "khata_commission_income": "commission_income",
    "khata_rent_expense": "rent_expense",
    "khata_bad_debt_writeoff": "bad_debt_writeoff",
    "khata_bad_debt_recovery": "bad_debt_recovery",
    "khata_provision_bad_debt": "provision",
    "khata_outstanding_expense": "accrued",
    "khata_prepaid_expense": "prepaid",
}

# ── Entry generation rules (35+ transaction types) ───────────────────────────

ENTRY_RULES: dict[str, EntryRule] = {
    "credit_sale": {
        "khata_intent": "khata_credit_sale",
        "description": "Sale of goods/services on credit (udhaar)",
        "debit": [("KH-DEBT", "amount", "Sundry Debtors increases")],
        "credit": [("KH-SALE", "amount", "Sales Revenue recognized")],
        "vat_variant": {
            "debit": [("KH-DEBT", "amount", "Total receivable incl. VAT")],
            "credit": [
                ("KH-SALE", "net_of_vat", "Net sales excl. VAT"),
                ("KH-VAT-OUT", "vat_portion", "13% Output VAT"),
            ],
        },
        "validation": ["amount > 0", "party recommended"],
        "nepali_explanation": "उधारो बिक्री: असुली बढ्छ (Dr), बिक्री आम्दानी बढ्छ (Cr)",
        "english_explanation": "Credit sale: Dr Sundry Debtors, Cr Sales Revenue",
        "tags": ["udhaar", "receivable", "bikri"],
    },
    "cash_sale": {
        "khata_intent": "khata_cash_sale",
        "description": "Cash sale (nagad bikri)",
        "debit": [("KH-CASH", "amount", "Cash increases")],
        "credit": [("KH-SALE", "amount", "Sales recognized")],
        "vat_variant": {
            "debit": [("KH-CASH", "amount", "Total cash received incl. VAT")],
            "credit": [
                ("KH-SALE", "net_of_vat", "Net sales excl. VAT"),
                ("KH-VAT-OUT", "vat_portion", "13% Output VAT"),
            ],
        },
        "validation": ["amount > 0"],
        "nepali_explanation": "नगद बिक्री: नगद बढ्छ (Dr), बिक्री आम्दानी (Cr)",
        "english_explanation": "Cash sale: Dr Cash, Cr Sales",
        "tags": ["nagad", "cash", "bikri"],
    },
    "payment_received": {
        "khata_intent": "khata_payment_in",
        "description": "Payment received from debtor",
        "debit": [("KH-CASH", "amount", "Cash received")],
        "credit": [("KH-DEBT", "amount", "Receivable reduced")],
        "validation": ["amount > 0"],
        "nepali_explanation": "भुक्तानी प्राप्ति: नगद बढ्छ (Dr), असुली घट्छ (Cr)",
        "english_explanation": "Payment in: Dr Cash, Cr Sundry Debtors",
        "tags": ["tiryo", "jama", "collection"],
    },
    "payment_made": {
        "khata_intent": "khata_payment_out",
        "description": "Payment made to creditor",
        "debit": [("KH-CRED", "amount", "Payable reduced")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "भुक्तानी: देयता घट्छ (Dr), नगद घट्छ (Cr)",
        "english_explanation": "Payment out: Dr Creditors, Cr Cash",
        "tags": ["payment", "creditor"],
    },
    "cash_purchase": {
        "khata_intent": "khata_purchase",
        "description": "Cash purchase of goods",
        "debit": [("KH-PUR", "amount", "Purchase expense")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "नगद खरिद: खरिद खर्च (Dr), नगद (Cr)",
        "english_explanation": "Cash purchase: Dr Purchases, Cr Cash",
        "tags": ["kharid", "kineko", "purchase"],
    },
    "credit_purchase": {
        "khata_intent": "khata_credit_purchase",
        "description": "Credit purchase (udhaar kharid)",
        "debit": [("KH-PUR", "amount", "Purchase/stock increases")],
        "credit": [("KH-CRED", "amount", "Creditor payable increases")],
        "validation": ["amount > 0"],
        "nepali_explanation": "उधारो खरिद: खरिद (Dr), देयता (Cr)",
        "english_explanation": "Credit purchase: Dr Purchases, Cr Creditors",
        "tags": ["udhaar", "kharid", "payable"],
    },
    "expense": {
        "khata_intent": "khata_expense",
        "description": "Operating expense paid in cash",
        "debit": [("KH-EXP", "amount", "Expense incurred")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "खर्च: खर्च खाता (Dr), नगद (Cr)",
        "english_explanation": "Expense: Dr Operating Expense, Cr Cash",
        "tags": ["kharcha", "expense", "bill"],
    },
    "rent_expense": {
        "khata_intent": "khata_rent_expense",
        "description": "Rent / bhaada expense",
        "debit": [("KH-EXP", "amount", "Rent expense")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "भाडा खर्च: खर्च (Dr), नगद (Cr)",
        "english_explanation": "Rent: Dr Expense, Cr Cash",
        "tags": ["bhada", "bhaada", "rent"],
    },
    "salary_accrual": {
        "khata_intent": "khata_salary_accrual",
        "description": "Salary accrued at month-end",
        "debit": [("KH-SAL", "amount", "Salary expense")],
        "credit": [("KH-SAL-PAY", "amount", "Salary payable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "तलब प्रावधान: तलब खर्च (Dr), तलब देय (Cr)",
        "english_explanation": "Salary accrual: Dr Salary Expense, Cr Salary Payable",
        "tags": ["talab", "accrual", "payroll"],
    },
    "salary_payment": {
        "khata_intent": "khata_salary_payment",
        "description": "Salary payment to employees",
        "debit": [("KH-SAL-PAY", "amount", "Clear salary payable")],
        "credit": [("KH-BANK", "amount", "Bank payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "तलब भुक्तानी: तलब देय (Dr), बैंक (Cr)",
        "english_explanation": "Salary payment: Dr Salary Payable, Cr Bank",
        "tags": ["talab", "salary", "payment"],
    },
    "salary": {
        "khata_intent": "khata_salary_payment",
        "description": "Alias for salary payment",
        "debit": [("KH-SAL-PAY", "amount", "Salary payable cleared")],
        "credit": [("KH-BANK", "amount", "Bank payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "तलब भुक्तानी",
        "english_explanation": "Salary payment",
        "tags": ["talab"],
    },
    "ssf_employee": {
        "khata_intent": "khata_ssf_employee",
        "description": "SSF employee 10% on basic salary",
        "debit": [("KH-SAL", "amount", "Gross salary expense")],
        "credit": [
            ("KH-SSF-EMP", "ssf_employee", "SSF employee 10%"),
            ("KH-SAL-PAY", "net_after_ssf_emp", "Net salary payable"),
        ],
        "validation": ["amount > 0"],
        "nepali_explanation": "कर्मचारी SSF १०% कटौती",
        "english_explanation": "SSF employee: Dr Salary, Cr SSF Payable + Net Payable",
        "tags": ["ssf", "employee", "10%"],
    },
    "ssf_employer": {
        "khata_intent": "khata_ssf_employer",
        "description": "SSF employer 11% contribution",
        "debit": [("KH-SSF-ER-EXP", "ssf_employer", "Employer SSF expense")],
        "credit": [("KH-SSF-ER", "ssf_employer", "SSF employer payable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "नियोक्ता SSF ११%",
        "english_explanation": "SSF employer: Dr SSF Expense, Cr SSF Payable",
        "tags": ["ssf", "employer", "11%"],
    },
    "gratuity_provision": {
        "khata_intent": "khata_gratuity_provision",
        "description": "Gratuity provision (Labour Act 2074)",
        "debit": [("KH-GRAT-EXP", "amount", "Gratuity expense")],
        "credit": [("KH-GRAT-PROV", "amount", "Gratuity provision")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ग्रेच्युटी प्रावधान",
        "english_explanation": "Gratuity provision: Dr Expense, Cr Provision",
        "tags": ["gratuity", "provision"],
    },
    "gratuity_payment": {
        "khata_intent": "khata_gratuity_payment",
        "description": "Gratuity paid on retirement",
        "debit": [("KH-GRAT-PROV", "amount", "Clear provision")],
        "credit": [("KH-BANK", "amount", "Bank payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ग्रेच्युटी भुक्तानी",
        "english_explanation": "Gratuity payment: Dr Provision, Cr Bank",
        "tags": ["gratuity", "payment"],
    },
    "vat_sale": {
        "khata_intent": "khata_vat_sales",
        "description": "VAT-inclusive credit sale (13%)",
        "debit": [("KH-DEBT", "amount", "Gross receivable")],
        "credit": [
            ("KH-SALE", "net_of_vat", "Net sales"),
            ("KH-VAT-OUT", "vat_portion", "Output VAT 13%"),
        ],
        "validation": ["amount > 0"],
        "nepali_explanation": "भ्याट सहित बिक्री: असुली (Dr), बिक्री + भ्याट देय (Cr)",
        "english_explanation": "VAT sale: Dr Debtors, Cr Sales + Output VAT",
        "tags": ["vat", "bikri", "13%"],
    },
    "vat_purchase": {
        "khata_intent": "khata_vat_purchase",
        "description": "VAT-inclusive purchase with input credit",
        "debit": [
            ("KH-PUR", "net_of_vat", "Net purchase"),
            ("KH-VAT-IN", "vat_portion", "Input VAT credit"),
        ],
        "credit": [("KH-CASH", "amount", "Gross payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "भ्याट सहित खरिद: खरिद + इनपुट भ्याट (Dr), नगद (Cr)",
        "english_explanation": "VAT purchase: Dr Purchase + Input VAT, Cr Cash",
        "tags": ["vat", "kharid", "input"],
    },
    "vat_payment": {
        "khata_intent": "khata_vat_payment",
        "description": "VAT remittance to IRD",
        "debit": [("KH-VAT-OUT", "amount", "Clear VAT payable")],
        "credit": [("KH-BANK", "amount", "Bank payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "भ्याट जम्मा IRD लाई",
        "english_explanation": "VAT payment: Dr Output VAT, Cr Bank",
        "tags": ["vat", "ird", "payment"],
    },
    "tds_deducted": {
        "khata_intent": "khata_tds_deducted",
        "description": "TDS deducted on payment (default 15%)",
        "debit": [("KH-EXP", "amount", "Gross expense")],
        "credit": [
            ("KH-TDS-PAY", "tds_amount", "TDS payable"),
            ("KH-BANK", "net_after_tds", "Net bank payment"),
        ],
        "validation": ["amount > 0"],
        "nepali_explanation": "TDS कटौती: खर्च (Dr), TDS देय + बैंक (Cr)",
        "english_explanation": "TDS deducted: Dr Expense, Cr TDS Payable + Bank",
        "tags": ["tds", "withholding"],
    },
    "tds_paid": {
        "khata_intent": "khata_tds_paid",
        "description": "TDS remittance to IRD",
        "debit": [("KH-TDS-PAY", "amount", "Clear TDS payable")],
        "credit": [("KH-BANK", "amount", "Bank remittance")],
        "validation": ["amount > 0"],
        "nepali_explanation": "TDS जम्मा",
        "english_explanation": "TDS paid: Dr TDS Payable, Cr Bank",
        "tags": ["tds", "ird"],
    },
    "bad_debt_writeoff": {
        "khata_intent": "khata_bad_debt_writeoff",
        "description": "Bad debt write-off",
        "debit": [("KH-BD-EXP", "amount", "Bad debt expense")],
        "credit": [("KH-DEBT", "amount", "Remove receivable")],
        "validation": ["amount > 0", "party recommended"],
        "nepali_explanation": "खराब असुली रद्द",
        "english_explanation": "Write-off: Dr Bad Debts, Cr Debtors",
        "tags": ["bad_debt", "writeoff"],
    },
    "bad_debt_recovery": {
        "khata_intent": "khata_bad_debt_recovery",
        "description": "Recovery of written-off debt",
        "debit": [("KH-CASH", "amount", "Cash received")],
        "credit": [("KH-BD-REC", "amount", "Bad debt recovered income")],
        "validation": ["amount > 0"],
        "nepali_explanation": "खराब असुली पुनः प्राप्ति",
        "english_explanation": "Recovery: Dr Cash, Cr Bad Debts Recovered",
        "tags": ["recovery", "bad_debt"],
    },
    "provision": {
        "khata_intent": "khata_provision_bad_debt",
        "description": "Provision for doubtful debts",
        "debit": [("KH-BD-EXP", "amount", "Provision expense")],
        "credit": [("KH-BD-PROV", "amount", "Bad debt provision")],
        "validation": ["amount > 0"],
        "nepali_explanation": "खराब असुली प्रावधान",
        "english_explanation": "Provision: Dr Bad Debt Expense, Cr Provision",
        "tags": ["provision", "doubtful"],
    },
    "depreciation": {
        "khata_intent": "khata_depreciation",
        "description": "Depreciation charge",
        "debit": [("KH-DEPR", "amount", "Depreciation expense")],
        "credit": [("KH-ACC-DEP", "amount", "Accumulated depreciation")],
        "validation": ["amount > 0"],
        "nepali_explanation": "मूल्यह्रास खर्च",
        "english_explanation": "Depreciation: Dr Expense, Cr Acc. Depreciation",
        "tags": ["depreciation", "fixed_asset"],
    },
    "bank_charges": {
        "khata_intent": "khata_bank_charges",
        "description": "Bank charges and fees",
        "debit": [("KH-BANK-CHG", "amount", "Bank charges")],
        "credit": [("KH-BANK", "amount", "Bank reduced")],
        "validation": ["amount > 0"],
        "nepali_explanation": "बैंक शुल्क",
        "english_explanation": "Bank charges: Dr Expense, Cr Bank",
        "tags": ["bank", "fee"],
    },
    "discount_allowed": {
        "khata_intent": "khata_discount_allowed",
        "description": "Discount allowed to customer",
        "debit": [("KH-DISC-ALL", "amount", "Discount expense")],
        "credit": [("KH-DEBT", "amount", "Reduce receivable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "छुट दिइयो ग्राहकलाई",
        "english_explanation": "Discount allowed: Dr Discount, Cr Debtors",
        "tags": ["discount", "chhut"],
    },
    "discount_received": {
        "khata_intent": "khata_discount_received",
        "description": "Discount received from supplier",
        "debit": [("KH-CRED", "amount", "Reduce payable")],
        "credit": [("KH-DISC-REC", "amount", "Discount income")],
        "validation": ["amount > 0"],
        "nepali_explanation": "छुट पाइयो",
        "english_explanation": "Discount received: Dr Creditors, Cr Discount Income",
        "tags": ["discount"],
    },
    "interest_income": {
        "khata_intent": "khata_other_income",
        "description": "Interest or other income received",
        "debit": [("KH-BANK", "amount", "Bank received")],
        "credit": [("KH-INT-INC", "amount", "Interest income")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ब्याज आम्दानी",
        "english_explanation": "Interest income: Dr Bank, Cr Interest Income",
        "tags": ["byaj", "interest"],
    },
    "interest_expense": {
        "khata_intent": "khata_expense",
        "description": "Interest expense paid",
        "debit": [("KH-INT-EXP", "amount", "Interest expense")],
        "credit": [("KH-BANK", "amount", "Bank paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ब्याज खर्च",
        "english_explanation": "Interest expense: Dr Interest Exp, Cr Bank",
        "tags": ["byaj", "interest"],
    },
    "prepaid": {
        "khata_intent": "khata_prepaid_expense",
        "description": "Prepaid expense (advance payment)",
        "debit": [("KH-PREPAID", "amount", "Prepaid asset")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "अग्रिम खर्च",
        "english_explanation": "Prepaid: Dr Prepaid Asset, Cr Cash",
        "tags": ["prepaid", "advance"],
    },
    "accrued": {
        "khata_intent": "khata_outstanding_expense",
        "description": "Accrued / outstanding expense",
        "debit": [("KH-EXP", "amount", "Expense incurred")],
        "credit": [("KH-OUT-EXP", "amount", "Outstanding liability")],
        "validation": ["amount > 0"],
        "nepali_explanation": "बाँकी खर्च (देय)",
        "english_explanation": "Accrued expense: Dr Expense, Cr Outstanding Expenses",
        "tags": ["accrual", "outstanding"],
    },
    "capital_introduced": {
        "khata_intent": "khata_capital_introduced",
        "description": "Owner capital introduced",
        "debit": [("KH-BANK", "amount", "Bank increases")],
        "credit": [("KH-CAP", "amount", "Capital increases")],
        "validation": ["amount > 0"],
        "nepali_explanation": "पुँजी थप",
        "english_explanation": "Capital: Dr Bank, Cr Capital",
        "tags": ["capital", "investment"],
    },
    "drawings": {
        "khata_intent": "khata_drawings",
        "description": "Owner drawings / withdrawal (cash or goods)",
        "debit": [("KH-DRAW", "amount", "Drawings increase")],
        "credit": [("KH-STOCK", "amount", "Stock withdrawn for personal use")],
        "validation": ["amount > 0"],
        "nepali_explanation": "निकासा — मालिकले व्यक्तिगत प्रयोगको लागि सामान/नगद लियो",
        "english_explanation": "Drawings: Dr Drawings, Cr Stock (owner took goods for personal use)",
        "tags": ["drawings", "nikasne", "consume", "personal"],
    },
    "drawings_cash": {
        "khata_intent": "khata_drawings_cash",
        "description": "Owner withdrew cash for personal use",
        "debit": [("KH-DRAW", "amount", "Drawings increase")],
        "credit": [("KH-CASH", "amount", "Cash withdrawn")],
        "validation": ["amount > 0"],
        "nepali_explanation": "नगद निकासा",
        "english_explanation": "Drawings (cash): Dr Drawings, Cr Cash",
        "tags": ["drawings", "cash", "nikasne"],
    },
    "loan_received": {
        "khata_intent": "khata_loan_received",
        "description": "Loan received from bank/lender",
        "debit": [("KH-BANK", "amount", "Bank increases")],
        "credit": [("KH-LOAN", "amount", "Loan liability")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ऋण प्राप्त",
        "english_explanation": "Loan received: Dr Bank, Cr Loan Payable",
        "tags": ["loan", "rin"],
    },
    "loan_repayment": {
        "khata_intent": "khata_loan_repayment",
        "description": "Loan principal repayment",
        "debit": [("KH-LOAN", "amount", "Reduce loan")],
        "credit": [("KH-BANK", "amount", "Bank payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ऋण फिर्ता",
        "english_explanation": "Loan repayment: Dr Loan, Cr Bank",
        "tags": ["loan", "repayment"],
    },
    "stock_purchase": {
        "khata_intent": "khata_stock_purchase",
        "description": "Inventory/stock purchase",
        "debit": [("KH-STOCK", "amount", "Stock increases")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "सामान खरिद — स्टक बढ्यो",
        "english_explanation": "Stock purchase: Dr Stock, Cr Cash",
        "tags": ["stock", "inventory", "saman"],
    },
    "stock_sale_cogs": {
        "khata_intent": "khata_stock_sale_cogs",
        "description": "Cost of goods sold",
        "debit": [("KH-PUR", "amount", "COGS expense")],
        "credit": [("KH-STOCK", "amount", "Stock reduced")],
        "validation": ["amount > 0"],
        "nepali_explanation": "बिक्रीको लागत",
        "english_explanation": "COGS: Dr Purchases/COGS, Cr Stock",
        "tags": ["cogs", "stock"],
    },
    "stock_adjustment": {
        "khata_intent": "khata_inventory_write_down",
        "description": "Inventory write-down / shrinkage",
        "debit": [("KH-EXP", "amount", "Loss on stock")],
        "credit": [("KH-STOCK", "amount", "Stock reduced")],
        "validation": ["amount > 0"],
        "nepali_explanation": "स्टक समायोजन / घाट",
        "english_explanation": "Stock adjustment: Dr Expense, Cr Stock",
        "tags": ["shrinkage", "write_down"],
    },
    "contra": {
        "khata_intent": "khata_contra_cash_bank",
        "description": "Cash deposited to bank (contra)",
        "debit": [("KH-BANK", "amount", "Bank increases")],
        "credit": [("KH-CASH", "amount", "Cash decreases")],
        "validation": ["amount > 0"],
        "nepali_explanation": "नगद बैंकमा जम्मा",
        "english_explanation": "Contra: Dr Bank, Cr Cash",
        "tags": ["contra", "deposit"],
    },
    "sales_return": {
        "khata_intent": "khata_sales_return",
        "description": "Sales return / credit note",
        "debit": [("KH-SALE", "amount", "Reverse sales")],
        "credit": [("KH-DEBT", "amount", "Reduce receivable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "बिक्री फिर्ता",
        "english_explanation": "Sales return: Dr Sales, Cr Debtors",
        "tags": ["return", "firta"],
    },
    "purchase_return": {
        "khata_intent": "khata_purchase_return",
        "description": "Purchase return / debit note",
        "debit": [("KH-CRED", "amount", "Reduce payable")],
        "credit": [("KH-PUR", "amount", "Reverse purchase")],
        "validation": ["amount > 0"],
        "nepali_explanation": "खरिद फिर्ता",
        "english_explanation": "Purchase return: Dr Creditors, Cr Purchases",
        "tags": ["return", "debit_note"],
    },
    "customer_advance": {
        "khata_intent": "khata_customer_advance",
        "description": "Advance received from customer",
        "debit": [("KH-CASH", "amount", "Cash received")],
        "credit": [("KH-CUST-ADV", "amount", "Unearned revenue liability")],
        "validation": ["amount > 0"],
        "nepali_explanation": "ग्राहकबाट अग्रिम",
        "english_explanation": "Customer advance: Dr Cash, Cr Customer Advance",
        "tags": ["advance", "customer"],
    },
    "employee_advance": {
        "khata_intent": "khata_employee_advance",
        "description": "Advance paid to employee",
        "debit": [("KH-EMP-ADV", "amount", "Recoverable advance")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "कर्मचारीलाई अग्रिम",
        "english_explanation": "Employee advance: Dr Employee Advance, Cr Cash",
        "tags": ["advance", "employee"],
    },
    "opening_balance": {
        "khata_intent": "khata_opening_balance",
        "description": "Opening balance entry",
        "debit": [("KH-CASH", "amount", "Opening cash")],
        "credit": [("KH-CAP", "amount", "Opening capital")],
        "validation": ["amount > 0"],
        "nepali_explanation": "सुरुवाती खाता",
        "english_explanation": "Opening: Dr Cash, Cr Capital",
        "tags": ["opening", "suruwati"],
    },
    "asset_disposal": {
        "khata_intent": "khata_asset_disposal",
        "description": "Fixed asset disposal (simplified — proceeds vs book)",
        "debit": [("KH-CASH", "amount", "Proceeds received")],
        "credit": [("KH-PPE", "amount", "Remove asset at book value")],
        "validation": ["amount > 0"],
        "nepali_explanation": "सम्पत्ति बिक्री / निस्कासन",
        "english_explanation": "Asset disposal: Dr Cash, Cr PPE (simplified)",
        "tags": ["disposal", "asset"],
    },
    "commission_income": {
        "khata_intent": "khata_commission_income",
        "description": "Commission income received",
        "debit": [("KH-CASH", "amount", "Cash received")],
        "credit": [("KH-OTH-INC", "amount", "Commission income")],
        "validation": ["amount > 0"],
        "nepali_explanation": "कमिसन आम्दानी",
        "english_explanation": "Commission: Dr Cash, Cr Other Income",
        "tags": ["commission"],
    },
    "partial_payment_received": {
        "khata_intent": "khata_payment_in",
        "description": "Partial payment from debtor",
        "debit": [("KH-CASH", "amount", "Partial receipt")],
        "credit": [("KH-DEBT", "amount", "Reduce receivable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "आंशिक भुक्तानी प्राप्त",
        "english_explanation": "Partial receipt: Dr Cash, Cr Debtors",
        "tags": ["partial", "receipt"],
    },
    "partial_payment_made": {
        "khata_intent": "khata_payment_out",
        "description": "Partial payment to creditor",
        "debit": [("KH-CRED", "amount", "Reduce payable")],
        "credit": [("KH-CASH", "amount", "Partial payment")],
        "validation": ["amount > 0"],
        "nepali_explanation": "आंशिक भुक्तानी गरिएको",
        "english_explanation": "Partial payment: Dr Creditors, Cr Cash",
        "tags": ["partial", "payment"],
    },
    "credit_note": {
        "khata_intent": "khata_sales_return",
        "description": "Credit note / sales return",
        "debit": [("KH-SALE", "amount", "Reverse sales")],
        "credit": [("KH-DEBT", "amount", "Reduce debtor")],
        "validation": ["amount > 0"],
        "nepali_explanation": "क्रेडिट नोट / बिक्री फिर्ता",
        "english_explanation": "Credit note: Dr Sales, Cr Debtors",
        "tags": ["return", "credit_note"],
    },
    "debit_note": {
        "khata_intent": "khata_purchase_return",
        "description": "Debit note / purchase return",
        "debit": [("KH-CRED", "amount", "Reduce creditor")],
        "credit": [("KH-PUR", "amount", "Reverse purchase")],
        "validation": ["amount > 0"],
        "nepali_explanation": "डेबिट नोट / खरिद फिर्ता",
        "english_explanation": "Debit note: Dr Creditors, Cr Purchases",
        "tags": ["return", "debit_note"],
    },
    "forex_gain": {
        "khata_intent": "khata_other_income",
        "description": "Foreign exchange gain",
        "debit": [("KH-BANK", "amount", "Bank increased")],
        "credit": [("KH-OTH-INC", "amount", "FX gain")],
        "validation": ["amount > 0"],
        "nepali_explanation": "विदेशी मुद्रा लाभ",
        "english_explanation": "FX gain: Dr Bank, Cr Other Income",
        "tags": ["forex", "gain"],
    },
    "forex_loss": {
        "khata_intent": "khata_expense",
        "description": "Foreign exchange loss",
        "debit": [("KH-EXP", "amount", "FX loss expense")],
        "credit": [("KH-BANK", "amount", "Bank reduced")],
        "validation": ["amount > 0"],
        "nepali_explanation": "विदेशी मुद्रा घाटा",
        "english_explanation": "FX loss: Dr Expense, Cr Bank",
        "tags": ["forex", "loss"],
    },
    "petty_cash_replenish": {
        "khata_intent": "khata_contra",
        "description": "Replenish petty cash from bank",
        "debit": [("KH-CASH", "amount", "Petty cash")],
        "credit": [("KH-BANK", "amount", "Bank transfer")],
        "validation": ["amount > 0"],
        "nepali_explanation": "पेटी क्यास भर्ना",
        "english_explanation": "Petty cash: Dr Cash, Cr Bank",
        "tags": ["petty_cash", "contra"],
    },
    "bonus_accrual": {
        "khata_intent": "khata_salary_accrual",
        "description": "Bonus accrual",
        "debit": [("KH-SAL", "amount", "Bonus expense")],
        "credit": [("KH-SAL-PAY", "amount", "Bonus payable")],
        "validation": ["amount > 0"],
        "nepali_explanation": "बोनस प्रावधान",
        "english_explanation": "Bonus accrual: Dr Salary, Cr Salary Payable",
        "tags": ["bonus", "payroll"],
    },
    "insurance_prepaid": {
        "khata_intent": "khata_prepaid_expense",
        "description": "Prepaid insurance",
        "debit": [("KH-PREPAID", "amount", "Prepaid insurance")],
        "credit": [("KH-CASH", "amount", "Cash paid")],
        "validation": ["amount > 0"],
        "nepali_explanation": "पूर्वभुक्तानी बीमा",
        "english_explanation": "Prepaid insurance: Dr Prepaid, Cr Cash",
        "tags": ["prepaid", "insurance"],
    },
}


# ── Amount expression resolver (no eval — safe whitelist) ───────────────────

def vat_split(gross: float, rate: float | None = None) -> tuple[float, float]:
    """Split gross VAT-inclusive amount into net and VAT."""
    r = rate if rate is not None else NEPAL_TAX_RATES["vat"]["standard_rate"]
    net = round(gross / (1 + r), 2)
    vat = round(gross - net, 2)
    return net, vat


def _resolve_amount(
    expr: str,
    amount: float,
    *,
    secondary_amount: float | None = None,
    tds_rate: float | None = None,
) -> float:
    """Resolve whitelisted amount expressions for journal lines."""
    ssf_emp_rate = NEPAL_TAX_RATES["ssf"]["employee_contribution"]
    ssf_er_rate = NEPAL_TAX_RATES["ssf"]["employer_contribution"]
    default_tds = tds_rate if tds_rate is not None else NEPAL_TAX_RATES["tds"]["default"]
    net, vat = vat_split(amount)

    mapping: dict[str, float] = {
        "amount": amount,
        "net_of_vat": net,
        "vat_portion": vat,
        "ssf_employee": round(amount * ssf_emp_rate, 2),
        "ssf_employer": round(amount * ssf_er_rate, 2),
        "net_after_ssf_emp": round(amount * (1 - ssf_emp_rate), 2),
        "tds_amount": secondary_amount if secondary_amount is not None else round(amount * default_tds, 2),
        "net_after_tds": round(
            amount - (secondary_amount if secondary_amount is not None else round(amount * default_tds, 2)),
            2,
        ),
        "secondary_amount": secondary_amount or 0.0,
    }
    if expr not in mapping:
        raise ValueError(f"Unsupported amount expression: {expr}")
    return mapping[expr]


def resolve_rule_key(intent: str) -> str | None:
    """Resolve NLU intent, khata_intent, or rule key to ENTRY_RULES key."""
    if intent in ENTRY_RULES:
        return intent
    if intent in KHATA_INTENT_TO_RULE_KEY:
        return KHATA_INTENT_TO_RULE_KEY[intent]
    return None


def get_account(key: str) -> AccountDef | None:
    """Look up account by KH-* code."""
    return CHART_OF_ACCOUNTS.get(key)


def get_entry_rule(intent: str) -> EntryRule | None:
    """Get entry rule by NLU or khata intent."""
    key = resolve_rule_key(intent)
    if not key:
        return None
    return ENTRY_RULES.get(key)


def lookup_tds_rate(category: str) -> float:
    """Look up TDS rate by payment category."""
    rates = NEPAL_TAX_RATES["tds"]
    return float(rates.get(category, rates["default"]))


def search_accounts(query: str, limit: int = 10) -> list[tuple[str, AccountDef]]:
    """Simple text search over account names and codes."""
    q = query.lower().strip()
    if not q:
        return []
    results: list[tuple[str, AccountDef]] = []
    for key, acct in CHART_OF_ACCOUNTS.items():
        hay = f"{key} {acct.get('name', '')} {acct.get('code', '')}".lower()
        if q in hay:
            results.append((key, acct))
    return results[:limit]


def build_journal_lines(
    intent: str,
    amount: float,
    *,
    vat_inclusive: bool = False,
    secondary_amount: float | None = None,
    tds_rate: float | None = None,
) -> list[dict[str, Any]]:
    """
    Build balanced journal lines from ENTRY_RULES.

    Returns list of dicts: account, account_name, debit, credit, description.
    """
    rule_key = resolve_rule_key(intent)
    if not rule_key:
        raise ValueError(f"No entry rule for intent: {intent}")

    rule = ENTRY_RULES[rule_key]
    template = rule

    if vat_inclusive and "vat_variant" in rule:
        template = {**rule, **rule["vat_variant"]}  # type: ignore[typeddict-item]

    # VAT sale/purchase rules are always gross-split
    if rule_key in ("vat_sale", "vat_purchase"):
        pass  # use default debit/credit with net_of_vat expressions
    elif vat_inclusive and rule_key in ("credit_sale", "cash_sale") and "vat_variant" in rule:
        template = {**rule, **rule["vat_variant"]}  # type: ignore[typeddict-item]

    lines: list[dict[str, Any]] = []

    for account_key, amount_expr, desc in template.get("debit", []):
        val = _resolve_amount(
            amount_expr, amount, secondary_amount=secondary_amount, tds_rate=tds_rate
        )
        acct = CHART_OF_ACCOUNTS.get(account_key, {})
        lines.append(
            {
                "account": account_key,
                "accountCode": account_key,
                "accountName": acct.get("name", account_key),
                "debit": round(val, 2),
                "credit": 0.0,
                "description": desc,
            }
        )

    for account_key, amount_expr, desc in template.get("credit", []):
        val = _resolve_amount(
            amount_expr, amount, secondary_amount=secondary_amount, tds_rate=tds_rate
        )
        acct = CHART_OF_ACCOUNTS.get(account_key, {})
        lines.append(
            {
                "account": account_key,
                "accountCode": account_key,
                "accountName": acct.get("name", account_key),
                "debit": 0.0,
                "credit": round(val, 2),
                "description": desc,
            }
        )

    total_dr = sum(l["debit"] for l in lines)
    total_cr = sum(l["credit"] for l in lines)
    if abs(total_dr - total_cr) >= 0.02:
        raise ValueError(f"Unbalanced entry for {intent}: Dr={total_dr} Cr={total_cr}")

    return lines


def format_kb_snippet(
    intent: str | None = None,
    query: str | None = None,
    *,
    max_chars: int = 2000,
) -> str:
    """Format knowledge base context for LLM prompts (Layer 2 RAG helper)."""
    parts: list[str] = []

    if intent:
        rule = get_entry_rule(intent)
        if rule:
            parts.append(f"[ENTRY RULE: {intent}]")
            parts.append(rule.get("description", ""))
            parts.append(rule.get("english_explanation", ""))
            if rule.get("nepali_explanation"):
                parts.append(f"Nepali: {rule['nepali_explanation']}")

    if query:
        q = query.lower()
        for term, defn in lookup_glossary(query):
            parts.append(f"[GLOSSARY: {term}]")
            parts.append(defn.get("definition", ""))
            if defn.get("nepali"):
                parts.append(defn["nepali"])
            if defn.get("ifrs_para"):
                parts.append(defn["ifrs_para"])

        # Chart of Accounts framework — sector, aliases, reclassification
        try:
            from .chart_of_accounts_framework import format_coa_context

            coa_ctx = format_coa_context(query, max_chars=1200)
            if coa_ctx:
                parts.append("[CHART OF ACCOUNTS FRAMEWORK]")
                parts.append(coa_ctx)
        except Exception:
            pass

        if any(w in q for w in ("vat", "भ्याट", "13%")):
            vat = NEPAL_TAX_RATES["vat"]
            parts.append(
                f"[VAT] Standard rate {vat['standard_rate']*100:.0f}%, "
                f"registration threshold NPR {vat['threshold']:,}, filing {vat['filing']}"
            )
        if any(w in q for w in ("tds", "withhold", "कटौती")):
            parts.append(f"[TDS RATES] {NEPAL_TAX_RATES['tds']}")
        if any(w in q for w in ("ssf", "social security")):
            ssf = NEPAL_TAX_RATES["ssf"]
            parts.append(
                f"[SSF] Employee {ssf['employee_contribution']*100:.0f}% + "
                f"Employer {ssf['employer_contribution']*100:.0f}% on basic"
            )
        if any(w in q for w in ("tax", "income", "कर")):
            parts.append(f"[INCOME TAX] Company rate {NEPAL_TAX_RATES['income_tax']['company_general']*100:.0f}%")

        accounts = search_accounts(query, limit=5)
        if accounts:
            parts.append("[ACCOUNTS]")
            for key, acct in accounts:
                parts.append(f"  {key}: {acct.get('name')} ({acct.get('type')})")

        try:
            from .knowledge_registry import format_tiered_context

            task = "journal_entry" if intent else "accounting_qa"
            tiered = format_tiered_context(query, task=task, max_chars=1200)
            if tiered:
                parts.append(tiered)
        except Exception:
            pass

    text = "\n".join(parts)
    if len(text) > max_chars:
        return text[: max_chars - 3] + "..."
    return text


def calculate_income_tax_individual(annual_income: float) -> dict[str, Any]:
    """Walk Nepal individual income tax slabs (Income Tax Act 2058)."""
    slabs = NEPAL_TAX_RATES["income_tax"]["individual_slabs"]
    remaining = annual_income
    tax = 0.0
    breakdown: list[dict[str, float]] = []
    for band, rate in slabs:
        if remaining <= 0:
            break
        taxable = min(remaining, band) if band != math.inf else remaining
        band_tax = round(taxable * rate, 2)
        tax += band_tax
        breakdown.append({"band_upto": band, "rate": rate, "taxable": taxable, "tax": band_tax})
        remaining -= taxable
    return {
        "annual_income": annual_income,
        "total_tax": round(tax, 2),
        "effective_rate": round(tax / annual_income, 4) if annual_income > 0 else 0,
        "breakdown": breakdown,
    }
