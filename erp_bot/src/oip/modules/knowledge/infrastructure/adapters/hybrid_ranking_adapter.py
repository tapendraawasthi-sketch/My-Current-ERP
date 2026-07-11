"""Hybrid ranking adapter — merges lexical and semantic hits with authority weighting."""

from __future__ import annotations

from typing import Any

from ...application.ports.knowledge_ports import HybridRankingPort


class HybridRankingAdapter(HybridRankingPort):
    LEXICAL_WEIGHT = 0.3
    SEMANTIC_WEIGHT = 0.5
    AUTHORITY_WEIGHT = 0.15
    FRESHNESS_WEIGHT = 0.05

    async def rank(
        self,
        *,
        lexical_hits: tuple[dict[str, Any], ...],
        semantic_hits: tuple[dict[str, Any], ...],
        authority_registry,
        as_of: str,
    ) -> tuple[dict[str, Any], ...]:
        merged: dict[str, dict[str, Any]] = {}

        for hit in lexical_hits:
            doc_id = hit.get("document_id", "")
            if not doc_id:
                continue
            merged.setdefault(doc_id, {"document_id": doc_id, "lexical_score": 0.0, "semantic_score": 0.0})
            merged[doc_id]["lexical_score"] = max(merged[doc_id]["lexical_score"], float(hit.get("score", 0)))

        for hit in semantic_hits:
            doc_id = hit.get("document_id", "")
            if not doc_id:
                continue
            merged.setdefault(doc_id, {"document_id": doc_id, "lexical_score": 0.0, "semantic_score": 0.0})
            merged[doc_id]["semantic_score"] = max(merged[doc_id]["semantic_score"], float(hit.get("score", 0)))
            if "authority_level" in hit and "authority_level" not in merged[doc_id]:
                merged[doc_id]["authority_level"] = hit["authority_level"]
            if "effective_from" in hit:
                merged[doc_id]["effective_from"] = hit["effective_from"]

        results: list[dict[str, Any]] = []
        for doc_id, row in merged.items():
            authority_level = row.get("authority_level", "working_documents")
            authority_score = authority_registry.rank(authority_level) / 100.0
            effective_from = row.get("effective_from", as_of)
            freshness_score = 1.0 if effective_from <= as_of else 0.5
            lexical_score = row["lexical_score"]
            semantic_score = row["semantic_score"]
            combined = (
                self.LEXICAL_WEIGHT * lexical_score
                + self.SEMANTIC_WEIGHT * semantic_score
                + self.AUTHORITY_WEIGHT * authority_score
                + self.FRESHNESS_WEIGHT * freshness_score
            )
            results.append(
                {
                    "document_id": doc_id,
                    "score": combined,
                    "lexical_score": lexical_score,
                    "semantic_score": semantic_score,
                    "authority_score": authority_score,
                    "freshness_score": freshness_score,
                    "authority_level": authority_level,
                }
            )

        results.sort(key=lambda r: r["score"], reverse=True)
        return tuple(results)
