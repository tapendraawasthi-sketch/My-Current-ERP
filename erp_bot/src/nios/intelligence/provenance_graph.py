"""Provenance Graph — append-only evidence lineage."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = """
CREATE TABLE IF NOT EXISTS provenance_nodes (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  statement TEXT NOT NULL,
  source TEXT NOT NULL,
  capability_id TEXT,
  session_id TEXT,
  tenant_id TEXT,
  company_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prov_evidence ON provenance_nodes(evidence_id);
CREATE INDEX IF NOT EXISTS idx_prov_session ON provenance_nodes(session_id, created_at);

CREATE TABLE IF NOT EXISTS provenance_edges (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prov_child ON provenance_edges(child_id);
CREATE INDEX IF NOT EXISTS idx_prov_parent ON provenance_edges(parent_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_path() -> Path:
    return Path(os.getenv("NIOS_DATA_DIR", "data")) / "nios_provenance.sqlite3"


class ProvenanceGraph:
    """Track derives_from / cites / validates lineage between evidence objects."""

    RELATIONS = ("derives_from", "cites", "validates", "contradicts")

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

    def record_evidence(
        self,
        evidence_id: str,
        evidence_type: str,
        statement: str,
        source: str,
        *,
        capability_id: str | None = None,
        session_id: str | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        metadata: dict | None = None,
        parent_ids: list[str] | None = None,
        relation: str = "derives_from",
    ) -> str:
        node_id = str(uuid.uuid4())
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO provenance_nodes
                  (id, evidence_id, evidence_type, statement, source, capability_id,
                   session_id, tenant_id, company_id, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node_id,
                    evidence_id,
                    evidence_type,
                    statement[:2000],
                    source,
                    capability_id,
                    session_id,
                    tenant_id,
                    company_id,
                    json.dumps(metadata or {}, default=str),
                    now,
                ),
            )
            for parent_id in parent_ids or []:
                conn.execute(
                    """
                    INSERT INTO provenance_edges (id, child_id, parent_id, relation, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (str(uuid.uuid4()), node_id, parent_id, relation, now),
                )
            conn.commit()
        return node_id

    def lineage(self, node_id: str, *, depth: int = 5) -> list[dict[str, Any]]:
        chain: list[dict[str, Any]] = []
        visited: set[str] = set()
        frontier = [node_id]

        for _ in range(depth):
            if not frontier:
                break
            next_frontier: list[str] = []
            for nid in frontier:
                if nid in visited:
                    continue
                visited.add(nid)
                node = self._get_node(nid)
                if node:
                    chain.append(node)
                for parent_id in self._parents(nid):
                    next_frontier.append(parent_id)
            frontier = next_frontier
        return chain

    def coverage_for_session(self, session_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT evidence_type, COUNT(*) as cnt
                FROM provenance_nodes WHERE session_id = ?
                GROUP BY evidence_type
                """,
                (session_id,),
            )
            rows = cur.fetchall()
        total = sum(r["cnt"] for r in rows)
        with_lineage = 0
        if total:
            with self._connect() as conn:
                cur = conn.execute(
                    """
                    SELECT COUNT(DISTINCT child_id) FROM provenance_edges
                    WHERE child_id IN (
                      SELECT id FROM provenance_nodes WHERE session_id = ?
                    )
                    """,
                    (session_id,),
                )
                with_lineage = cur.fetchone()[0]
        coverage = (with_lineage / total) if total else 0.0
        return {
            "session_id": session_id,
            "total_evidence": total,
            "with_lineage": with_lineage,
            "lineage_coverage": round(coverage, 3),
            "by_type": {r["evidence_type"]: r["cnt"] for r in rows},
        }

    def _get_node(self, node_id: str) -> dict | None:
        with self._connect() as conn:
            cur = conn.execute("SELECT * FROM provenance_nodes WHERE id = ?", (node_id,))
            row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "evidence_id": row["evidence_id"],
            "evidence_type": row["evidence_type"],
            "statement": row["statement"],
            "source": row["source"],
            "capability_id": row["capability_id"],
            "created_at": row["created_at"],
        }

    def _parents(self, child_id: str) -> list[str]:
        with self._connect() as conn:
            cur = conn.execute(
                "SELECT parent_id FROM provenance_edges WHERE child_id = ?",
                (child_id,),
            )
            return [r["parent_id"] for r in cur.fetchall()]


provenance_graph = ProvenanceGraph()
