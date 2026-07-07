"""Hybrid + keyword RAG search facade."""

from __future__ import annotations

from .hybrid_rag import get_hybrid_rag


def search_knowledge(question: str, top_k: int = 3) -> list[dict]:
    """Search accounting knowledge — hybrid dense + BM25."""
    results = get_hybrid_rag().search(question, top_k=top_k)
    return [
        {
            "text": r.get("text", ""),
            "source": r.get("metadata", {}).get("source", "ca_knowledge"),
            "score": r.get("score", 0),
            "id": r.get("id", ""),
        }
        for r in results
    ]
