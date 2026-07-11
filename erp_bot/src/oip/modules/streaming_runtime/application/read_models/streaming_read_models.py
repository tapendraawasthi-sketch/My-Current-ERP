"""Streaming Runtime read models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StreamingSessionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    stream_id: str
    workflow_id: str
    conversation_id: str | None = None
    execution_id: str | None = None
    request_id: str
    tenant_id: str
    company_id: str | None = None
    client_id: str
    status: str
    protocol: str
    last_sequence: int = 0
    replay_position: int = 0
    connection_id: str | None = None
    created_at: str
    updated_at: str
    connected_at: str | None = None
    disconnected_at: str | None = None
    closed_at: str | None = None


class ReplayReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    replay_id: str
    stream_id: str
    workflow_id: str
    from_sequence: int
    to_sequence: int
    event_count: int
    events: tuple[dict, ...] = Field(default_factory=tuple)
    started_at: str
    completed_at: str | None = None


class StreamingMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    streams_opened: int = 0
    streams_closed: int = 0
    events_published: int = 0
    replays_started: int = 0
    replays_completed: int = 0
    heartbeats_sent: int = 0
    transport_failures: int = 0
    reconnects: int = 0
    active_sessions: int = 0
