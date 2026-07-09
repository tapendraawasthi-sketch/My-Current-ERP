"""Phase 4 — Khata Entry Validator with deterministic double-entry logic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .khata_parser import ParsedEntry, EntryType, Direction, JournalLine


@dataclass
class JournalEntry:
    lines: list[JournalLine]
    narration: str
    date: str
    party: str | None
    amount: float
    entry_type: str
    total_debit: float = 0.0
    total_credit: float = 0.0
    is_balanced: bool = True
    
    def to_dict(self) -> dict:
        return {
            "lines": [l.to_dict() for l in self.lines],
            "narration": self.narration, "date": self.date, "party": self.party,
            "amount": self.amount, "entry_type": self.entry_type,
            "total_debit": self.total_debit, "total_credit": self.total_credit,
            "is_balanced": self.is_balanced,
        }


ACCOUNTS = {
    "cash": "Cash", "bank": "Bank", "receivable": "Accounts Receivable",
    "inventory": "Inventory", "payable": "Accounts Payable",
    "sales": "Sales Revenue", "income": "Other Income",
    "purchases": "Purchases", "expense": "Expenses",
}


def _party_receivable(party: str | None) -> str:
    return f"Accounts Receivable - {party}" if party else ACCOUNTS["receivable"]


def _party_payable(party: str | None) -> str:
    return f"Accounts Payable - {party}" if party else ACCOUNTS["payable"]


def generate_journal_entry(parsed: ParsedEntry) -> JournalEntry:
    lines: list[JournalLine] = []
    amount = parsed.amount
    party = parsed.party
    
    match parsed.entry_type:
        case EntryType.CREDIT_SALE:
            lines = [
                JournalLine(account=_party_receivable(party), debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["sales"], debit=0, credit=amount),
            ]
        case EntryType.CREDIT_PURCHASE:
            lines = [
                JournalLine(account=ACCOUNTS["purchases"], debit=amount, credit=0),
                JournalLine(account=_party_payable(party), debit=0, credit=amount),
            ]
        case EntryType.CASH_SALE:
            lines = [
                JournalLine(account=ACCOUNTS["cash"], debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["sales"], debit=0, credit=amount),
            ]
        case EntryType.CASH_PURCHASE:
            lines = [
                JournalLine(account=ACCOUNTS["purchases"], debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["cash"], debit=0, credit=amount),
            ]
        case EntryType.PAYMENT_RECEIVED:
            lines = [
                JournalLine(account=ACCOUNTS["cash"], debit=amount, credit=0),
                JournalLine(account=_party_receivable(party), debit=0, credit=amount),
            ]
        case EntryType.PAYMENT_MADE:
            lines = [
                JournalLine(account=_party_payable(party), debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["cash"], debit=0, credit=amount),
            ]
        case EntryType.EXPENSE:
            lines = [
                JournalLine(account=parsed.item or ACCOUNTS["expense"], debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["cash"], debit=0, credit=amount),
            ]
        case EntryType.INCOME:
            lines = [
                JournalLine(account=ACCOUNTS["cash"], debit=amount, credit=0),
                JournalLine(account=parsed.item or ACCOUNTS["income"], debit=0, credit=amount),
            ]
        case _:
            lines = [
                JournalLine(account=ACCOUNTS["expense"], debit=amount, credit=0),
                JournalLine(account=ACCOUNTS["cash"], debit=0, credit=amount),
            ]
    
    total_debit = sum(l.debit for l in lines)
    total_credit = sum(l.credit for l in lines)
    is_balanced = abs(total_debit - total_credit) < 0.01
    
    return JournalEntry(
        lines=lines, narration=parsed.narration, date=parsed.date or "",
        party=party, amount=amount, entry_type=parsed.entry_type.value,
        total_debit=total_debit, total_credit=total_credit, is_balanced=is_balanced,
    )


def validate_balance(journal: JournalEntry) -> tuple[bool, str]:
    if not journal.lines:
        return False, "Journal entry has no lines"
    total_debit = sum(l.debit for l in journal.lines)
    total_credit = sum(l.credit for l in journal.lines)
    diff = abs(total_debit - total_credit)
    if diff > 0.01:
        return False, f"Entry does not balance: Dr={total_debit:.2f}, Cr={total_credit:.2f}"
    return True, ""


def validate_amounts(journal: JournalEntry) -> tuple[bool, str]:
    for line in journal.lines:
        if line.debit < 0 or line.credit < 0:
            return False, f"Negative amount in line: {line.account}"
        if line.debit > 0 and line.credit > 0:
            return False, f"Line has both debit and credit: {line.account}"
        if line.debit == 0 and line.credit == 0:
            return False, f"Line has no amount: {line.account}"
    return True, ""


def validate_journal(journal: JournalEntry) -> tuple[bool, list[str]]:
    errors: list[str] = []
    valid, err = validate_balance(journal)
    if not valid:
        errors.append(err)
    valid, err = validate_amounts(journal)
    if not valid:
        errors.append(err)
    if not journal.date:
        errors.append("Missing transaction date")
    if journal.amount <= 0:
        errors.append("Invalid transaction amount")
    return len(errors) == 0, errors


def generate_confirmation_card(
    parsed: ParsedEntry, journal: JournalEntry,
    language: Literal["english", "nepali", "mixed"] = "mixed",
) -> dict:
    formatted_lines = []
    for line in journal.lines:
        if line.debit > 0:
            formatted_lines.append({"account": line.account, "dr_cr": "Dr", "amount": line.debit})
        else:
            formatted_lines.append({"account": line.account, "dr_cr": "Cr", "amount": line.credit})
    
    summary = _nepali_summary(parsed) if language != "english" else _english_summary(parsed)
    
    return {
        "type": "journal_confirmation", "summary": summary, "party": parsed.party,
        "amount": parsed.amount, "entry_type": parsed.entry_type.value, "date": journal.date,
        "lines": formatted_lines, "total_debit": journal.total_debit,
        "total_credit": journal.total_credit, "is_balanced": journal.is_balanced,
        "narration": parsed.narration, "confidence": parsed.confidence,
    }


def _english_summary(parsed: ParsedEntry) -> str:
    party = parsed.party or "Unknown party"
    amount = f"Rs. {parsed.amount:,.0f}"
    match parsed.entry_type:
        case EntryType.CREDIT_SALE: return f"Credit sale to {party} for {amount}"
        case EntryType.CREDIT_PURCHASE: return f"Credit purchase from {party} for {amount}"
        case EntryType.CASH_SALE: return f"Cash sale for {amount}"
        case EntryType.CASH_PURCHASE: return f"Cash purchase for {amount}"
        case EntryType.PAYMENT_RECEIVED: return f"Payment received from {party}: {amount}"
        case EntryType.PAYMENT_MADE: return f"Payment made to {party}: {amount}"
        case EntryType.EXPENSE: return f"Paid {amount} for {parsed.item or 'expense'}"
        case EntryType.INCOME: return f"Received {amount} as {parsed.item or 'income'}"
        case _: return f"Transaction of {amount}"


def _nepali_summary(parsed: ParsedEntry) -> str:
    party = parsed.party or "Party"
    amount = f"Rs. {parsed.amount:,.0f}"
    match parsed.entry_type:
        case EntryType.CREDIT_SALE: return f"{party} lai {amount} ko udharo bikri"
        case EntryType.CREDIT_PURCHASE: return f"{party} bata {amount} ko udharo kharidi"
        case EntryType.CASH_SALE: return f"{amount} ko naqad bikri"
        case EntryType.CASH_PURCHASE: return f"{amount} ko naqad kharidi"
        case EntryType.PAYMENT_RECEIVED: return f"{party} bata {amount} tireko liye"
        case EntryType.PAYMENT_MADE: return f"{party} lai {amount} tiryo"
        case EntryType.EXPENSE: return f"{parsed.item or 'kharcha'} ko lagi {amount} tiryo"
        case EntryType.INCOME: return f"{parsed.item or 'aaya'} bata {amount} aayo"
        case _: return f"{amount} ko transaction"
