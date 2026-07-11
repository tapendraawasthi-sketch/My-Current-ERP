"""OEC command execution pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ...domain.entities import (
    CompensationRecord,
    ConnectorTransaction,
    ERPCommandExecution,
    ERPConnector,
)


@dataclass
class ExecutionPipelineContext:
    tenant_id: str
    company_id: str
    branch_id: str | None
    request_id: str
    correlation_id: str
    command_id: str
    command_type: str
    idempotency_key: str
    payload: dict[str, Any] = field(default_factory=dict)
    connector_id: str | None = None
    connector: ERPConnector | None = None
    snapshot: dict[str, Any] | None = None
    execution: ERPCommandExecution | None = None
    transaction: ConnectorTransaction | None = None
    compensation: CompensationRecord | None = None
    response: dict[str, Any] = field(default_factory=dict)
    blocked: bool = False
    duplicate: bool = False
    error: str = ""
    retry_count: int = 0
    started_at: datetime | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
