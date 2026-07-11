"""Streaming pipeline context — mutable carrier through stages."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...domain.entities import StreamingSession
from ...domain.value_objects import StreamEventRecord, WorkflowEventType


@dataclass
class StreamPipelineContext:
    session: StreamingSession
    event_type: WorkflowEventType
    raw_payload: dict[str, Any]
    request_id: str
    valid: bool = True
    blocked: bool = False
    block_reason: str = ""
    sequence: int | None = None
    record: StreamEventRecord | None = None
    transport_ok: bool = True
    transport_error: str = ""
    acked: bool = False
    audit_events: list[dict[str, Any]] = field(default_factory=list)
    lineage_nodes: list[dict[str, Any]] = field(default_factory=list)
    domain_events: list[dict[str, Any]] = field(default_factory=list)
