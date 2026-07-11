"""Application commands — write-side intent (CQRS)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ...shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Command(BaseModel):
    """Base command — all write operations inherit."""

    model_config = ConfigDict(frozen=True)

    command_id: str = Field(default_factory=lambda: str(new_request_id()))
    command_type: str = ""
    tenant_id: TenantId
    correlation_id: CorrelationId = Field(default_factory=new_correlation_id)
    idempotency_key: str = ""
    occurred_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SubmitIntelligenceRequestCommand(Command):
    command_type: str = "oip.command.intelligence.submit_request.v1"
    session_id: str
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    module: str
    language: str | None = None
    message: str
    attachments: tuple[dict[str, Any], ...] = Field(default_factory=tuple)


class RecordShadowAuditCommand(Command):
    command_type: str = "oip.command.audit.record_shadow.v1"
    request_id: RequestId
    event_name: str
    payload: dict[str, Any] = Field(default_factory=dict)


class AppendLineageNodeCommand(Command):
    command_type: str = "oip.command.lineage.append_node.v1"
    request_id: RequestId
    node_type: str
    parent_node_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
