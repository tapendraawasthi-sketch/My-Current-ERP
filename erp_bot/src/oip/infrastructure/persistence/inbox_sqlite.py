"""SQLite inbox adapter — idempotent consumers."""

from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite

from ...application.ports.outbound.inbox_port import InboxPort


class SqliteInboxAdapter(InboxPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def is_processed(self, *, consumer_group: str, idempotency_key: str) -> bool:
        cursor = await self._conn.execute(
            """
            SELECT 1 FROM oip_inbox
            WHERE consumer_group = ? AND idempotency_key = ?
            """,
            (consumer_group, idempotency_key),
        )
        row = await cursor.fetchone()
        return row is not None

    async def mark_processed(
        self,
        *,
        consumer_group: str,
        idempotency_key: str,
        event_type: str,
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR IGNORE INTO oip_inbox (consumer_group, idempotency_key, event_type, processed_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                consumer_group,
                idempotency_key,
                event_type,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await self._conn.commit()
