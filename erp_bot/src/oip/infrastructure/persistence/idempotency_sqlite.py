"""Idempotency store — SQLite adapter (Phase 0D)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import aiosqlite


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SqliteIdempotencyStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def get(
        self,
        *,
        tenant_id: str,
        idempotency_key: str,
    ) -> dict[str, Any] | None:
        cursor = await self._conn.execute(
            """
            SELECT result_json FROM oip_idempotency
            WHERE tenant_id = ? AND idempotency_key = ?
            """,
            (tenant_id, idempotency_key),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return json.loads(row["result_json"])

    async def put(
        self,
        *,
        tenant_id: str,
        idempotency_key: str,
        command_type: str,
        result: dict[str, Any],
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_idempotency
            (tenant_id, idempotency_key, command_type, result_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                idempotency_key,
                command_type,
                json.dumps(result),
                _utc_now_iso(),
            ),
        )
        await self._conn.commit()
