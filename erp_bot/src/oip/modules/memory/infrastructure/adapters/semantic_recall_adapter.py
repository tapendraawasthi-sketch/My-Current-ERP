"""Semantic recall adapter."""

from __future__ import annotations

from typing import Any

from ...application.ports.memory_ports import MemoryRepositoryPort, SemanticRecallPort


class SemanticRecallAdapter(SemanticRecallPort):
    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def search(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]:
        return await self._repository.search_semantic(
            tenant_id=tenant_id, query=query, limit=limit, **filters
        )
