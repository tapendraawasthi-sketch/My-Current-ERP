"""Lexical search adapter — delegates to repository FTS-style matching."""

from __future__ import annotations

from typing import Any

from ...application.ports.knowledge_ports import KnowledgeRepositoryPort, LexicalSearchPort


class LexicalSearchAdapter(LexicalSearchPort):
    def __init__(self, repository: KnowledgeRepositoryPort) -> None:
        self._repository = repository

    async def search(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]:
        return await self._repository.search_lexical(
            tenant_id=tenant_id,
            query=query,
            jurisdiction=jurisdiction,
            as_of=as_of,
            limit=limit,
        )
