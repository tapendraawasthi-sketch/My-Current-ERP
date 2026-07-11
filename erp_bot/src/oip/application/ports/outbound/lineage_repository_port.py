"""Lineage repository port — intelligence lineage DAG."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Sequence

from pydantic import BaseModel, ConfigDict, Field


class LineageNode(BaseModel):
    model_config = ConfigDict(frozen=True)

    node_id: str
    request_id: str
    tenant_id: str
    node_type: str
    parent_node_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class LineageRepositoryPort(ABC):
    @abstractmethod
    async def append(self, node: LineageNode) -> None:
        """Append lineage node (async path allowed per Constitution)."""

    @abstractmethod
    async def get_trace(self, *, tenant_id: str, request_id: str) -> Sequence[LineageNode]:
        """Return ordered lineage trace for request."""
