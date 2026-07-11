"""Audit sink port — append-only tamper-evident audit (Constitution L5)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    record_id: str
    tenant_id: str
    request_id: str | None
    correlation_id: str
    event_name: str
    payload_redacted: dict[str, Any] = Field(default_factory=dict)
    prev_hash: str
    record_hash: str
    occurred_at: datetime


class AuditSinkPort(ABC):
    @abstractmethod
    async def append(self, record: AuditRecord) -> None:
        """Persist an audit record (hash-chained)."""

    @abstractmethod
    async def get_chain(
        self,
        *,
        tenant_id: str,
        request_id: str | None = None,
        limit: int = 100,
    ) -> list[AuditRecord]:
        """Retrieve audit chain for verification."""

    @abstractmethod
    async def latest_hash(self, tenant_id: str) -> str:
        """Return the latest chain hash for tenant (genesis if empty)."""
