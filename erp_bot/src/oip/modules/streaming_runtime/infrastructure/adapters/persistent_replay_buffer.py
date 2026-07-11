"""SQLite persistent replay buffer adapter."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.replay_buffer_port import ReplayBufferPort
from ...domain.value_objects import StreamEventRecord, WorkflowEventType


class PersistentReplayBufferAdapter(ReplayBufferPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def append(self, *, workflow_id: str, event: StreamEventRecord) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_stream_replay_buffer (buffer_id, workflow_id, sequence, event_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                workflow_id,
                event.sequence,
                json.dumps(event.model_dump(mode="json")),
                now,
            ),
        )
        await self._conn.commit()

    async def get_after_sequence(
        self, *, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]:
        cursor = await self._conn.execute(
            """
            SELECT event_json FROM oip_stream_replay_buffer
            WHERE workflow_id = ? AND sequence > ?
            ORDER BY sequence ASC LIMIT ?
            """,
            (workflow_id, after_sequence, limit),
        )
        rows = await cursor.fetchall()
        events: list[StreamEventRecord] = []
        for row in rows:
            data = json.loads(row["event_json"])
            data["event_type"] = WorkflowEventType(data["event_type"])
            events.append(StreamEventRecord(**data))
        return tuple(events)

    async def trim(self, *, workflow_id: str, keep: int) -> int:
        cursor = await self._conn.execute(
            """
            SELECT buffer_id FROM oip_stream_replay_buffer
            WHERE workflow_id = ?
            ORDER BY sequence DESC
            LIMIT -1 OFFSET ?
            """,
            (workflow_id, keep),
        )
        rows = await cursor.fetchall()
        if not rows:
            return 0
        ids = [row["buffer_id"] for row in rows]
        placeholders = ",".join("?" for _ in ids)
        await self._conn.execute(
            f"DELETE FROM oip_stream_replay_buffer WHERE buffer_id IN ({placeholders})",
            ids,
        )
        await self._conn.commit()
        return len(ids)
