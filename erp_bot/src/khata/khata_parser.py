"""Phase 4 — Khata Entry Parser using LLM for structured extraction.

Replaces brittle regex-only parsing with LLM-based extraction that:
1. Extracts: party, amount, direction, entry_type → strict JSON
2. Supports: Romanized Nepali, Devanagari, English, code-mixed
3. Handles ambiguous inputs with clarifying questions
4. Falls back to deterministic regex for high-confidence patterns
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import FAST_MODEL, FAST_MODEL_OPTIONS, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)


class EntryType(str, Enum):
    CREDIT_SALE = "credit_sale"
    CREDIT_PURCHASE = "credit_purchase"
    CASH_SALE = "cash_sale"
    CASH_PURCHASE = "cash_purchase"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_MADE = "payment_made"
    EXPENSE = "expense"
    INCOME = "income"


class Direction(str, Enum):
    INWARD = "inward"
    OUTWARD = "outward"


@dataclass
class ParsedEntry:
    party: str | None
    amount: float
    direction: Direction
    entry_type: EntryType
    item: str | None = None
    date: str | None = None
    narration: str = ""
    confidence: float = 0.0
    needs_clarification: bool = False
    clarification_question: str | None = None
    
    def to_dict(self) -> dict:
        return {
            "party": self.party,
            "amount": self.amount,
            "direction": self.direction.value,
            "entry_type": self.entry_type.value,
            "item": self.item,
            "date": self.date or date.today().isoformat(),
            "narration": self.narration,
            "confidence": self.confidence,
            "needs_clarification": self.needs_clarification,
            "clarification_question": self.clarification_question,
        }


@dataclass
class JournalLine:
    account: str
    debit: float = 0.0
    credit: float = 0.0
    
    def to_dict(self) -> dict:
        return {"account": self.account, "debit": self.debit, "credit": self.credit}


_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?\s*|रु\.?\s*|npr\s*|rupees?\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+)",
    re.IGNORECASE,
)
_PARTY_PATTERN = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b|"([^"]+)"|\'([^\']+)\'')
_OUTWARD_KEYWORDS = re.compile(r"\b(diye|diyo|diyeko|paid|gave|sold|becheko|tireko|tire)\b", re.I)
_INWARD_KEYWORDS = re.compile(r"\b(liye|liyo|liyeko|received|got|bought|kineko|kinyo)\b", re.I)
_CREDIT_KEYWORDS = re.compile(r"\b(udhaar|udharo|udhar|credit|baki)\b", re.I)
_SALE_KEYWORDS = re.compile(r"\b(sold|becheko|sale|bikri)\b", re.I)
_PURCHASE_KEYWORDS = re.compile(r"\b(bought|kineko|kinyo|purchase|kharidi)\b", re.I)


def _extract_amount(text: str) -> float | None:
    match = _AMOUNT_PATTERN.search(text)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return None


def _extract_party(text: str) -> str | None:
    match = _PARTY_PATTERN.search(text)
    if match:
        return match.group(1) or match.group(2) or match.group(3)
    return None


def _regex_parse(text: str) -> ParsedEntry | None:
    amount = _extract_amount(text)
    if not amount or amount < 1:
        return None
    
    party = _extract_party(text)
    has_outward = bool(_OUTWARD_KEYWORDS.search(text))
    has_inward = bool(_INWARD_KEYWORDS.search(text))
    
    if has_outward == has_inward:
        return None
    
    direction = Direction.OUTWARD if has_outward else Direction.INWARD
    is_credit = bool(_CREDIT_KEYWORDS.search(text))
    is_sale = bool(_SALE_KEYWORDS.search(text))
    is_purchase = bool(_PURCHASE_KEYWORDS.search(text))
    
    if is_credit and is_sale:
        entry_type = EntryType.CREDIT_SALE
    elif is_credit and is_purchase:
        entry_type = EntryType.CREDIT_PURCHASE
    elif is_sale:
        entry_type = EntryType.CASH_SALE
    elif is_purchase:
        entry_type = EntryType.CASH_PURCHASE
    elif direction == Direction.OUTWARD:
        entry_type = EntryType.PAYMENT_MADE
    else:
        entry_type = EntryType.PAYMENT_RECEIVED
    
    return ParsedEntry(
        party=party, amount=amount, direction=direction, entry_type=entry_type,
        narration=text, confidence=0.85 if party else 0.70,
    )


_EXTRACTION_PROMPT = """You are a transaction parser for a Nepal accounting system.
Extract transaction details and return ONLY valid JSON:

{"party": "<name or null>", "amount": <number>, "direction": "inward|outward",
 "entry_type": "credit_sale|credit_purchase|cash_sale|cash_purchase|payment_received|payment_made|expense|income",
 "item": "<description or null>", "confidence": <0.0-1.0>,
 "needs_clarification": <true|false>, "clarification_question": "<question or null>"}

Direction: "diye/paid/gave/sold" → outward; "liye/received/got/bought" → inward
Entry types: credit_sale=udhaar bikri, credit_purchase=udhaar kharidi, etc.

Examples:
"Ram lai 5000 udhaar diye" → {"party":"Ram","amount":5000,"direction":"outward","entry_type":"credit_sale",...}
"500 diye" → {...,"needs_clarification":true,"clarification_question":"Kaslo lai 500 dinubhayo?"}

Return ONLY JSON."""


_parser_llm: ChatOllama | None = None


def _get_parser_llm() -> ChatOllama:
    global _parser_llm
    if _parser_llm is None:
        _parser_llm = ChatOllama(
            model=FAST_MODEL, base_url=OLLAMA_BASE_URL,
            temperature=0.1, num_ctx=int(FAST_MODEL_OPTIONS.get("num_ctx", 2048)), format="json",
        )
    return _parser_llm


def _parse_llm_response(text: str) -> dict | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


async def _llm_parse(text: str) -> ParsedEntry | None:
    llm = _get_parser_llm()
    messages = [SystemMessage(content=_EXTRACTION_PROMPT), HumanMessage(content=text)]
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        response_text = result.content if hasattr(result, "content") else str(result)
        parsed = _parse_llm_response(response_text)
        if not parsed:
            return None
        
        amount = parsed.get("amount")
        if not amount or not isinstance(amount, (int, float)):
            return None
        
        try:
            direction = Direction(parsed.get("direction", "outward"))
        except ValueError:
            direction = Direction.OUTWARD
        
        try:
            entry_type = EntryType(parsed.get("entry_type", "payment_made"))
        except ValueError:
            entry_type = EntryType.PAYMENT_MADE
        
        return ParsedEntry(
            party=parsed.get("party"), amount=float(amount), direction=direction,
            entry_type=entry_type, item=parsed.get("item"), narration=text,
            confidence=float(parsed.get("confidence", 0.7)),
            needs_clarification=parsed.get("needs_clarification", False),
            clarification_question=parsed.get("clarification_question"),
        )
    except Exception as e:
        logger.exception(f"LLM parsing failed: {e}")
        return None


async def parse_transaction(text: str) -> ParsedEntry | None:
    text = text.strip()
    if not text:
        return None
    
    has_amount = bool(_AMOUNT_PATTERN.search(text))
    has_transaction_words = bool(re.search(
        r"\b(udhaar|udharo|sold|bought|paid|received|diye|liye|tireko|becheko|kineko)\b", text, re.I
    ))
    
    if not has_amount and not has_transaction_words:
        return None
    
    regex_result = _regex_parse(text)
    if regex_result and regex_result.confidence >= 0.80:
        return regex_result
    
    llm_result = await _llm_parse(text)
    if llm_result:
        return llm_result
    
    return regex_result


def parse_transaction_sync(text: str) -> ParsedEntry | None:
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, parse_transaction(text))
                return future.result(timeout=15)
        return loop.run_until_complete(parse_transaction(text))
    except RuntimeError:
        return asyncio.run(parse_transaction(text))
