"""Hash-chained audit sink — SQLite adapter (Constitution L5)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from ...application.ports.outbound.audit_sink_port import AuditRecord, AuditSinkPort

GENESIS_HASH = "0" * 64


def _compute_hash(prev_hash: str, payload: dict[str, Any], occurred_at: str, event_name: str) -> str:
    canonical = json.dumps(
        {"prev": prev_hash, "payload": payload, "at": occurred_at, "event": event_name},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class SqliteAuditSinkAdapter(AuditSinkPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def latest_hash(self, tenant_id: str) -> str:
        cursor = await self._conn.execute(
            """
            SELECT record_hash FROM oip_audit
            WHERE tenant_id = ?
            ORDER BY occurred_at DESC
            LIMIT 1
            """,
            (tenant_id,),
        )
        row = await cursor.fetchone()
        return row["record_hash"] if row else GENESIS_HASH

    async def append(self, record: AuditRecord) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_audit (
                record_id, tenant_id, request_id, correlation_id, event_name,
                payload_redacted_json, prev_hash, record_hash, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.record_id,
                record.tenant_id,
                record.request_id,
                record.correlation_id,
                record.event_name,
                json.dumps(record.payload_redacted),
                record.prev_hash,
                record.record_hash,
                record.occurred_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_chain(
        self,
        *,
        tenant_id: str,
        request_id: str | None = None,
        limit: int = 100,
    ) -> list[AuditRecord]:
        if request_id:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_audit
                WHERE tenant_id = ? AND request_id = ?
                ORDER BY occurred_at ASC
                LIMIT ?
                """,
                (tenant_id, request_id, limit),
            )
        else:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_audit
                WHERE tenant_id = ?
                ORDER BY occurred_at ASC
                LIMIT ?
                """,
                (tenant_id, limit),
            )
        rows = await cursor.fetchall()
        records: list[AuditRecord] = []
        for row in rows:
            records.append(
                AuditRecord(
                    record_id=row["record_id"],
                    tenant_id=row["tenant_id"],
                    request_id=row["request_id"],
                    correlation_id=row["correlation_id"],
                    event_name=row["event_name"],
                    payload_redacted=json.loads(row["payload_redacted_json"]),
                    prev_hash=row["prev_hash"],
                    record_hash=row["record_hash"],
                    occurred_at=datetime.fromisoformat(row["occurred_at"]),
                )
            )
        return records

    async def append_event(
        self,
        *,
        record_id: str,
        tenant_id: str,
        request_id: str | None,
        correlation_id: str,
        event_name: str,
        payload_redacted: dict[str, Any],
    ) -> AuditRecord:
        prev = await self.latest_hash(tenant_id)
        occurred_at = datetime.now(timezone.utc).isoformat()
        record_hash = _compute_hash(prev, payload_redacted, occurred_at, event_name)
        record = AuditRecord(
            record_id=record_id,
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event_name,
            payload_redacted=payload_redacted,
            prev_hash=prev,
            record_hash=record_hash,
            occurred_at=datetime.fromisoformat(occurred_at),
        )
        await self.append(record)
        return record
