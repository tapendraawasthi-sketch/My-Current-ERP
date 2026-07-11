"""Streaming Runtime domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import StreamProtocol, StreamSessionStatus


class StreamingSession(BaseModel):
    """Immutable streaming session aggregate."""

    model_config = ConfigDict(frozen=True)

    stream_id: str
    workflow_id: str
    conversation_id: str | None = None
    execution_id: str | None = None
    request_id: str
    tenant_id: str
    company_id: str | None = None
    client_id: str
    status: StreamSessionStatus
    protocol: StreamProtocol
    last_sequence: int = 0
    replay_position: int = 0
    connection_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    connected_at: datetime | None = None
    disconnected_at: datetime | None = None
    closed_at: datetime | None = None
