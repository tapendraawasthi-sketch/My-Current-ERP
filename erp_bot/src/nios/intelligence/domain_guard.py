"""Domain guard — block Wikipedia for accounting/tax/legal terms."""

from __future__ import annotations

import re

from ..representations.uil_parser import is_domain_term

FACTUAL_PATTERNS = [
    re.compile(r"\bwhat is\b", re.I),
    re.compile(r"\bdefine\b", re.I),
    re.compile(r"\bk ho\b", re.I),
]


def domain_guard(query: str) -> dict[str, object]:
    trimmed = query.strip()

    if is_domain_term(trimmed) or is_domain_term(trimmed.rstrip("?।")):
        return {
            "allow_web_search": False,
            "route_to": "accounting_lexicon",
            "reason": "Accounting domain term — use lexicon, not Wikipedia",
        }

    if any(p.search(trimmed) for p in FACTUAL_PATTERNS):
        if re.search(r"\b(vat|tds|tax|nfrs|journal|ledger|कर|sampati|sampatti)\b", trimmed, re.I):
            return {
                "allow_web_search": False,
                "route_to": "knowledge_graph",
                "reason": "Domain factual query — use Nepal knowledge base",
            }

    return {
        "allow_web_search": True,
        "route_to": "general",
        "reason": "Non-domain query",
    }
