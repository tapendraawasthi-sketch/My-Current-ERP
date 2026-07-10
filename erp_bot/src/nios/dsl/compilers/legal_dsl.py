"""LegalDSL — compile UIL legal effects to rule queries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class LegalQuery:
    id: str
    jurisdiction: str
    concepts: list[str] = field(default_factory=list)
    acts: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    fy: str | None = None


def compile_legal_from_uil(uil: dict[str, Any]) -> LegalQuery:
    legal = uil.get("legal_effect") or {}
    tax = uil.get("tax_effect") or {}
    action = uil.get("action", "query")
    concepts: list[str] = []

    if action == "tax_query" or tax:
        concepts.extend(["TaxDecision", "VAT", "IncomeTax"])
    if action == "legal_query" or legal:
        concepts.extend(["LegalAuthority", "ActSection"])
    if action in ("sell", "purchase"):
        concepts.append("FinancialDocument")

    constraints = list(uil.get("constraints") or [])
    if legal.get("contract"):
        constraints.append(str(legal["contract"]))

    return LegalQuery(
        id=f"legal-{uil.get('id', 'unknown')}",
        jurisdiction=str(legal.get("jurisdiction", "NP")),
        concepts=concepts or ["LegalAuthority"],
        acts=[str(legal.get("act", "VAT Act 2052"))],
        constraints=constraints,
        fy=legal.get("fy"),
    )


def execute_legal_query(query: LegalQuery) -> dict[str, Any]:
    from ...domains.legal.engine import legal_engine
    from ...representations.ontology.engine import ontology_engine

    search_q = " ".join(query.concepts + query.acts)
    result = legal_engine.search(search_q)
    ont = ontology_engine.query_temporal(query.concepts[0] if query.concepts else "TaxDecision")
    return {
        "query": query.id,
        "jurisdiction": query.jurisdiction,
        "acts": [a.get("title", str(a)) if isinstance(a, dict) else getattr(a, "title", str(a)) for a in result.acts[:3]],
        "circulars": len(result.circulars),
        "ontology_rules": len(ont.get("relations", [])),
        "confidence": result.confidence,
        "summary": legal_engine.format_answer(result)[:300],
    }
