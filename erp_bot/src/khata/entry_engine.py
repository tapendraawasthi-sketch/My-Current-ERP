"""Phase 4 — Khata Entry Engine: LLM-based extraction with deterministic validation.

This module replaces brittle regex-only parsing with:
1. LLM-based extraction (party, amount, direction, entry type) → strict JSON
2. Code-based validation (double-entry MUST balance)
3. Natural-language confirmation card generation
4. Deterministic regex fast-path for common patterns

Architecture:
  User message → Regex fast-path (optional) → LLM extraction → Validation → Confirmation card

The regex is a FAST-PATH optimization, never the sole decision-maker for ambiguous inputs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import FAST_MODEL, FAST_MODEL_OPTIONS, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# TRANSACTION TYPES
# ══════════════════════════════════════════════════════════════════════════════

class TransactionType(str, Enum):
    """Supported transaction types for khata entries."""
    
    # Sales
    CREDIT_SALE = "credit_sale"           # Udhaar bikri (credit sale)
    CASH_SALE = "cash_sale"               # Nagar bikri (cash sale)
    SALES_RETURN = "sales_return"         # Bikri phirta
    
    # Purchases
    CREDIT_PURCHASE = "credit_purchase"   # Udhaar kharid (credit purchase)
    CASH_PURCHASE = "cash_purchase"       # Nagar kharid (cash purchase)
    PURCHASE_RETURN = "purchase_return"   # Kharid phirta
    
    # Receipts & Payments
    RECEIPT = "receipt"                   # Paisa payo / liye (received money)
    PAYMENT = "payment"                   # Paisa diye / tireko (paid money)
    
    # Expenses
    EXPENSE = "expense"                   # Kharcha
    RENT = "rent"                         # Bhaada
    SALARY = "salary"                     # Talab
    
    # Tax & Statutory
    VAT_COLLECTED = "vat_collected"       # VAT on sales
    VAT_PAID = "vat_paid"                 # VAT on purchases
    TDS_DEDUCTED = "tds_deducted"         # TDS deducted from payment
    SSF_CONTRIBUTION = "ssf_contribution" # SSF deposit
    
    # Capital & Loans
    CAPITAL = "capital"                   # Punji lagani
    DRAWINGS = "drawings"                 # Owner withdraw
    LOAN_RECEIVED = "loan_received"       # Rin leko
    LOAN_PAYMENT = "loan_payment"         # Rin tireko
    
    # Others
    DISCOUNT_ALLOWED = "discount_allowed"
    DISCOUNT_RECEIVED = "discount_received"
    CONTRA = "contra"                     # Cash to bank or vice versa
    OTHER = "other"


# ══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class JournalLine:
    """A single line in a journal entry."""
    
    account_code: str
    account_name: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    
    def to_dict(self) -> dict:
        return {
            "accountCode": self.account_code,
            "accountName": self.account_name,
            "debit": float(self.debit),
            "credit": float(self.credit),
        }


@dataclass
class ParsedTransaction:
    """Extracted transaction data from user input."""
    
    transaction_type: TransactionType
    amount: Decimal
    party: str | None = None
    item: str | None = None
    narration: str = ""
    date: str = field(default_factory=lambda: date.today().isoformat())
    journal_lines: list[JournalLine] = field(default_factory=list)
    confidence: float = 0.0
    method: str = "llm"  # "regex" | "llm"
    raw_text: str = ""
    
    @property
    def is_valid(self) -> bool:
        """Check if the transaction is valid and can be posted."""
        return (
            self.amount > 0
            and self.journal_lines
            and self.is_balanced
        )
    
    @property
    def is_balanced(self) -> bool:
        """Check if journal entry balances (Dr = Cr)."""
        if not self.journal_lines:
            return False
        total_dr = sum(line.debit for line in self.journal_lines)
        total_cr = sum(line.credit for line in self.journal_lines)
        # Allow tiny rounding difference
        return abs(total_dr - total_cr) < Decimal("0.01")
    
    def to_card(self) -> dict[str, Any]:
        """Convert to confirmation card format."""
        return {
            "intent": f"khata_{self.transaction_type.value}",
            "party": self.party,
            "amount": int(self.amount),
            "item": self.item,
            "date": self.date,
            "raw_text": self.raw_text,
            "journalLines": [line.to_dict() for line in self.journal_lines],
            "narration": self.narration,
            "confidence": self.confidence,
            "method": self.method,
        }


@dataclass
class ParseResult:
    """Result of parsing a khata message."""
    
    success: bool
    transaction: ParsedTransaction | None = None
    clarification_needed: str | None = None
    error: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════════════════════

ACCOUNT_CODES = {
    "cash": ("KH-CASH", "Cash"),
    "bank": ("KH-BANK", "Bank"),
    "receivable": ("KH-DEBT", "Accounts Receivable"),
    "payable": ("KH-CRED", "Accounts Payable"),
    "sales": ("KH-SALE", "Sales Revenue"),
    "purchases": ("KH-PUR", "Purchases"),
    "expense": ("KH-EXP", "Expenses"),
    "stock": ("KH-STOCK", "Stock/Inventory"),
    "vat_payable": ("KH-VATP", "VAT Payable"),
    "vat_receivable": ("KH-VATR", "VAT Receivable"),
    "tds_payable": ("KH-TDSP", "TDS Payable"),
    "ssf_payable": ("KH-SSFP", "SSF Payable"),
    "salary": ("KH-SAL", "Salary Expense"),
    "rent": ("KH-RENT", "Rent Expense"),
    "capital": ("KH-CAP", "Owner's Capital"),
    "drawings": ("KH-DRAW", "Drawings"),
    "loan": ("KH-LOAN", "Loan"),
    "discount_allowed": ("KH-DISCA", "Discount Allowed"),
    "discount_received": ("KH-DISCR", "Discount Received"),
}


def get_account(key: str) -> tuple[str, str]:
    """Get account code and name."""
    return ACCOUNT_CODES.get(key, (f"KH-{key.upper()}", key.title()))


# ══════════════════════════════════════════════════════════════════════════════
# JOURNAL ENTRY BUILDER (Deterministic)
# ══════════════════════════════════════════════════════════════════════════════

def build_journal_entry(
    txn_type: TransactionType,
    amount: Decimal,
    party: str | None = None,
    vat_amount: Decimal | None = None,
    tds_amount: Decimal | None = None,
) -> list[JournalLine]:
    """Build balanced journal entry for a transaction type.
    
    This is the DETERMINISTIC part — ensures double-entry always balances.
    """
    lines: list[JournalLine] = []
    
    # Get account codes
    cash_code, cash_name = get_account("cash")
    bank_code, bank_name = get_account("bank")
    recv_code, recv_name = get_account("receivable")
    pay_code, pay_name = get_account("payable")
    sales_code, sales_name = get_account("sales")
    pur_code, pur_name = get_account("purchases")
    exp_code, exp_name = get_account("expense")
    
    party_recv = (f"KH-{party.upper()[:8]}", f"Receivable - {party}") if party else (recv_code, recv_name)
    party_pay = (f"KH-{party.upper()[:8]}", f"Payable - {party}") if party else (pay_code, pay_name)
    
    if txn_type == TransactionType.CREDIT_SALE:
        # DR: Receivable (Party)  CR: Sales
        lines.append(JournalLine(party_recv[0], party_recv[1], debit=amount))
        lines.append(JournalLine(sales_code, sales_name, credit=amount))
        
    elif txn_type == TransactionType.CASH_SALE:
        # DR: Cash  CR: Sales
        lines.append(JournalLine(cash_code, cash_name, debit=amount))
        lines.append(JournalLine(sales_code, sales_name, credit=amount))
        
    elif txn_type == TransactionType.CREDIT_PURCHASE:
        # DR: Purchases  CR: Payable (Party)
        lines.append(JournalLine(pur_code, pur_name, debit=amount))
        lines.append(JournalLine(party_pay[0], party_pay[1], credit=amount))
        
    elif txn_type == TransactionType.CASH_PURCHASE:
        # DR: Purchases  CR: Cash
        lines.append(JournalLine(pur_code, pur_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.RECEIPT:
        # DR: Cash/Bank  CR: Receivable (Party)
        lines.append(JournalLine(cash_code, cash_name, debit=amount))
        lines.append(JournalLine(party_recv[0], party_recv[1], credit=amount))
        
    elif txn_type == TransactionType.PAYMENT:
        # DR: Payable (Party)  CR: Cash/Bank
        lines.append(JournalLine(party_pay[0], party_pay[1], debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.EXPENSE:
        # DR: Expense  CR: Cash
        lines.append(JournalLine(exp_code, exp_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.SALARY:
        sal_code, sal_name = get_account("salary")
        lines.append(JournalLine(sal_code, sal_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.RENT:
        rent_code, rent_name = get_account("rent")
        lines.append(JournalLine(rent_code, rent_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.CAPITAL:
        cap_code, cap_name = get_account("capital")
        lines.append(JournalLine(cash_code, cash_name, debit=amount))
        lines.append(JournalLine(cap_code, cap_name, credit=amount))
        
    elif txn_type == TransactionType.DRAWINGS:
        draw_code, draw_name = get_account("drawings")
        lines.append(JournalLine(draw_code, draw_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    elif txn_type == TransactionType.CONTRA:
        # Cash to Bank or vice versa
        lines.append(JournalLine(bank_code, bank_name, debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
        
    else:
        # Generic: DR: Expense  CR: Cash (fallback)
        lines.append(JournalLine(exp_code, f"Expense - {txn_type.value}", debit=amount))
        lines.append(JournalLine(cash_code, cash_name, credit=amount))
    
    return lines


# ══════════════════════════════════════════════════════════════════════════════
# REGEX FAST-PATH (optimization, not sole decision)
# ══════════════════════════════════════════════════════════════════════════════

# Amount patterns
_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+)",
    re.IGNORECASE,
)

# Nepali number words
_NEPALI_NUMBERS = {
    "ek": 1, "dui": 2, "tin": 3, "char": 4, "panch": 5,
    "saya": 100, "hajar": 1000, "lakh": 100000,
}

# Credit sale patterns (Romanized + Devanagari)
_CREDIT_SALE_PATTERN = re.compile(
    r"(udhaar|udharo|udhar|उधारो?)\s*(bech|bikri|sale|बेच|बिक्री)",
    re.IGNORECASE,
)

# Cash sale patterns
_CASH_SALE_PATTERN = re.compile(
    r"(cash|nagar|नगद)\s*(bech|bikri|sale|बेच|बिक्री)",
    re.IGNORECASE,
)

# Receipt patterns (money received)
_RECEIPT_PATTERN = re.compile(
    r"(payo|liye|receive|पायो|लिए|भुक्तान\s*पायो)",
    re.IGNORECASE,
)

# Payment patterns (money paid)
_PAYMENT_PATTERN = re.compile(
    r"(diye|tire|paid|दिए|तिरे|भुक्तान\s*गरे)",
    re.IGNORECASE,
)

# Purchase patterns
_PURCHASE_PATTERN = re.compile(
    r"(kineko|kinyo|kharid|purchase|bought|किनेको|खरिद)",
    re.IGNORECASE,
)

# Generic sale patterns (English + Nepali)
_SALE_PATTERN = re.compile(
    r"\b(sold|becheko|beche|bech|bikri|sale|sales)\b",
    re.IGNORECASE,
)

# Party name extraction
_PARTY_PATTERN = re.compile(
    r"(?:bata|lai|sanga|from|to|बाट|लाई|सँग)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{1,30}?)(?:\s+(?:lai|bata|ko|को|लाई|बाट)|\s*\d|\s*$)",
    re.IGNORECASE,
)


def _extract_amount(text: str) -> Decimal | None:
    """Extract amount from text, handling Nepali number words and qty × rate."""
    rate_qty = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|unit|pcs|piece)\b.*?"
        r"(?:at|@|rate)\s*(?:rs\.?|npr|रु\.?|₹)?\s*(\d+(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    if rate_qty:
        qty = Decimal(rate_qty.group(1))
        rate = Decimal(rate_qty.group(2))
        total = (qty * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if total > 0:
            return total

    explicit_rs = re.findall(
        r"(?:rs\.?|npr|रु\.?|₹)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    if explicit_rs:
        try:
            return Decimal(explicit_rs[-1].replace(",", "")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        except Exception:
            pass

    # Try numeric pattern first
    match = _AMOUNT_PATTERN.search(text)
    if match:
        num_str = match.group(1).replace(",", "")
        try:
            return Decimal(num_str).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            pass
    
    # Try Nepali number words
    text_lower = text.lower()
    total = 0
    for word, value in _NEPALI_NUMBERS.items():
        if word in text_lower:
            # Check for multiplier before the word
            num_match = re.search(rf"(\d+)\s*{word}", text_lower)
            if num_match:
                total += int(num_match.group(1)) * value
            else:
                total += value
    
    return Decimal(total) if total > 0 else None


def _extract_party(text: str) -> str | None:
    """Extract party name from text."""
    match = _PARTY_PATTERN.search(text)
    if match:
        party = match.group(1).strip()
        # Clean up common suffixes
        party = re.sub(r"\s*(lai|bata|ko|को|लाई|बाट)$", "", party, flags=re.IGNORECASE)
        if len(party) > 1:
            return party.title()
    return None


def regex_fast_path(text: str) -> ParseResult | None:
    """Try to parse with regex for high-confidence patterns.
    
    Returns None if not confident enough (should use LLM).
    """
    text = text.strip()
    
    # Extract amount first — required for any transaction
    amount = _extract_amount(text)
    if not amount or amount <= 0:
        return None
    
    # Extract party
    party = _extract_party(text)
    
    # Determine transaction type
    txn_type: TransactionType | None = None
    confidence = 0.0
    
    if _CREDIT_SALE_PATTERN.search(text):
        txn_type = TransactionType.CREDIT_SALE
        confidence = 0.90
    elif _CASH_SALE_PATTERN.search(text):
        txn_type = TransactionType.CASH_SALE
        confidence = 0.88
    elif _RECEIPT_PATTERN.search(text) and party:
        txn_type = TransactionType.RECEIPT
        confidence = 0.85
    elif _PAYMENT_PATTERN.search(text) and party:
        txn_type = TransactionType.PAYMENT
        confidence = 0.85
    elif _PURCHASE_PATTERN.search(text):
        if party:
            txn_type = TransactionType.CREDIT_PURCHASE
        else:
            txn_type = TransactionType.CASH_PURCHASE
        confidence = 0.82
    elif _SALE_PATTERN.search(text):
        txn_type = TransactionType.CREDIT_SALE if party else TransactionType.CASH_SALE
        confidence = 0.86 if party else 0.80
    
    # Require high confidence for regex path
    if not txn_type or confidence < 0.80:
        return None
    
    # Build journal entry
    journal_lines = build_journal_entry(txn_type, amount, party)
    
    transaction = ParsedTransaction(
        transaction_type=txn_type,
        amount=amount,
        party=party,
        journal_lines=journal_lines,
        confidence=confidence,
        method="regex",
        raw_text=text,
    )
    
    return ParseResult(success=True, transaction=transaction)


# ══════════════════════════════════════════════════════════════════════════════
# LLM-BASED EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

_LLM_EXTRACTION_PROMPT = """You are a Nepal accounting transaction parser. Extract transaction details from the user's message.

Return ONLY a JSON object with these fields:
{
  "type": "credit_sale|cash_sale|credit_purchase|cash_purchase|receipt|payment|expense|salary|rent|capital|drawings|loan_received|loan_payment|contra|other",
  "amount": <number in NPR>,
  "party": "<person/company name or null>",
  "item": "<what was bought/sold or null>",
  "direction": "in|out",
  "confidence": <0.0-1.0>
}

RULES:
1. "udhaar/udharo becheko" = credit_sale (customer owes us)
2. "udhaar/udharo kineko" = credit_purchase (we owe supplier)
3. "diye/tireko" with party = payment (we paid someone)
4. "payo/liye" with party = receipt (we received from someone)
5. amount MUST come from user text — NEVER invent
6. If unclear, set confidence < 0.5

NEPALI TERMS:
- udhaar/udharo = credit/on account
- becheko/bikri = sold
- kineko/kharid = bought  
- diye/tireko = gave/paid
- payo/liye = received
- paisa/rupiya = money
- baki = balance due

EXAMPLES:
"Ram lai 5000 udhaar becheko" → {"type":"credit_sale","amount":5000,"party":"Ram","item":null,"direction":"out","confidence":0.95}
"Shyam bata 10000 payo" → {"type":"receipt","amount":10000,"party":"Shyam","item":null,"direction":"in","confidence":0.92}
"office rent 15000 tireko" → {"type":"rent","amount":15000,"party":null,"item":"office rent","direction":"out","confidence":0.88}
"500 diye" → {"type":"payment","amount":500,"party":null,"item":null,"direction":"out","confidence":0.6}"""


_extraction_llm: ChatOllama | None = None


def _get_extraction_llm() -> ChatOllama:
    """Get or create the extraction LLM."""
    global _extraction_llm
    if _extraction_llm is None:
        _extraction_llm = ChatOllama(
            model=FAST_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0.1,
            num_ctx=int(FAST_MODEL_OPTIONS.get("num_ctx", 2048)),
            format="json",
        )
    return _extraction_llm


def _parse_llm_json(text: str) -> dict | None:
    """Extract JSON from LLM response."""
    text = text.strip()
    
    # Remove markdown code blocks
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in text
        match = re.search(r"\{[^{}]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return None


def _type_to_enum(type_str: str) -> TransactionType:
    """Convert string type to TransactionType enum."""
    type_map = {
        "credit_sale": TransactionType.CREDIT_SALE,
        "cash_sale": TransactionType.CASH_SALE,
        "credit_purchase": TransactionType.CREDIT_PURCHASE,
        "cash_purchase": TransactionType.CASH_PURCHASE,
        "receipt": TransactionType.RECEIPT,
        "payment": TransactionType.PAYMENT,
        "expense": TransactionType.EXPENSE,
        "salary": TransactionType.SALARY,
        "rent": TransactionType.RENT,
        "capital": TransactionType.CAPITAL,
        "drawings": TransactionType.DRAWINGS,
        "loan_received": TransactionType.LOAN_RECEIVED,
        "loan_payment": TransactionType.LOAN_PAYMENT,
        "contra": TransactionType.CONTRA,
    }
    return type_map.get(type_str.lower(), TransactionType.OTHER)


async def llm_extract(text: str) -> ParseResult:
    """Extract transaction using LLM."""
    llm = _get_extraction_llm()
    
    messages = [
        SystemMessage(content=_LLM_EXTRACTION_PROMPT),
        HumanMessage(content=text),
    ]
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        response = result.content if hasattr(result, "content") else str(result)
        
        data = _parse_llm_json(response)
        if not data:
            return ParseResult(
                success=False,
                error="Could not parse LLM response",
            )
        
        # Check for low confidence / ambiguous
        confidence = float(data.get("confidence", 0.5))
        if confidence < 0.5:
            return ParseResult(
                success=False,
                clarification_needed="Transaction ko detail clear chhaina. Party ko naam ra amount confirm garnus.",
            )
        
        # Extract fields
        amount = data.get("amount")
        if not amount or not isinstance(amount, (int, float)) or amount <= 0:
            return ParseResult(
                success=False,
                clarification_needed="Amount mention garnus (e.g., 5000, Rs 10000).",
            )
        
        amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        txn_type = _type_to_enum(data.get("type", "other"))
        party = data.get("party")
        item = data.get("item")
        
        # Build journal entry (deterministic)
        journal_lines = build_journal_entry(txn_type, amount, party)
        
        transaction = ParsedTransaction(
            transaction_type=txn_type,
            amount=amount,
            party=party,
            item=item,
            journal_lines=journal_lines,
            confidence=confidence,
            method="llm",
            raw_text=text,
        )
        
        return ParseResult(success=True, transaction=transaction)
        
    except Exception as e:
        logger.exception("LLM extraction failed")
        return ParseResult(success=False, error=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# MAIN API
# ══════════════════════════════════════════════════════════════════════════════

async def parse_khata_entry(text: str, use_llm_always: bool = False) -> ParseResult:
    """Parse a khata entry message.
    
    Args:
        text: User's transaction message (Romanized Nepali, Devanagari, or English)
        use_llm_always: Skip regex fast-path (for testing)
    
    Returns:
        ParseResult with transaction or clarification request
    """
    text = text.strip()
    if not text:
        return ParseResult(success=False, error="Empty message")
    
    # Try regex fast-path first (unless disabled)
    if not use_llm_always:
        regex_result = regex_fast_path(text)
        if regex_result and regex_result.success:
            logger.debug(f"Regex fast-path: {regex_result.transaction.transaction_type}")
            return regex_result
    
    # Use LLM extraction
    return await llm_extract(text)


def parse_khata_entry_sync(text: str, use_llm_always: bool = False) -> ParseResult:
    """Synchronous wrapper for parse_khata_entry."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, parse_khata_entry(text, use_llm_always))
                return future.result(timeout=15)
        return loop.run_until_complete(parse_khata_entry(text, use_llm_always))
    except RuntimeError:
        return asyncio.run(parse_khata_entry(text, use_llm_always))


# ══════════════════════════════════════════════════════════════════════════════
# CONFIRMATION CARD GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_confirmation_message(
    transaction: ParsedTransaction,
    language: Literal["english", "nepali", "mixed"] = "mixed",
) -> str:
    """Generate a natural-language confirmation message for the transaction.
    
    Args:
        transaction: The parsed transaction
        language: User's preferred language
    
    Returns:
        Confirmation message asking user to verify
    """
    amount = f"Rs {int(transaction.amount):,}"
    party = transaction.party or "N/A"
    txn_type = transaction.transaction_type
    
    # Format journal entry
    journal_str = ""
    for line in transaction.journal_lines:
        if line.debit > 0:
            journal_str += f"\n  DEBIT: {line.account_name} — {amount}"
        if line.credit > 0:
            journal_str += f"\n  CREDIT: {line.account_name} — {amount}"
    
    if language == "english":
        type_labels = {
            TransactionType.CREDIT_SALE: "Credit Sale",
            TransactionType.CASH_SALE: "Cash Sale",
            TransactionType.CREDIT_PURCHASE: "Credit Purchase",
            TransactionType.CASH_PURCHASE: "Cash Purchase",
            TransactionType.RECEIPT: "Payment Received",
            TransactionType.PAYMENT: "Payment Made",
            TransactionType.EXPENSE: "Expense",
            TransactionType.SALARY: "Salary Payment",
            TransactionType.RENT: "Rent Payment",
        }
        label = type_labels.get(txn_type, txn_type.value.replace("_", " ").title())
        
        return f"""**{label}** to {party} for {amount}

Journal Entry:{journal_str}

Is this correct? Click **Confirm** to record or **Edit** to change."""
    
    else:  # Nepali / mixed
        type_labels = {
            TransactionType.CREDIT_SALE: "Udhaar Bikri",
            TransactionType.CASH_SALE: "Cash Bikri",
            TransactionType.CREDIT_PURCHASE: "Udhaar Kharid",
            TransactionType.CASH_PURCHASE: "Cash Kharid",
            TransactionType.RECEIPT: "Paisa Payo",
            TransactionType.PAYMENT: "Paisa Diye",
            TransactionType.EXPENSE: "Kharcha",
            TransactionType.SALARY: "Talab Bhuktan",
            TransactionType.RENT: "Bhaada Bhuktan",
        }
        label = type_labels.get(txn_type, txn_type.value.replace("_", " ").title())
        
        return f"""**{label}** — {party} lai {amount}

Journal Entry:{journal_str}

Yo thik cha? **Confirm** thichnus record garna, wa **Edit** thichnus change garna."""
