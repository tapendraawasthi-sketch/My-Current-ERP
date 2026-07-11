"""SQLite outbox adapter."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Sequence

import aiosqlite

from ...application.ports.outbound.outbox_port import OutboxMessage, OutboxPort
from ...domain.events import DomainEventEnvelope


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SqliteOutboxAdapter(OutboxPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def enqueue(self, envelope: DomainEventEnvelope) -> str:
        message_id = str(uuid.uuid4())
        payload = envelope.event.model_dump(mode="json")
        await self._conn.execute(
            """
            INSERT INTO oip_outbox (id, event_type, partition_key, payload_json, created_at, attempts)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            (
                message_id,
                envelope.event_type,
                envelope.partition_key,
                json.dumps(payload),
                _utc_now_iso(),
            ),
        )
        await self._conn.commit()
        return message_id

    async def fetch_unpublished(self, *, limit: int = 100) -> Sequence[OutboxMessage]:
        cursor = await self._conn.execute(
            """
            SELECT id, payload_json, created_at, published_at, attempts
            FROM oip_outbox
            WHERE published_at IS NULL
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        messages: list[OutboxMessage] = []
        for row in rows:
            event_data = json.loads(row["payload_json"])
            from ...domain.events import DomainEvent

            event = DomainEvent(**event_data)
            envelope = DomainEventEnvelope(event=event)
            messages.append(
                OutboxMessage(
                    id=row["id"],
                    envelope=envelope,
                    created_at=datetime.fromisoformat(row["created_at"]),
                    published_at=(
                        datetime.fromisoformat(row["published_at"]) if row["published_at"] else None
                    ),
                    attempts=int(row["attempts"]),
                )
            )
        return messages

    async def mark_published(self, message_id: str) -> None:
        await self._conn.execute(
            "UPDATE oip_outbox SET published_at = ? WHERE id = ?",
            (_utc_now_iso(), message_id),
        )
        await self._conn.commit()

    async def mark_failed(self, message_id: str, error: str) -> None:
        await self._conn.execute(
            """
            UPDATE oip_outbox
            SET attempts = attempts + 1, last_error = ?
            WHERE id = ?
            """,
            (error[:2000], message_id),
        )
        await self._conn.commit()

    async def move_to_dead_letter(self, message_id: str) -> None:
        cursor = await self._conn.execute(
            "SELECT id, event_type, partition_key, payload_json, created_at, attempts, last_error FROM oip_outbox WHERE id = ?",
            (message_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_outbox_dlq
            (id, event_type, partition_key, payload_json, created_at, failed_at, attempts, last_error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["event_type"],
                row["partition_key"],
                row["payload_json"],
                row["created_at"],
                _utc_now_iso(),
                row["attempts"],
                row["last_error"],
            ),
        )
        await self._conn.execute("DELETE FROM oip_outbox WHERE id = ?", (message_id,))
        await self._conn.commit()

    async def replay_from_dead_letter(self, *, limit: int = 50) -> int:
        cursor = await self._conn.execute(
            "SELECT id, event_type, partition_key, payload_json, created_at FROM oip_outbox_dlq ORDER BY failed_at ASC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        replayed = 0
        for row in rows:
            await self._conn.execute(
                """
                INSERT OR REPLACE INTO oip_outbox
                (id, event_type, partition_key, payload_json, created_at, attempts)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                (row["id"], row["event_type"], row["partition_key"], row["payload_json"], row["created_at"]),
            )
            await self._conn.execute("DELETE FROM oip_outbox_dlq WHERE id = ?", (row["id"],))
            replayed += 1
        await self._conn.commit()
        return replayed

    async def get_queue_stats(self) -> dict[str, int]:
        cursor = await self._conn.execute(
            "SELECT COUNT(*) AS cnt FROM oip_outbox WHERE published_at IS NULL"
        )
        unpublished = (await cursor.fetchone())["cnt"]
        cursor = await self._conn.execute("SELECT COUNT(*) AS cnt FROM oip_outbox_dlq")
        dlq = (await cursor.fetchone())["cnt"]
        return {"unpublished": int(unpublished), "dead_letter": int(dlq)}
