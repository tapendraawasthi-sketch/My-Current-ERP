"""Knowledge Runtime read models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeDocumentReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    document_id: str
    collection_id: str
    tenant_id: str
    title: str
    authority_level: str
    jurisdiction: str
    status: str
    effective_from: str
    effective_to: str | None = None
    version: str
    created_at: str
    updated_at: str


class RetrievalReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    retrieval_id: str
    tenant_id: str
    request_id: str
    query: str
    mode: str
    jurisdiction: str
    as_of: str
    status: str
    snapshot_id: str | None = None
    bundle_id: str | None = None
    result_count: int = 0
    blocked_count: int = 0
    cache_hit: bool = False
    created_at: str
    completed_at: str | None = None


class EvidenceBundleReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    bundle_id: str
    retrieval_id: str
    tenant_id: str
    query: str
    jurisdiction: str
    document_ids: tuple[str, ...] = Field(default_factory=tuple)
    evidence_hash: str
    blocked_document_ids: tuple[str, ...] = Field(default_factory=tuple)
    created_at: str


class EmbeddingGenerationReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    generation_id: str
    tenant_id: str
    embedding_model: str
    model_version: str
    chunk_strategy: str
    status: str
    document_count: int = 0
    chunk_count: int = 0
    campaign_name: str = ""
    created_at: str
    completed_at: str | None = None


class KnowledgeMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    retrievals_started: int = 0
    retrievals_completed: int = 0
    documents_indexed: int = 0
    reembed_campaigns: int = 0
    poison_blocked: int = 0
    cache_hits: int = 0
    snapshots_created: int = 0
