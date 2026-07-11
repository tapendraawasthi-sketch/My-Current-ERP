"""Lineage application service — shadow writes Phase 0D."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ...application.ports.outbound.lineage_repository_port import LineageNode, LineageRepositoryPort


class LineageService:
    def __init__(self, repository: LineageRepositoryPort) -> None:
        self._repository = repository

    async def append_node(
        self,
        *,
        tenant_id: str,
        request_id: str,
        node_type: str,
        parent_node_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> LineageNode:
        node = LineageNode(
            node_id=str(uuid.uuid4()),
            request_id=request_id,
            tenant_id=tenant_id,
            node_type=node_type,
            parent_node_id=parent_node_id,
            payload=payload or {},
            created_at=datetime.now(timezone.utc),
        )
        await self._repository.append(node)
        return node

    async def get_trace(self, *, tenant_id: str, request_id: str):
        return await self._repository.get_trace(tenant_id=tenant_id, request_id=request_id)
