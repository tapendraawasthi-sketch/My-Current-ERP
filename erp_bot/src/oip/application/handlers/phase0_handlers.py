"""Command and query handlers for Phase 0."""

from __future__ import annotations

from typing import Any

from ..commands import AppendLineageNodeCommand, RecordShadowAuditCommand, SubmitIntelligenceRequestCommand
from ..queries import GetAuditChainQuery, GetLineageTraceQuery
from ..services.audit_service import AuditService
from ..services.lineage_service import LineageService
from ...domain.events import DomainEvent, DomainEventEnvelope, make_partition_key
from ...application.ports.outbound.outbox_port import OutboxPort


class SubmitIntelligenceRequestHandler:
    """Phase 0: records request accepted event to outbox (no LLM yet)."""

    def __init__(self, outbox: OutboxPort) -> None:
        self._outbox = outbox

    async def __call__(self, command: SubmitIntelligenceRequestCommand) -> dict[str, Any]:
        event = DomainEvent(
            event_type="oip.intelligence.request.accepted.v1",
            tenant_id=command.tenant_id,
            partition_key=make_partition_key(
                str(command.tenant_id),
                command.company_id,
                command.session_id,
            ),
            correlation_id=command.correlation_id,
            payload={
                "session_id": command.session_id,
                "user_id": command.user_id,
                "module": command.module,
                "message_length": len(command.message),
            },
        )
        message_id = await self._outbox.enqueue(DomainEventEnvelope(event=event))
        return {"status": "accepted", "outbox_message_id": message_id}


class RecordShadowAuditHandler:
    def __init__(self, audit: AuditService) -> None:
        self._audit = audit

    async def __call__(self, command: RecordShadowAuditCommand) -> None:
        await self._audit.record(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            event_name=command.event_name,
            payload_redacted=command.payload,
        )


class AppendLineageNodeHandler:
    def __init__(self, lineage: LineageService) -> None:
        self._lineage = lineage

    async def __call__(self, command: AppendLineageNodeCommand) -> dict[str, str]:
        node = await self._lineage.append_node(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            node_type=command.node_type,
            parent_node_id=command.parent_node_id,
            payload=command.payload,
        )
        return {"node_id": node.node_id}


class GetLineageTraceHandler:
    def __init__(self, lineage: LineageService) -> None:
        self._lineage = lineage

    async def __call__(self, query: GetLineageTraceQuery) -> list[dict]:
        nodes = await self._lineage.get_trace(
            tenant_id=str(query.tenant_id),
            request_id=str(query.request_id),
        )
        return [n.model_dump(mode="json") for n in nodes]


class GetAuditChainHandler:
    def __init__(self, audit: AuditService) -> None:
        self._audit = audit

    async def __call__(self, query: GetAuditChainQuery) -> list[dict]:
        records = await self._audit.get_chain(
            tenant_id=str(query.tenant_id),
            request_id=str(query.request_id) if query.request_id else None,
            limit=query.limit,
        )
        return [r.model_dump(mode="json") for r in records]
