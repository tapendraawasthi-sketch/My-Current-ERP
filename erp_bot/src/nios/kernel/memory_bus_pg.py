"""PostgreSQL-backed 7-level Memory Bus."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .memory_bus import LEVELS, MemoryLevel, _now

_SCHEMA = """
CREATE TABLE IF NOT EXISTS nios_memory_records (
  id UUID PRIMARY KEY,
  level TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  tenant_id TEXT,
  company_id TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_nios_memory_level ON nios_memory_records(level, tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_nios_memory_session ON nios_memory_records(session_id, level);
"""


class PostgresMemoryBus:
    """Route reads/writes across 7 cognitive memory levels (PostgreSQL)."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self._init()

    def _connect(self):
        import psycopg2
        from psycopg2.extras import RealDictCursor

        return psycopg2.connect(self.dsn, cursor_factory=RealDictCursor)

    def _init(self) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_SCHEMA)
            conn.commit()

    def write(
        self,
        level: MemoryLevel,
        key: str,
        value: Any,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        session_id: str | None = None,
        ttl_seconds: int | None = None,
    ) -> str:
        record_id = str(uuid.uuid4())
        now = _now()
        expires = None
        if ttl_seconds:
            expires = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()

        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO nios_memory_records
                      (id, level, key, value_json, tenant_id, company_id, session_id, created_at, expires_at)
                    VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s)
                    """,
                    (
                        record_id, level, key, json.dumps(value, default=str),
                        tenant_id, company_id, session_id, now, expires,
                    ),
                )
            conn.commit()
        return record_id

    def read(
        self,
        level: MemoryLevel,
        key: str,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        session_id: str | None = None,
    ) -> Any | None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT value_json FROM nios_memory_records
                    WHERE level = %s AND key = %s
                      AND COALESCE(tenant_id, '') = COALESCE(%s, '')
                      AND COALESCE(company_id, '') = COALESCE(%s, '')
                      AND COALESCE(session_id, '') = COALESCE(%s, '')
                    ORDER BY created_at DESC LIMIT 1
                    """,
                    (level, key, tenant_id, company_id, session_id),
                )
                row = cur.fetchone()
        if not row:
            return None
        val = row["value_json"]
        return val if isinstance(val, dict) else json.loads(val)

    def list_level(
        self,
        level: MemoryLevel,
        *,
        tenant_id: str | None = None,
        session_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, key, value_json, created_at FROM nios_memory_records
                    WHERE level = %s
                      AND (%s IS NULL OR tenant_id = %s)
                      AND (%s IS NULL OR session_id = %s)
                    ORDER BY created_at DESC LIMIT %s
                    """,
                    (level, tenant_id, tenant_id, session_id, session_id, limit),
                )
                rows = cur.fetchall()
        return [
            {
                "id": str(r["id"]),
                "key": r["key"],
                "value": r["value_json"] if isinstance(r["value_json"], dict) else json.loads(r["value_json"]),
                "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            }
            for r in rows
        ]

    def stats(self) -> dict[str, int]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT level, COUNT(*) as cnt FROM nios_memory_records GROUP BY level")
                rows = cur.fetchall()
        return {r["level"]: r["cnt"] for r in rows}

    @property
    def backend(self) -> str:
        return "postgres"
