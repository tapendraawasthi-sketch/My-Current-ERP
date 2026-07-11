"""Memory Runtime read models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MemoryReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    memory_id: str
    tenant_id: str
    memory_type: str
    category: str
    summary: str
    importance: str
    freshness: str
    confidence: float
    tags: tuple[str, ...] = Field(default_factory=tuple)
    conversation_id: str | None = None
    workflow_id: str | None = None
    company_id: str | None = None
    archived: bool = False
    created_at: str
    updated_at: str


class MemoryMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    recall_latency_ms_avg: float = 0.0
    hit_ratio: float = 0.0
    cache_ratio: float = 0.0
    merge_ratio: float = 0.0
    duplicate_ratio: float = 0.0
    compression_ratio: float = 0.0
    retention_expiry_count: int = 0
    memory_growth: int = 0
    total_memories: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryCollectionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    collection_id: str
    name: str
    scope: str
    memory_count: int
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None


class MemoryStatisticsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    total_memories: int = 0
    active_memories: int = 0
    archived_memories: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    by_importance: dict[str, int] = Field(default_factory=dict)
    by_freshness: dict[str, int] = Field(default_factory=dict)
