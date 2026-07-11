"""Timeline recall adapter."""

from __future__ import annotations

from typing import Any

from ...application.ports.memory_ports import MemoryRepositoryPort, TimelineRecallPort
from ...domain.entities import MemoryAggregate


class TimelineRecallAdapter(TimelineRecallPort):
    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def recall(
        self, *, tenant_id: str, limit: int = 50, **filters: Any
    ) -> tuple[MemoryAggregate, ...]:
        return await self._repository.search_timeline(tenant_id=tenant_id, limit=limit, **filters)
