"""Streaming Runtime domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StreamSessionStatus(str, Enum):
    OPEN = "open"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    REPLAYING = "replaying"
    CLOSED = "closed"


class StreamProtocol(str, Enum):
    SSE = "sse"
    WEBSOCKET = "websocket"


class StreamFeatureMode(str, Enum):
    DISABLED = "disabled"
    SHADOW = "shadow"
    NATIVE = "native"


class WorkflowEventType(str, Enum):
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_PROGRESS = "workflow_progress"
    PROVIDER_CHUNK = "provider_chunk"
    PROVIDER_COMPLETED = "provider_completed"
    QUALITY_STARTED = "quality_started"
    QUALITY_COMPLETED = "quality_completed"
    ACTION_PROPOSED = "action_proposed"
    ACTION_APPROVED = "action_approved"
    ACTION_EXECUTED = "action_executed"
    ACTION_REJECTED = "action_rejected"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"
    HEARTBEAT = "heartbeat"


class StreamEventRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    event_id: str
    stream_id: str
    workflow_id: str
    conversation_id: str | None = None
    request_id: str
    tenant_id: str
    company_id: str | None = None
    sequence: int
    event_type: WorkflowEventType
    timestamp: str
    payload: dict[str, Any] = Field(default_factory=dict)
    checksum: str
    delivered: bool = False
    acked: bool = False


class StreamOffset(BaseModel):
    model_config = ConfigDict(frozen=True)

    offset_id: str
    stream_id: str
    client_id: str
    last_sequence: int
    updated_at: str


class StreamReplayState(BaseModel):
    model_config = ConfigDict(frozen=True)

    replay_id: str
    stream_id: str
    workflow_id: str
    from_sequence: int
    to_sequence: int
    event_count: int
    started_at: str
    completed_at: str | None = None


class TransportConnection(BaseModel):
    model_config = ConfigDict(frozen=True)

    connection_id: str
    stream_id: str
    protocol: StreamProtocol
    client_id: str
    connected_at: str
    active: bool = True


class BackpressureState(BaseModel):
    model_config = ConfigDict(frozen=True)

    stream_id: str
    pending_count: int = 0
    batch_size: int = 10
    paused: bool = False
