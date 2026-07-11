"""Audit application service — shadow writes Phase 0D."""

from __future__ import annotations

import uuid
from typing import Any

from ...infrastructure.persistence.audit_sqlite import SqliteAuditSinkAdapter
from ...application.ports.outbound.audit_sink_port import AuditSinkPort


class AuditService:
    def __init__(self, sink: AuditSinkPort) -> None:
        self._sink = sink

    async def record(
        self,
        *,
        tenant_id: str,
        request_id: str | None,
        correlation_id: str,
        event_name: str,
        payload_redacted: dict[str, Any],
    ) -> None:
        if isinstance(self._sink, SqliteAuditSinkAdapter):
            await self._sink.append_event(
                record_id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                request_id=request_id,
                correlation_id=correlation_id,
                event_name=event_name,
                payload_redacted=payload_redacted,
            )
            return
        from datetime import datetime, timezone

        from ...application.ports.outbound.audit_sink_port import AuditRecord

        prev = await self._sink.latest_hash(tenant_id)
        record = AuditRecord(
            record_id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event_name,
            payload_redacted=payload_redacted,
            prev_hash=prev,
            record_hash=prev,
            occurred_at=datetime.now(timezone.utc),
        )
        await self._sink.append(record)

    async def get_chain(
        self,
        *,
        tenant_id: str,
        request_id: str | None = None,
        limit: int = 100,
    ):
        return await self._sink.get_chain(
            tenant_id=tenant_id,
            request_id=request_id,
            limit=limit,
        )
