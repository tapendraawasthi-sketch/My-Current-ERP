"""Hybrid recall adapter — combines lexical and semantic scores."""

from __future__ import annotations

from typing import Any

from ...application.ports.memory_ports import HybridRecallPort, LexicalRecallPort, SemanticRecallPort
from ...domain.importance_registry import ImportanceRegistry


class HybridRecallAdapter(HybridRecallPort):
    def __init__(
        self,
        lexical: LexicalRecallPort,
        semantic: SemanticRecallPort,
        importance_registry: ImportanceRegistry,
    ) -> None:
        self._lexical = lexical
        self._semantic = semantic
        self._importance = importance_registry

    async def search(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]:
        lexical_hits = await self._lexical.search(
            tenant_id=tenant_id, query=query, limit=limit * 2, **filters
        )
        semantic_hits = await self._semantic.search(
            tenant_id=tenant_id, query=query, limit=limit * 2, **filters
        )
        combined: dict[str, dict[str, Any]] = {}
        for hit in lexical_hits:
            memory = hit["memory"]
            combined[memory.memory_id] = {
                "memory": memory,
                "lexical_score": hit.get("lexical_score", 0.0),
                "semantic_score": 0.0,
            }
        for hit in semantic_hits:
            memory = hit["memory"]
            existing = combined.get(memory.memory_id)
            if existing:
                existing["semantic_score"] = hit.get("semantic_score", 0.0)
            else:
                combined[memory.memory_id] = {
                    "memory": memory,
                    "lexical_score": 0.0,
                    "semantic_score": hit.get("semantic_score", 0.0),
                }
        ranked: list[tuple[float, dict[str, Any]]] = []
        for item in combined.values():
            memory = item["memory"]
            imp_weight = self._importance.score_weight(memory.importance)
            score = item["lexical_score"] * 0.35 + item["semantic_score"] * 0.45 + imp_weight * 0.2
            item["combined_score"] = score
            ranked.append((score, item))
        ranked.sort(key=lambda x: x[0], reverse=True)
        return tuple(item for _, item in ranked[:limit])
