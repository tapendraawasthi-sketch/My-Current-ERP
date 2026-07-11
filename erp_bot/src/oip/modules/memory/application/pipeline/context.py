"""Memory store pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ...domain.entities import MemoryAggregate, MemoryRecord
from ...domain.value_objects import Importance, MemoryType, RecallMode, RetentionPolicy


@dataclass
class StorePipelineContext:
    tenant_id: str
    request_id: str
    correlation_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    source_module: str = "orchestrator"
    memory_type: MemoryType = MemoryType.CONVERSATION
    summary: str = ""
    content: str = ""
    importance: Importance = Importance.MEDIUM
    confidence: float = 0.8
    tags: tuple[str, ...] = ()
    entities: tuple[dict[str, Any], ...] = ()
    retention_policy: RetentionPolicy | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    normalized_summary: str = ""
    normalized_content: str = ""
    payload_hash: str = ""
    duplicate_memory_id: str | None = None
    embedding_id: str | None = None
    embedding_vector: tuple[float, ...] | None = None
    linked_memory_ids: tuple[str, ...] = ()
    expires_at: datetime | None = None
    memory: MemoryAggregate | None = None
    record: MemoryRecord | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    blocked: bool = False


@dataclass
class RecallPipelineContext:
    tenant_id: str
    request_id: str
    correlation_id: str
    query: str
    mode: RecallMode = RecallMode.HYBRID
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    limit: int = 20
    normalized_query: str = ""
    query_hash: str = ""
    cache_hit: bool = False
    hits: list[dict[str, Any]] = field(default_factory=list)
    memories: tuple[MemoryAggregate, ...] = ()
    latency_ms: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
