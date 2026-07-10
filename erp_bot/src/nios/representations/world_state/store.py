"""World State persistence — SQLite (PG-compatible schema)."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = """
CREATE TABLE IF NOT EXISTS world_state_slices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  company_id TEXT,
  domain TEXT NOT NULL,
  slice_key TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  source_event TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, company_id, domain, slice_key)
);

CREATE INDEX IF NOT EXISTS idx_world_state_domain
  ON world_state_slices(tenant_id, company_id, domain);

CREATE TABLE IF NOT EXISTS world_state_history (
  id TEXT PRIMARY KEY,
  slice_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  source_event TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_state_history_slice ON world_state_history(slice_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_db_path() -> Path:
    root = Path(os.getenv("NIOS_DATA_DIR", "data"))
    return root / "nios_world_state.sqlite3"


class WorldStateStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _default_db_path()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            conn.commit()

    def upsert_slice(
        self,
        domain: str,
        slice_key: str,
        value: dict[str, Any],
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        source_event: str | None = None,
    ) -> dict[str, Any]:
        now = _now()
        slice_id = str(uuid.uuid4())
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT id, version, value_json FROM world_state_slices
                WHERE tenant_id IS ? AND company_id IS ? AND domain = ? AND slice_key = ?
                """,
                (tenant_id, company_id, domain, slice_key),
            )
            row = cur.fetchone()
            if row:
                slice_id = row["id"]
                version = int(row["version"]) + 1
                conn.execute(
                    """
                    UPDATE world_state_slices
                    SET value_json = ?, version = ?, source_event = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (json.dumps(value, default=str), version, source_event, now, slice_id),
                )
            else:
                version = 1
                conn.execute(
                    """
                    INSERT INTO world_state_slices
                      (id, tenant_id, company_id, domain, slice_key, value_json, version, source_event, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        slice_id,
                        tenant_id,
                        company_id,
                        domain,
                        slice_key,
                        json.dumps(value, default=str),
                        version,
                        source_event,
                        now,
                    ),
                )
            conn.execute(
                """
                INSERT INTO world_state_history (id, slice_id, value_json, version, source_event, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), slice_id, json.dumps(value, default=str), version, source_event, now),
            )
            conn.commit()
        return {
            "id": slice_id,
            "domain": domain,
            "slice_key": slice_key,
            "version": version,
            "updated_at": now,
        }

    def get_slices(
        self,
        domains: list[str],
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not domains:
            return []
        placeholders = ",".join("?" * len(domains))
        params: list[Any] = [tenant_id, company_id, *domains]
        with self._connect() as conn:
            cur = conn.execute(
                f"""
                SELECT domain, slice_key, value_json, version, updated_at, source_event
                FROM world_state_slices
                WHERE tenant_id IS ? AND company_id IS ? AND domain IN ({placeholders})
                ORDER BY domain, slice_key
                """,
                params,
            )
            rows = cur.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            try:
                value = json.loads(row["value_json"] or "{}")
            except Exception:
                value = {}
            out.append({
                "domain": row["domain"],
                "key": row["slice_key"],
                "value": value,
                "version": row["version"],
                "updated_at": row["updated_at"],
                "source_event": row["source_event"],
            })
        return out

    def get_slice_at_version(self, slice_id: str, version: int) -> dict | None:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT value_json, created_at FROM world_state_history
                WHERE slice_id = ? AND version = ?
                """,
                (slice_id, version),
            )
            row = cur.fetchone()
        if not row:
            return None
        return {"value": json.loads(row["value_json"]), "created_at": row["created_at"]}
