"""UIL Parser — Phase 1."""

from __future__ import annotations

import re
from uuid import uuid4

from ..contracts.intelligence_contract import UILDocument

SALE_PATTERN = re.compile(r"\b(beche|becheko|bikyo|bikri|sell|sold|बेच|बिक्री)\b", re.I)
PURCHASE_PATTERN = re.compile(r"\b(kine|kineko|kinyo|purchase|bought|किन|खरिद)\b", re.I)
BALANCE_PATTERN = re.compile(r"\b(balance|bakaya|baki|शेष|kitna|kati)\b", re.I)
TAX_PATTERN = re.compile(r"\b(vat|tds|tax|कर|भ्याट|आयकर)\b", re.I)
INVEST_PATTERN = re.compile(r"\b(nepse|dcf|npv|irr|portfolio|invest|stock)\b", re.I)
PARTY_LE_PATTERN = re.compile(r"\b(\w+)\s+le\b", re.I)

ACCOUNTING_TERMS = {
    "sampati", "sampatti", "सम्पत्ति", "सम्पति", "capital", "asset", "liability",
    "revenue", "expense", "debit", "credit", "journal", "ledger", "vat", "tds",
}


def is_domain_term(text: str) -> bool:
    lower = text.lower().strip()
    if lower in ACCOUNTING_TERMS:
        return True
    return bool(re.search(r"\b(sampati|sampatti|सम्पत्ति|सम्पति)\b", text, re.I))


def parse_to_uil(text: str) -> UILDocument:
    trimmed = text.strip()
    action = "query"
    goals = ["answer_question"]
    confidence = 0.55
    dependencies: list[str] = ["cap.knowledge.nepal.search"]

    if SALE_PATTERN.search(trimmed):
        action, goals, confidence = "sell", ["record_sale", "compute_vat"], 0.75
        dependencies = ["cap.party.resolve", "cap.tax.vat.calculate"]
    elif PURCHASE_PATTERN.search(trimmed):
        action, goals, confidence = "purchase", ["record_purchase", "compute_vat"], 0.75
        dependencies = ["cap.party.resolve", "cap.tax.vat.calculate"]
    elif BALANCE_PATTERN.search(trimmed):
        action, goals, confidence = "ledger_query", ["fetch_balance"], 0.9
        dependencies = ["cap.erp.ledger.balance", "cap.erp.session_snapshot"]
    elif TAX_PATTERN.search(trimmed):
        action, goals, confidence = "tax_query", ["answer_tax_question"], 0.8
        dependencies = ["cap.knowledge.nepal.search", "cap.tax.vat.calculate"]
    elif INVEST_PATTERN.search(trimmed):
        action, goals, confidence = "investment_query", ["analyze_investment"], 0.85
        dependencies = ["cap.investment.nepse_quote", "cap.investment.dcf_run"]

    actor = None
    party_match = PARTY_LE_PATTERN.search(trimmed)
    if party_match:
        actor = {"party": party_match.group(1), "role": "counterparty"}
        confidence = min(0.95, confidence + 0.1)

    financial_effect: dict = {}
    amt_m = re.search(r"(\d+(?:\.\d+)?)", trimmed)
    if amt_m:
        financial_effect["amount"] = float(amt_m.group(1))

    if re.search(r"[\u0900-\u097F]", trimmed):
        script = "devanagari"
        detected = "nepali"
    elif re.search(r"\b(ko|le|lai|bhayo|gayo|kati|k ho)\b", trimmed, re.I):
        script, detected = "roman", "nepali"
    else:
        script, detected = "english", "english"

    return UILDocument(
        id=str(uuid4()),
        version="1.0",
        action=action,
        confidence=confidence,
        goals=goals,
        source_text=trimmed,
        dependencies=dependencies,
        metadata={"actor": actor, "language": {"detected": detected, "script": script}, "financial_effect": financial_effect},
    )
