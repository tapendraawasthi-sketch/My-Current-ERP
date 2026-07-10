"""Knowledge Graph store — temporal nodes/edges with SQLite backend."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_db_path() -> Path:
    root = Path(os.getenv("NIOS_DATA_DIR", "data"))
    return root / "nios_knowledge_graph.sqlite3"


class KnowledgeGraphStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _default_db_path()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        schema_path = Path(__file__).with_name("schema.sql")
        with self._connect() as conn:
            conn.executescript(schema_path.read_text(encoding="utf-8"))
            conn.commit()

    def add_node(
        self,
        label: str,
        node_type: str,
        *,
        properties: dict | None = None,
        tenant_id: str | None = None,
        company_id: str | None = None,
        valid_from: str | None = None,
        valid_until: str | None = None,
    ) -> str:
        node_id = str(uuid.uuid4())
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO kg_nodes
                  (id, label, node_type, properties_json, tenant_id, company_id,
                   valid_from, valid_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node_id,
                    label,
                    node_type,
                    json.dumps(properties or {}, default=str),
                    tenant_id,
                    company_id,
                    valid_from or now,
                    valid_until,
                    now,
                ),
            )
            conn.commit()
        return node_id

    def add_edge(
        self,
        from_id: str,
        to_id: str,
        relation: str,
        *,
        properties: dict | None = None,
        tenant_id: str | None = None,
        valid_from: str | None = None,
        valid_until: str | None = None,
    ) -> str:
        edge_id = str(uuid.uuid4())
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO kg_edges
                  (id, from_id, to_id, relation, properties_json, tenant_id,
                   valid_from, valid_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    edge_id,
                    from_id,
                    to_id,
                    relation,
                    json.dumps(properties or {}, default=str),
                    tenant_id,
                    valid_from or now,
                    valid_until,
                    now,
                ),
            )
            conn.commit()
        return edge_id

    def find_nodes(
        self,
        *,
        node_type: str | None = None,
        label_contains: str | None = None,
        as_of: str | None = None,
        tenant_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        as_of = as_of or _now()
        clauses = ["(valid_until IS NULL OR valid_until > ?)", "valid_from <= ?"]
        params: list[Any] = [as_of, as_of]
        if tenant_id is not None:
            clauses.append("(tenant_id IS NULL OR tenant_id = ?)")
            params.append(tenant_id)
        if node_type:
            clauses.append("node_type = ?")
            params.append(node_type)
        if label_contains:
            clauses.append("label LIKE ?")
            params.append(f"%{label_contains}%")
        where = " AND ".join(clauses)
        params.append(limit)
        with self._connect() as conn:
            cur = conn.execute(
                f"""
                SELECT id, label, node_type, properties_json, valid_from, valid_until
                FROM kg_nodes WHERE {where} ORDER BY created_at DESC LIMIT ?
                """,
                params,
            )
            rows = cur.fetchall()
        return [self._row_node(r) for r in rows]

    def traverse(
        self,
        start_id: str,
        relation: str | None = None,
        *,
        as_of: str | None = None,
        depth: int = 2,
    ) -> list[dict[str, Any]]:
        as_of = as_of or _now()
        visited: set[str] = set()
        frontier = [start_id]
        results: list[dict[str, Any]] = []

        for _ in range(depth):
            if not frontier:
                break
            next_frontier: list[str] = []
            for node_id in frontier:
                if node_id in visited:
                    continue
                visited.add(node_id)
                edges = self._edges_from(node_id, relation, as_of)
                for edge in edges:
                    results.append(edge)
                    next_frontier.append(edge["to_id"])
            frontier = next_frontier
        return results

    def _edges_from(self, from_id: str, relation: str | None, as_of: str) -> list[dict]:
        clauses = [
            "from_id = ?",
            "(valid_until IS NULL OR valid_until > ?)",
            "valid_from <= ?",
        ]
        params: list[Any] = [from_id, as_of, as_of]
        if relation:
            clauses.append("relation = ?")
            params.append(relation)
        where = " AND ".join(clauses)
        with self._connect() as conn:
            cur = conn.execute(
                f"SELECT id, from_id, to_id, relation, properties_json FROM kg_edges WHERE {where}",
                params,
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "from_id": r["from_id"],
                "to_id": r["to_id"],
                "relation": r["relation"],
                "properties": json.loads(r["properties_json"] or "{}"),
            }
            for r in rows
        ]

    def _row_node(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "label": row["label"],
            "node_type": row["node_type"],
            "properties": json.loads(row["properties_json"] or "{}"),
            "valid_from": row["valid_from"],
            "valid_until": row["valid_until"],
        }

    def record_observation(
        self,
        observation_type: str,
        payload: dict,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        session_id: str | None = None,
    ) -> str:
        obs_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO kg_observations
                  (id, observation_type, payload_json, tenant_id, company_id, session_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    obs_id,
                    observation_type,
                    json.dumps(payload, default=str),
                    tenant_id,
                    company_id,
                    session_id,
                    _now(),
                ),
            )
            conn.commit()
        return obs_id
