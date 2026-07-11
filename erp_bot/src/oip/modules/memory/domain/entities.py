"""Memory Runtime domain aggregates — immutable."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    CollectionScope,
    EntityRef,
    Freshness,
    Importance,
    MemoryCategory,
    MemoryHash,
    MemoryLineage,
    MemoryStatus,
    MemoryType,
    PayloadHash,
    RetentionPolicy,
)


class MemoryAggregate(BaseModel):
    """One logical memory unit owned by OIP Memory Runtime."""

    model_config = ConfigDict(frozen=True)

    memory_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    request_id: str
    memory_type: MemoryType
    category: MemoryCategory
    summary: str
    content: str = ""
    embedding_id: str | None = None
    importance: Importance = Importance.MEDIUM
    confidence: float = 0.8
    freshness: Freshness = Freshness.HOT
    authority: float = 0.5
    tags: tuple[str, ...] = Field(default_factory=tuple)
    entities: tuple[EntityRef, ...] = Field(default_factory=tuple)
    collection_scope: CollectionScope = CollectionScope.WORKFLOW
    retention_policy: RetentionPolicy = RetentionPolicy.CONVERSATION
    memory_hash: MemoryHash | None = None
    status: MemoryStatus = MemoryStatus.ACTIVE
    lineage: MemoryLineage = Field(default_factory=MemoryLineage)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None = None
    archived: bool = False


class MemoryRecord(BaseModel):
    """Immutable snapshot of a memory mutation."""

    model_config = ConfigDict(frozen=True)

    record_id: str
    memory_id: str
    tenant_id: str
    source_module: str
    payload_hash: PayloadHash
    snapshot_pointer: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    lineage: MemoryLineage = Field(default_factory=MemoryLineage)
    sequence: int = 0
    created_at: datetime


class MemoryCollection(BaseModel):
    """Logical grouping of memories."""

    model_config = ConfigDict(frozen=True)

    collection_id: str
    tenant_id: str
    name: str
    scope: CollectionScope
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    memory_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class MemoryLink(BaseModel):
    model_config = ConfigDict(frozen=True)

    link_id: str
    tenant_id: str
    source_memory_id: str
    target_memory_id: str
    link_type: str
    weight: float = 1.0
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class MemoryRecallExecution(BaseModel):
    model_config = ConfigDict(frozen=True)

    recall_id: str
    tenant_id: str
    request_id: str
    correlation_id: str
    query: str
    query_hash: str
    mode: str
    result_count: int = 0
    cache_hit: bool = False
    latency_ms: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
