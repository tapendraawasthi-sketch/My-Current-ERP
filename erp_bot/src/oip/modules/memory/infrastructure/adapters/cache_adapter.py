"""In-process recall cache adapter."""

from __future__ import annotations

import time

from ...application.ports.memory_ports import CachePort
from ...domain.entities import MemoryAggregate


class MemoryCacheAdapter(CachePort):
    def __init__(self, max_entries: int = 256) -> None:
        self._cache: dict[str, tuple[float, tuple[MemoryAggregate, ...]]] = {}
        self._max_entries = max_entries

    async def get(self, key: str) -> tuple[MemoryAggregate, ...] | None:
        entry = self._cache.get(key)
        if entry is None:
            return None
        expires_at, memories = entry
        if time.time() > expires_at:
            del self._cache[key]
            return None
        return memories

    async def set(self, key: str, memories: tuple[MemoryAggregate, ...], ttl_seconds: int = 300) -> None:
        if len(self._cache) >= self._max_entries:
            oldest = min(self._cache.items(), key=lambda item: item[1][0])
            del self._cache[oldest[0]]
        self._cache[key] = (time.time() + ttl_seconds, memories)
