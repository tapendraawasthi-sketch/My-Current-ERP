"""
Domain router — classify user intent BEFORE web search or generic LLM.
Mirrors src/lib/ekhata/domainRouter.ts for Python backend parity.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from .nepal_ai_runtime import check_safety, is_accounting_question, is_incomplete_transaction

ConversationMode = Literal[
    "journal_entry",
    "accounting_qa",
    "framework_qa",
    "compliance_qa",
    "meta_system",
    "emotional_chat",
    "external_fact",
    "report",
    "correction",
    "education",
    "casual",
]

ACCOUNTING_TERMS = re.compile(
    r"\b(sampati|sampatti|asset|liability|equity|puni|dayitwo|rin|aamdani|kharcha|"
    r"debit|credit|journal|ledger|voucher|hisab|lekha|khata|udhaar|receivable|payable|"
    r"provision|accrual|depreciation|goodwill|inventory|stock|cogs|vat|tds|ssf|gratuity|"
    r"salary|bikri|becheko|kharid|kineko|tiryo|capital|loan|drawings|trial\s*balance|"
    r"ifrs|nas|nfrs|faithful\s*representation|recognition|measurement|fair\s*value|"
    r"going\s*concern|audit|fiscal|shrawan|ashadh|ird|pan\b|accounting|hisabkitab)\b|[\u0900-\u097F]",
    re.I,
)

FRAMEWORK_TERMS = re.compile(
    r"\b(faithful\s*representation|recognition\s*criteria|conceptual\s*framework|"
    r"qualitative\s*characteristics|derecognition|comprehensive\s*income|"
    r"para\s*\d+\.\d+|sambandhitata|manyata|mulyankan)\b",
    re.I,
)

COMPLIANCE_TERMS = re.compile(
    r"\b(ird|vat\s*act|income\s*tax|tds\s*rate|ssf\s*rate|fiscal\s*year|"
    r"tax\s*invoice|withholding|compliance|statutory)\b",
    re.I,
)

ENTRY_SIGNALS = re.compile(
    r"\b(sold|sale|bought|purchase|paid|received|tiryo|tireko|diye|diyeko|kineko|kineye|kinye|becheko|bikri|"
    r"liyo|liye|liya|gare|garyo|garya|replace|repair|"
    r"kharcha|noksan|nokshan|ghateko|ghatyo|loss|salary|vat|tds|loan|capital|return|commission|advance|jama|"
    r"consume|khaye|nikale|istimal|prayog|invest|lagani|haleko|drawings)\b.*\d|"
    r"\d.*\b(sold|sale|bought|purchase|paid|received|tiryo|tireko|diye|diyeko|kineko|kineye|kinye|becheko|"
    r"liyo|liye|liya|gare|garyo|garya|replace|repair|"
    r"kharcha|noksan|nokshan|ghateko|loss|salary|vat|tds|loan|capital|return|commission|advance|"
    r"consume|khaye|nikale|istimal|prayog|invest|lagani|haleko)\b",
    re.I,
)

OWNER_TRANSACTION = re.compile(
    r"\b(aafai|aafaile|afai|afno|owner|malik|personal|nijee|mero)\b.*\b(consume|khaye|liye|use|istimal|nikale|invest|lagani|haleko)\b|"
    r"\b(consume|khaye|liye|use|istimal|nikale|invest|lagani)\b.*\b(aafai|aafaile|afai|afno|owner|malik|personal)\b|"
    r"\b(pasal|shop|business)\s+(?:ko\s+)?(?:saman|goods|mal)\b.*\d",
    re.I,
)

INCOMPLETE_ENTRY = re.compile(
    r"\b(tiryo|tireko|diyo|diyeko|becheko|bikri|kineko|kineye|kinye|kharid|kharcha|noksan|"
    r"liyo|liye|liya|gare|garyo|garya|replace|repair|"
    r"paid|received|bech|kin|jama|aayo|consume|khaye|nikale)\b",
    re.I,
)

QUESTION = re.compile(
    r"\b(what|how|why|when|where|who|k\s*ho|ke\s*ho|kasari|kina|define|explain|"
    r"meaning|matlab|difference|compare|classify|entry|journal|vana|bana|bujhau|"
    r"sikau|artha|bujha|samjha)\b|\?",
    re.I,
)

FOLLOW_UP = re.compile(
    r"\b(vana|bana|bujhau|samjha|explain|accounting\s*ma|properly|clear|detail|"
    r"thik\s*le|ramrari|feri)\b",
    re.I,
)

REPORT = re.compile(
    r"\b(report|summary|statement|ledger|day\s*book|trial\s*balance|p\s*&\s*l|profit)\b",
    re.I,
)

EDUCATION = re.compile(
    r"\b(explain|sikau|bujhau|what\s+is|ke\s+ho|meaning|artha|kasari|teach|sikha)\b",
    re.I,
)

CORRECTION = re.compile(
    r"\b(wrong|galat|fix|sudhar|cancel|hatau|last\s+entry|reverse|ulto)\b",
    re.I,
)

EXTERNAL_FACT = re.compile(
    r"\b(weather|mausam|news|population|prime\s*minister|football|cricket|movie)\b",
    re.I,
)


@dataclass
class DomainRoute:
    mode: ConversationMode
    confidence: float
    block_web_search: bool


def classify_domain(text: str) -> DomainRoute:
    """Classify message domain with web-search guard."""
    t = (text or "").strip()
    if not t:
        return DomainRoute("casual", 1.0, True)

    if check_safety(t):
        return DomainRoute("casual", 0.95, True)

    if is_accounting_question(t):
        if COMPLIANCE_TERMS.search(t) or re.search(r"\b(vat|tds|ssf|tax|kar)\b", t, re.I):
            return DomainRoute("compliance_qa", 0.9, True)
        return DomainRoute("accounting_qa", 0.92, True)

    if CORRECTION.search(t):
        return DomainRoute("correction", 0.9, True)
    if REPORT.search(t):
        return DomainRoute("report", 0.88, True)

    if ENTRY_SIGNALS.search(t) and not QUESTION.search(t):
        return DomainRoute("journal_entry", 0.9, True)

    if OWNER_TRANSACTION.search(t) and re.search(r"\d", t):
        return DomainRoute("journal_entry", 0.92, True)

    if INCOMPLETE_ENTRY.search(t) and not re.search(r"\d", t) and not QUESTION.search(t):
        return DomainRoute("journal_entry", 0.88, True)

    if is_incomplete_transaction(t):
        return DomainRoute("journal_entry", 0.86, True)

    if FRAMEWORK_TERMS.search(t):
        return DomainRoute("framework_qa", 0.88, True)
    if COMPLIANCE_TERMS.search(t):
        return DomainRoute("compliance_qa", 0.85, True)

    if ACCOUNTING_TERMS.search(t):
        if QUESTION.search(t) or FOLLOW_UP.search(t):
            return DomainRoute("accounting_qa", 0.88, True)
        if re.search(r"\d", t):
            return DomainRoute("journal_entry", 0.75, True)
        return DomainRoute("accounting_qa", 0.7, True)

    if FOLLOW_UP.search(t):
        return DomainRoute("accounting_qa", 0.8, True)

    if EDUCATION.search(t) and not ENTRY_SIGNALS.search(t):
        return DomainRoute("education", 0.85, True)

    if EXTERNAL_FACT.search(t):
        return DomainRoute("external_fact", 0.75, False)

    if QUESTION.search(t):
        return DomainRoute("accounting_qa", 0.55, True)

    return DomainRoute("casual", 0.4, True)


def should_block_web_search(text: str) -> bool:
    return classify_domain(text).block_web_search
