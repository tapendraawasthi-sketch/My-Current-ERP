"""Phase 7 — Unified retrieval: Nepal MD + tiered BM25 + IFRS with RRF merge."""

from __future__ import annotations

import logging
from typing import Any

from ..vectorstore.ca_knowledge_store import search_ca_knowledge
from ..vectorstore.nepal_knowledge_store import search_nepal_knowledge
from .hybrid_rag import get_hybrid_rag
from .knowledge_registry import authority_score

logger = logging.getLogger(__name__)

RRF_K = 60


def _rrf_merge(lists: list[list[dict[str, Any]]], top_k: int = 5) -> list[dict[str, Any]]:
    scores: dict[str, float] = {}
    by_id: dict[str, dict[str, Any]] = {}

    for docs in lists:
        for rank, doc in enumerate(docs):
            doc_id = str(doc.get("id") or doc.get("chunk_id") or f"{rank}-{hash(doc.get('text','')[:40])}")
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (RRF_K + rank + 1)
            if doc_id not in by_id:
                by_id[doc_id] = doc

    ordered = sorted(scores.items(), key=lambda x: -x[1])[:top_k]
    out: list[dict[str, Any]] = []
    for doc_id, score in ordered:
        d = dict(by_id[doc_id])
        d["score"] = score
        meta = dict(d.get("metadata") or {})
        seg = str(meta.get("segment") or meta.get("source") or "")
        if seg:
            d["score"] = score + authority_score(seg, "accounting_qa") * 0.01
        out.append(d)
    return out


def retrieve(query: str, intent: str = "accounting_qa", k: int = 5) -> list[dict[str, Any]]:
    """Retrieve ranked chunks for accounting / compliance questions."""
    lists: list[list[dict[str, Any]]] = []

    try:
        nepal = search_nepal_knowledge(query, k=max(k * 2, 6))
        lists.append(
            [
                {
                    "id": r.get("id", f"nepal-{i}"),
                    "text": r.get("content", r.get("text", "")),
                    "metadata": {
                        "source": r.get("source", "nepal_knowledge"),
                        "section": r.get("section", ""),
                        "segment": "professional.legal-compliance",
                    },
                }
                for i, r in enumerate(nepal)
            ]
        )
    except Exception as e:
        logger.warning("Nepal knowledge search failed: %s", e)

    try:
        hybrid = get_hybrid_rag().search(query, top_k=max(k * 2, 8), task=intent)
        lists.append(
            [
                {
                    "id": r.get("id", f"hybrid-{i}"),
                    "text": r.get("text", ""),
                    "metadata": r.get("metadata") or {},
                }
                for i, r in enumerate(hybrid)
            ]
        )
    except Exception as e:
        logger.warning("Hybrid RAG search failed: %s", e)

    merged = _rrf_merge(lists, top_k=k)
    if merged:
        return merged

    try:
        ca = search_ca_knowledge(query, k=k)
        return [
            {
                "id": r.get("id", f"ca-{i}"),
                "text": r.get("content", r.get("text", "")),
                "metadata": {"source": "ca_knowledge", "segment": "professional.accounting-standards"},
            }
            for i, r in enumerate(ca)
        ]
    except Exception as e:
        logger.warning("CA knowledge fallback failed: %s", e)
        return []


def format_retrieved_context(chunks: list[dict[str, Any]], max_chars: int = 2500) -> str:
    if not chunks:
        return ""
    parts: list[str] = []
    total = 0
    for c in chunks:
        src = (c.get("metadata") or {}).get("source", "knowledge")
        section = (c.get("metadata") or {}).get("section", "")
        header = f"[{src}" + (f" — {section}" if section else "") + "]"
        body = str(c.get("text", "")).strip()
        block = f"{header}\n{body}"
        if total + len(block) > max_chars:
            break
        parts.append(block)
        total += len(block)
    return "\n\n---\n\n".join(parts)
