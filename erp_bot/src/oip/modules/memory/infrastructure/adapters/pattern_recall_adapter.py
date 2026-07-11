"""Pattern recall adapter."""

from __future__ import annotations

from ...application.ports.memory_ports import MemoryRepositoryPort, PatternRecallPort
from ...domain.entities import MemoryAggregate


class PatternRecallAdapter(PatternRecallPort):
    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def search(
        self, *, tenant_id: str, pattern_type: str, limit: int = 20
    ) -> tuple[MemoryAggregate, ...]:
        return await self._repository.list_patterns(
            tenant_id=tenant_id, pattern_type=pattern_type, limit=limit
        )
