"""Legal Nepal domain plugin — acts, circulars, court decisions."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# Bootstrap legal corpus (expandable via knowledge ingest)
LEGAL_ACTS: list[dict[str, Any]] = [
    {
        "id": "vat_act_2052",
        "title": "Value Added Tax Act, 2052 (1996)",
        "jurisdiction": "NP",
        "sections": ["s.7 VAT rate", "s.12 Registration", "s.21 Return filing"],
        "effective_from": "1996-11-17",
    },
    {
        "id": "income_tax_act_2058",
        "title": "Income Tax Act, 2058 (2002)",
        "jurisdiction": "NP",
        "sections": ["s.2 Definitions", "s.88 Tax rates", "s.95 TDS"],
        "effective_from": "2002-07-16",
    },
    {
        "id": "companies_act_2063",
        "title": "Companies Act, 2063 (2006)",
        "jurisdiction": "NP",
        "sections": ["s.154 Annual return", "s.81 Board meeting"],
        "effective_from": "2006-09-06",
    },
    {
        "id": "labor_act_2074",
        "title": "Labor Act, 2074 (2017)",
        "jurisdiction": "NP",
        "sections": ["s.35 Working hours", "s.38 Overtime", "s.145 Gratuity"],
        "effective_from": "2017-08-04",
    },
    {
        "id": "foreign_investment_act_2075",
        "title": "Foreign Investment and Technology Transfer Act, 2075",
        "jurisdiction": "NP",
        "sections": ["s.3 Approval", "s.12 Repatriation"],
        "effective_from": "2019-03-27",
    },
]

CIRCULARS: list[dict[str, Any]] = [
    {"id": "ird_circ_2081_vat", "issuer": "IRD", "topic": "VAT return format FY 2081/82", "date": "2081-04-01"},
    {"id": "nrb_circ_2080_fx", "issuer": "NRB", "topic": "Foreign exchange directive", "date": "2080-07-15"},
    {"id": "sebon_circ_2079", "issuer": "SEBON", "topic": "Disclosure requirements listed companies", "date": "2079-11-01"},
]

COURT_DECISIONS: list[dict[str, Any]] = [
    {
        "id": "sc_2078_vat_penalty",
        "court": "Supreme Court",
        "topic": "VAT penalty waiver conditions",
        "year": "2078",
        "cite": "NKP 2078 Vol 12",
    },
]


@dataclass
class LegalSearchResult:
    acts: list[dict] = field(default_factory=list)
    circulars: list[dict] = field(default_factory=list)
    court_decisions: list[dict] = field(default_factory=list)
    confidence: float = 0.0


class LegalNepalEngine:
    def search(self, query: str, *, jurisdiction: str = "NP") -> LegalSearchResult:
        q = query.lower()
        result = LegalSearchResult()

        for act in LEGAL_ACTS:
            if any(tok in act["title"].lower() or tok in act["id"] for tok in q.split() if len(tok) > 2):
                result.acts.append(act)
            elif re.search(r"vat|tax|company|labor|investment", q) and any(
                kw in act["id"] for kw in ["vat", "income_tax", "companies", "labor", "foreign"]
            ):
                if re.search(r"vat", q) and "vat" in act["id"]:
                    result.acts.append(act)
                elif re.search(r"income|tax|tds", q) and "income_tax" in act["id"]:
                    result.acts.append(act)
                elif re.search(r"company|companies", q) and "companies" in act["id"]:
                    result.acts.append(act)
                elif re.search(r"labor|labour|gratuity", q) and "labor" in act["id"]:
                    result.acts.append(act)

        for circ in CIRCULARS:
            if any(tok in circ["topic"].lower() for tok in q.split() if len(tok) > 2):
                result.circulars.append(circ)

        for dec in COURT_DECISIONS:
            if any(tok in dec["topic"].lower() for tok in q.split() if len(tok) > 2):
                result.court_decisions.append(dec)

        hits = len(result.acts) + len(result.circulars) + len(result.court_decisions)
        result.confidence = min(1.0, hits / 3) if hits else 0.3
        return result

    def format_answer(self, result: LegalSearchResult) -> str:
        parts: list[str] = []
        for act in result.acts[:2]:
            sections = ", ".join(act.get("sections", [])[:3])
            parts.append(f"**{act['title']}** — {sections}")
        for circ in result.circulars[:2]:
            parts.append(f"Circular ({circ['issuer']}): {circ['topic']}")
        for dec in result.court_decisions[:1]:
            parts.append(f"Court ({dec['court']}): {dec['topic']} [{dec.get('cite', '')}]")
        return "\n".join(parts) if parts else "No matching legal authority found. Try specific act name."


legal_engine = LegalNepalEngine()
