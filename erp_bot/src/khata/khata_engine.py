"""Phase 4 — Khata Entry Engine: Parser + Validator + Confirmation Flow."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Literal

from .khata_parser import ParsedEntry, parse_transaction, parse_transaction_sync, EntryType, Direction
from .khata_validator import JournalEntry, generate_journal_entry, generate_confirmation_card, validate_journal

logger = logging.getLogger(__name__)


@dataclass
class KhataResult:
    kind: Literal["entry", "clarify", "error", "not_transaction"]
    parsed: ParsedEntry | None = None
    journal: JournalEntry | None = None
    card: dict | None = None
    clarification_question: str | None = None
    error: str | None = None
    errors: list[str] | None = None
    confidence: float = 0.0
    language: str = "mixed"
    
    def to_dict(self) -> dict:
        result = {"kind": self.kind, "confidence": self.confidence, "language": self.language}
        if self.parsed: result["parsed"] = self.parsed.to_dict()
        if self.journal: result["journal"] = self.journal.to_dict()
        if self.card: result["card"] = self.card
        if self.clarification_question: result["clarification_question"] = self.clarification_question
        if self.error: result["error"] = self.error
        if self.errors: result["errors"] = self.errors
        return result


def _detect_language(text: str) -> Literal["english", "nepali", "mixed"]:
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", text))
    has_nepali = bool(re.search(r"\b(lai|bata|ko|ma|le|udhaar|tireko|becheko|kineko|diye|liye)\b", text, re.I))
    has_english = bool(re.search(r"\b(the|is|for|to|from|sold|bought|paid|received)\b", text, re.I))
    if has_devanagari: return "nepali"
    if has_nepali and not has_english: return "nepali"
    if has_english and not has_nepali: return "english"
    return "mixed"


async def process_khata_entry(text: str) -> KhataResult:
    text = text.strip()
    if not text:
        return KhataResult(kind="error", error="Empty input")
    
    language = _detect_language(text)
    parsed = await parse_transaction(text)
    
    if parsed is None:
        return KhataResult(kind="not_transaction", language=language)
    
    if parsed.needs_clarification:
        question = parsed.clarification_question
        if not question:
            question = "Could you please provide more details?" if language == "english" else "Yo transaction ko barema aru details dinus na?"
        return KhataResult(kind="clarify", parsed=parsed, clarification_question=question, confidence=parsed.confidence, language=language)
    
    journal = generate_journal_entry(parsed)
    is_valid, errors = validate_journal(journal)
    
    if not is_valid:
        return KhataResult(kind="error", parsed=parsed, journal=journal, error="Validation failed", errors=errors, confidence=parsed.confidence, language=language)
    
    card = generate_confirmation_card(parsed, journal, language)
    return KhataResult(kind="entry", parsed=parsed, journal=journal, card=card, confidence=parsed.confidence, language=language)


def process_khata_entry_sync(text: str) -> KhataResult:
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, process_khata_entry(text))
                return future.result(timeout=20)
        return loop.run_until_complete(process_khata_entry(text))
    except RuntimeError:
        return asyncio.run(process_khata_entry(text))


def format_confirmation_message(result: KhataResult, language: Literal["english", "nepali", "mixed"] = "mixed") -> str:
    if result.kind != "entry" or not result.journal or not result.card:
        return ""
    
    card = result.card
    journal = result.journal
    lines = [f"**{card['summary']}**", "", "Journal Entry:"]
    
    for line in card.get("lines", []):
        dr_cr, account, amount = line["dr_cr"], line["account"], f"Rs. {line['amount']:,.0f}"
        if dr_cr == "Dr":
            lines.append(f"  **{account}** — Dr {amount}")
        else:
            lines.append(f"    {account} — Cr {amount}")
    
    lines.append("")
    if journal.is_balanced:
        lines.append(f"✓ Balance: Dr {journal.total_debit:,.0f} = Cr {journal.total_credit:,.0f}")
    else:
        lines.append(f"⚠️ NOT BALANCED: Dr {journal.total_debit:,.0f} ≠ Cr {journal.total_credit:,.0f}")
    
    lines.append("")
    lines.append("**Confirm** click garera yo entry record garnus." if language != "english" else "Click **Confirm** to record this entry.")
    return "\n".join(lines)


def format_clarification_message(result: KhataResult) -> str:
    if result.kind != "clarify":
        return ""
    return result.clarification_question or "Please provide more details."


async def handle_khata_intent(text: str, history: list[dict[str, str]] | None = None) -> tuple[str, dict | None]:
    result = await process_khata_entry(text)
    
    if result.kind == "not_transaction":
        return "", None
    if result.kind == "error":
        error_msg = result.error or "Could not process transaction"
        if result.errors:
            error_msg += ": " + ", ".join(result.errors)
        return f"माफ गर्नुहोस्, {error_msg}", None
    if result.kind == "clarify":
        return format_clarification_message(result), None
    if result.kind == "entry":
        return format_confirmation_message(result, result.language), result.card
    return "", None
