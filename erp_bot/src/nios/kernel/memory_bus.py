"""7-level cognitive Memory Bus — SQLite-backed (PG-compatible schema)."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

MemoryLevel = Literal[
    "sensory", "working", "semantic", "procedural",
    "episodic", "business", "long_term",
]

LEVELS: list[MemoryLevel] = [
    "sensory", "working", "semantic", "procedural",
    "episodic", "business", "long_term",
]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  tenant_id TEXT,
  company_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  UNIQUE(level, key, tenant_id, company_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_level ON memory_records(level, tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_records(session_id, level);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_path() -> Path:
    return Path(os.getenv("NIOS_DATA_DIR", "data")) / "nios_memory.sqlite3"


class MemoryBus:
    """Route reads/writes across 7 cognitive memory levels."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _db_path()
        self._init()

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
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
            from datetime import timedelta
            expires = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO memory_records
                  (id, level, key, value_json, tenant_id, company_id, session_id, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            cur = conn.execute(
                """
                SELECT value_json FROM memory_records
                WHERE level = ? AND key = ?
                  AND COALESCE(tenant_id, '') = COALESCE(?, '')
                  AND COALESCE(company_id, '') = COALESCE(?, '')
                  AND COALESCE(session_id, '') = COALESCE(?, '')
                ORDER BY created_at DESC LIMIT 1
                """,
                (level, key, tenant_id, company_id, session_id),
            )
            row = cur.fetchone()
        if not row:
            return None
        return json.loads(row["value_json"])

    def list_level(
        self,
        level: MemoryLevel,
        *,
        tenant_id: str | None = None,
        session_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT id, key, value_json, created_at FROM memory_records
                WHERE level = ?
                  AND (? IS NULL OR tenant_id = ?)
                  AND (? IS NULL OR session_id = ?)
                ORDER BY created_at DESC LIMIT ?
                """,
                (level, tenant_id, tenant_id, session_id, session_id, limit),
            )
            rows = cur.fetchall()
        return [
            {"id": r["id"], "key": r["key"], "value": json.loads(r["value_json"]), "created_at": r["created_at"]}
            for r in rows
        ]

    def stats(self) -> dict[str, int]:
        with self._connect() as conn:
            cur = conn.execute(
                "SELECT level, COUNT(*) as cnt FROM memory_records GROUP BY level"
            )
            rows = cur.fetchall()
        return {r["level"]: r["cnt"] for r in rows}

    @property
    def backend(self) -> str:
        return "sqlite"


def create_memory_bus():
    """Factory — SQLite default; PostgreSQL when NIOS_MEMORY_BACKEND=postgres."""
    backend = os.getenv("NIOS_MEMORY_BACKEND", "sqlite").lower()
    if backend == "postgres":
        dsn = os.getenv("NIOS_PG_URL") or os.getenv("DATABASE_URL")
        if dsn:
            try:
                from .memory_bus_pg import PostgresMemoryBus

                bus = PostgresMemoryBus(dsn)
                return bus
            except Exception:
                pass
    return MemoryBus()


memory_bus = create_memory_bus()
