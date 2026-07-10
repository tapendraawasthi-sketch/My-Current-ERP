"""Governance audit log — append-only action trail."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = """
CREATE TABLE IF NOT EXISTS governance_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  tenant_id TEXT,
  company_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT '1.0',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gov_audit_tenant ON governance_audit(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gov_audit_action ON governance_audit(action, created_at);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_path() -> Path:
    root = Path(os.getenv("NIOS_DATA_DIR", "data"))
    return root / "nios_governance.sqlite3"


class AuditLog:
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

    def record(
        self,
        action: str,
        *,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        payload: dict | None = None,
        version: str = "1.0",
    ) -> str:
        entry_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO governance_audit
                  (id, action, actor_id, tenant_id, company_id, resource_type, resource_id,
                   payload_json, version, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    action,
                    actor_id,
                    tenant_id,
                    company_id,
                    resource_type,
                    resource_id,
                    json.dumps(payload or {}, default=str),
                    version,
                    _now(),
                ),
            )
            conn.commit()
        return entry_id

    def list_entries(
        self,
        *,
        tenant_id: str | None = None,
        action: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        clauses = ["1=1"]
        params: list[Any] = []
        if tenant_id:
            clauses.append("tenant_id = ?")
            params.append(tenant_id)
        if action:
            clauses.append("action = ?")
            params.append(action)
        where = " AND ".join(clauses)
        params.append(limit)
        with self._connect() as conn:
            cur = conn.execute(
                f"""
                SELECT id, action, actor_id, tenant_id, company_id, resource_type,
                       resource_id, payload_json, version, created_at
                FROM governance_audit WHERE {where}
                ORDER BY created_at DESC LIMIT ?
                """,
                params,
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "action": r["action"],
                "actor_id": r["actor_id"],
                "tenant_id": r["tenant_id"],
                "company_id": r["company_id"],
                "resource_type": r["resource_type"],
                "resource_id": r["resource_id"],
                "payload": json.loads(r["payload_json"] or "{}"),
                "version": r["version"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]


audit_log = AuditLog()
