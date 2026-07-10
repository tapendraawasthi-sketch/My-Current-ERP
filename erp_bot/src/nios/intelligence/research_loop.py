"""Autonomous Research Loop — search until confidence threshold."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from ..intelligence.domain_guard import domain_guard
from ...knowledge.unified_retriever import retrieve

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.75
MAX_ITERATIONS = 3


@dataclass
class ResearchResult:
    chunks: list[dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0
    iterations: int = 0
    queries_used: list[str] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)


def _score_coverage(chunks: list[dict], query: str) -> float:
    if not chunks:
        return 0.0
    q_words = set(query.lower().split())
    hits = 0
    for c in chunks:
        text = (c.get("text") or "").lower()
        if any(w in text for w in q_words if len(w) > 3):
            hits += 1
    return min(1.0, hits / max(len(chunks), 1) + 0.3)


def _refine_query(query: str, iteration: int) -> str:
    if iteration == 1:
        return f"Nepal {query} IRD rule"
    if iteration == 2:
        return f"{query} VAT TDS income tax Nepal"
    return query


async def autonomous_research(
    query: str,
    intent: str = "accounting_qa",
    *,
    threshold: float = CONFIDENCE_THRESHOLD,
) -> ResearchResult:
    guard = domain_guard(query)
    if not guard.get("allow_web_search") and guard.get("route_to") == "accounting_lexicon":
        # Domain term — knowledge only, no web
        chunks = retrieve(query, intent=intent, k=5)
        return ResearchResult(
            chunks=chunks,
            confidence=_score_coverage(chunks, query),
            iterations=1,
            queries_used=[query],
        )

    result = ResearchResult()
    current_query = query

    for i in range(MAX_ITERATIONS):
        result.iterations = i + 1
        result.queries_used.append(current_query)

        try:
            chunks = retrieve(current_query, intent=intent, k=5)
        except Exception as exc:
            logger.warning("Research iteration %s failed: %s", i, exc)
            chunks = []

        result.chunks.extend(chunks)
        confidence = _score_coverage(result.chunks, query)
        result.confidence = confidence

        if confidence >= threshold:
            break

        current_query = _refine_query(query, i + 1)

    # Deduplicate chunks by text prefix
    seen: set[str] = set()
    unique: list[dict] = []
    for c in result.chunks:
        key = (c.get("text") or "")[:80]
        if key not in seen:
            seen.add(key)
            unique.append(c)
    result.chunks = unique[:8]

    return result
