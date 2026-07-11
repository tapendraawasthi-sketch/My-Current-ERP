"""Knowledge Runtime domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    AuthorityLevel,
    DocumentStatus,
    EffectiveDateRange,
    EmbeddingGenerationStatus,
    EmbeddingVersion,
    EvidenceHash,
    HybridScore,
    KnowledgeHash,
    RetrievalMode,
    RetrievalStatus,
)


class KnowledgeDocument(BaseModel):
    model_config = ConfigDict(frozen=True)

    document_id: str
    collection_id: str
    tenant_id: str
    company_id: str | None = None
    title: str
    content: str
    authority_level: AuthorityLevel
    authority_id: str
    jurisdiction: str
    effective_range: EffectiveDateRange
    knowledge_hash: KnowledgeHash
    version: str = "1.0"
    status: DocumentStatus = DocumentStatus.ACTIVE
    tags: tuple[str, ...] = Field(default_factory=tuple)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class KnowledgeCollection(BaseModel):
    model_config = ConfigDict(frozen=True)

    collection_id: str
    tenant_id: str
    name: str
    description: str = ""
    jurisdiction: str
    authority_level: AuthorityLevel
    document_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class EvidenceBundle(BaseModel):
    model_config = ConfigDict(frozen=True)

    bundle_id: str
    retrieval_id: str
    tenant_id: str
    request_id: str
    query: str
    jurisdiction: str
    authority_summary: dict[str, Any] = Field(default_factory=dict)
    document_ids: tuple[str, ...] = Field(default_factory=tuple)
    chunk_ids: tuple[str, ...] = Field(default_factory=tuple)
    evidence_hash: EvidenceHash
    scores: tuple[HybridScore, ...] = Field(default_factory=tuple)
    blocked_document_ids: tuple[str, ...] = Field(default_factory=tuple)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RetrievalExecution(BaseModel):
    model_config = ConfigDict(frozen=True)

    retrieval_id: str
    tenant_id: str
    request_id: str
    correlation_id: str
    query: str
    query_hash: str
    mode: RetrievalMode
    jurisdiction: str
    as_of: str
    status: RetrievalStatus
    snapshot_id: str | None = None
    bundle_id: str | None = None
    result_count: int = 0
    blocked_count: int = 0
    cache_hit: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    completed_at: datetime | None = None


class EmbeddingGeneration(BaseModel):
    model_config = ConfigDict(frozen=True)

    generation_id: str
    tenant_id: str
    collection_id: str | None = None
    embedding_model: str
    embedding_version: EmbeddingVersion
    chunk_strategy: str
    document_count: int = 0
    chunk_count: int = 0
    status: EmbeddingGenerationStatus
    campaign_name: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    completed_at: datetime | None = None


class KnowledgeSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    snapshot_id: str
    retrieval_id: str
    tenant_id: str
    request_id: str
    query_hash: str
    jurisdiction: str
    as_of: str
    authority_summary: dict[str, Any] = Field(default_factory=dict)
    evidence_hashes: tuple[str, ...] = Field(default_factory=tuple)
    embedding_versions: tuple[str, ...] = Field(default_factory=tuple)
    document_ids: tuple[str, ...] = Field(default_factory=tuple)
    bundle_id: str
    immutable: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
