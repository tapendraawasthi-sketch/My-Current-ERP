"""Precomputed instant answers for high-frequency FAQ — no LLM required."""

from __future__ import annotations

import re

STATIC_ANSWERS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b(vat|भ्याट).*(rate|kati|percent|%)", re.I),
        "Nepal VAT standard rate is **13%** on most taxable goods and services. "
        "VAT-inclusive amount: VAT = (inclusive × 13) ÷ 113. Verify current IRD rules at https://ird.gov.np",
    ),
    (
        re.compile(r"\b(tds).*(rent|house|building)", re.I),
        "TDS on rent in Nepal: **10%** (PAN holder), **15%** (non-PAN). "
        "Residential rent below Rs. 25,000/month may be exempt. Verify at https://ird.gov.np",
    ),
    (
        re.compile(r"\b(ssf).*(rate|contribution|kati)", re.I),
        "SSF contribution on basic salary: Employee **11%**, Employer **20%**, Total **31%**. "
        "Mandatory for organizations with 10+ employees. Verify at https://ssf.gov.np",
    ),
    (
        re.compile(
            r"^(what do you do|what can you do|who are you|timi ko|tapaai ko|k garnecha)\??$",
            re.I,
        ),
        "I'm **Orbix**, your Nepal accounting assistant in Sutra ERP. "
        "I can record khata entries, check balances, answer VAT/TDS/SSF questions, and help you navigate the ERP.",
    ),
    (
        re.compile(r"^(hello|hi|hey|namaste|namaskar)\b", re.I),
        "Hello! 👋 How can I help you today? Ask about entries, balances, tax rules, or ERP screens.",
    ),
]


def get_static_answer(query: str) -> str | None:
    text = query.strip()
    if not text:
        return None
    for pattern, answer in STATIC_ANSWERS:
        if pattern.search(text):
            return answer
    return None
