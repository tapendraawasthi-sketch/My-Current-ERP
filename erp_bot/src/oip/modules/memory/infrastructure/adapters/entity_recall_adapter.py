"""Entity-based recall adapter."""

from __future__ import annotations

import json

import aiosqlite

from ...application.ports.memory_ports import EntityRecallPort
from ...domain.entities import MemoryAggregate
from ...domain.value_objects import (
    CollectionScope,
    EntityRef,
    Freshness,
    Importance,
    MemoryCategory,
    MemoryLineage,
    MemoryStatus,
    MemoryType,
    RetentionPolicy,
)
from ..persistence.memory_sqlite import SqliteMemoryRepositoryAdapter, _parse_dt, _utc_now


class EntityRecallAdapter(EntityRecallPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn
        self._repo = SqliteMemoryRepositoryAdapter(conn)

    async def recall_by_entity(
        self, *, tenant_id: str, entity_type: str, entity_id: str, limit: int = 20
    ) -> tuple[MemoryAggregate, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_memories
            WHERE tenant_id = ? AND status = 'active' AND archived = 0
            ORDER BY created_at DESC
            """,
            (tenant_id,),
        )
        rows = await cursor.fetchall()
        matches: list[MemoryAggregate] = []
        for row in rows:
            entities_raw = json.loads(row["entities_json"])
            for entity in entities_raw:
                if entity.get("entity_type") == entity_type and entity.get("entity_id") == entity_id:
                    matches.append(self._repo._row_to_memory(row))
                    break
            if len(matches) >= limit:
                break
        return tuple(matches[:limit])
