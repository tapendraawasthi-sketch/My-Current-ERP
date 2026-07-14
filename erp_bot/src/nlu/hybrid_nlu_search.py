"""
Hybrid NLU retrieval — lexical tiered KB + embedding nearest-neighbor (RRF).

Falls back to lexical-only when the NLU embedding index is empty or Ollama
is unavailable.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from ..knowledge.knowledge_registry import KnowledgeChunk, load_all_chunks, search_tiered_knowledge
from ..knowledge.sector_profile import compute_sector_boost, effective_sector_profile
from ..vectorstore.nlu_knowledge_store import search_nlu_embeddings

logger = logging.getLogger(__name__)

RRF_K = 60
USE_HYBRID_NLU = os.getenv("USE_HYBRID_NLU_SEARCH", "true").lower() != "false"
USE_NP_KB_ENRICH = os.getenv("ORBIX_NP_KB_ENABLED", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

_chunk_by_id: dict[str, KnowledgeChunk] | None = None


def _np_kb_query_boost(query: str) -> tuple[str, dict[str, Any]]:
    """Optionally normalize/enrich query via ONLI KB; never execute mutations."""
    if not USE_NP_KB_ENRICH:
        return query, {"enabled": False}
    try:
        from .np_kb_adapter import enrich_nlu_context

        enrich = enrich_nlu_context(query, top_k=3)
        if not enrich.get("enabled"):
            return query, enrich
        boosted = enrich.get("normalized_for_nlu") or query
        return boosted, enrich
    except Exception as exc:  # soft-fail
        logger.debug("NP KB enrich skipped: %s", exc)
        return query, {"enabled": False, "reason": str(exc)}


@dataclass(frozen=True)
class HybridNLUHit:
    chunk: KnowledgeChunk
    score: float
    semantic_score: float = 0.0
    lexical_score: float = 0.0
    rrf_score: float = 0.0


def _chunk_index() -> dict[str, KnowledgeChunk]:
    global _chunk_by_id
    if _chunk_by_id is None:
        _chunk_by_id = {c.id: c for c in load_all_chunks()}
    return _chunk_by_id


def _rrf(rank: int) -> float:
    return 1.0 / (RRF_K + rank + 1)


def hybrid_search_nlu(
    query: str,
    *,
    top_k: int = 5,
    min_relevance: float = 0.2,
    sector_profile: str | None = None,
    session_sector: Any = None,
) -> list[KnowledgeChunk]:
    """Reciprocal-rank fusion of lexical tiered search + dense NLU embeddings."""
    return [
        h.chunk
        for h in hybrid_search_nlu_scored(
            query,
            top_k=top_k,
            min_relevance=min_relevance,
            sector_profile=sector_profile,
            session_sector=session_sector,
        )
    ]


def hybrid_search_nlu_scored(
    query: str,
    *,
    top_k: int = 5,
    min_relevance: float = 0.2,
    sector_profile: str | None = None,
    session_sector: Any = None,
) -> list[HybridNLUHit]:
    """
    Hybrid search returning per-chunk scores for nearest-neighbor classification.
    """
    query, _np_meta = _np_kb_query_boost(query)

    active_sector = effective_sector_profile(
        sector_profile=sector_profile,
        query=query,
        session_sector=session_sector,
    )

    lexical = search_tiered_knowledge(
        query,
        task="nlu",
        top_k=top_k * 3,
        min_relevance=min_relevance,
        sector_profile=active_sector,
        session_sector=session_sector,
    )

    if not USE_HYBRID_NLU:
        from ..knowledge.knowledge_registry import _chunk_matches_query

        return [
            HybridNLUHit(
                chunk=c,
                score=_chunk_matches_query(c, query),
                lexical_score=_chunk_matches_query(c, query),
            )
            for c in lexical[:top_k]
        ]

    dense = search_nlu_embeddings(
        query,
        k=top_k * 3,
        sector_slug=active_sector,
    )
    if not dense:
        dense = search_nlu_embeddings(query, k=top_k * 3)

    if not dense:
        from ..knowledge.knowledge_registry import _chunk_matches_query

        return [
            HybridNLUHit(
                chunk=c,
                score=_chunk_matches_query(c, query),
                lexical_score=_chunk_matches_query(c, query),
            )
            for c in lexical[:top_k]
        ]

    fused: dict[str, float] = {}
    lexical_scores: dict[str, float] = {}
    from ..knowledge.knowledge_registry import _chunk_matches_query

    for rank, chunk in enumerate(lexical):
        fused[chunk.id] = fused.get(chunk.id, 0.0) + _rrf(rank)
        lexical_scores[chunk.id] = _chunk_matches_query(chunk, query)

    index = _chunk_index()
    for rank, hit in enumerate(dense):
        cid = str(hit.get("id") or "")
        if not cid:
            continue
        fused[cid] = fused.get(cid, 0.0) + _rrf(rank)

    ranked_ids = sorted(fused.items(), key=lambda x: -x[1])
    results: list[HybridNLUHit] = []

    for cid, rrf_score in ranked_ids:
        chunk = index.get(cid)
        if not chunk:
            continue
        sector_boost = compute_sector_boost(chunk, active_sector, task="nlu")
        semantic = next((h["semantic_score"] for h in dense if h.get("id") == cid), 0.0)
        combined = rrf_score * 10.0 + sector_boost * 0.2 + semantic * 0.5
        results.append(
            HybridNLUHit(
                chunk=chunk,
                score=combined,
                semantic_score=semantic,
                lexical_score=lexical_scores.get(cid, 0.0),
                rrf_score=rrf_score,
            )
        )
        if len(results) >= top_k * 2:
            break

    results.sort(key=lambda x: -x.score)
    return results[:top_k]
