"""Lineage repository — SQLite adapter."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Sequence

import aiosqlite

from ...application.ports.outbound.lineage_repository_port import LineageNode, LineageRepositoryPort


class SqliteLineageRepositoryAdapter(LineageRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def append(self, node: LineageNode) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_lineage (
                node_id, request_id, tenant_id, node_type, parent_node_id, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                node.node_id,
                node.request_id,
                node.tenant_id,
                node.node_type,
                node.parent_node_id,
                json.dumps(node.payload),
                node.created_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_trace(self, *, tenant_id: str, request_id: str) -> Sequence[LineageNode]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_lineage
            WHERE tenant_id = ? AND request_id = ?
            ORDER BY created_at ASC
            """,
            (tenant_id, request_id),
        )
        rows = await cursor.fetchall()
        nodes: list[LineageNode] = []
        for row in rows:
            nodes.append(
                LineageNode(
                    node_id=row["node_id"],
                    request_id=row["request_id"],
                    tenant_id=row["tenant_id"],
                    node_type=row["node_type"],
                    parent_node_id=row["parent_node_id"],
                    payload=json.loads(row["payload_json"]),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            )
        return nodes
