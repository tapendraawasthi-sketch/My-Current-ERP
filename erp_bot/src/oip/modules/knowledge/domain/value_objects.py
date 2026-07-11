"""Knowledge Runtime domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuthorityLevel(str, Enum):
    GOVERNMENT = "government"
    ACCOUNTING_STANDARDS = "accounting_standards"
    COMPANY_POLICY = "company_policy"
    APPROVED_INTERNAL = "approved_internal_knowledge"
    VERIFIED_USER = "verified_user_documents"
    WORKING = "working_documents"
    CONVERSATION_MEMORY = "conversation_memory"


class KnowledgeAuthority(BaseModel):
    model_config = ConfigDict(frozen=True)

    authority_id: str
    level: AuthorityLevel
    name: str
    rank: int
    jurisdiction: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Jurisdiction(str, Enum):
    NEPAL = "nepal"
    INDIA = "india"
    IFRS = "ifrs"
    IAS = "ias"
    NFRS = "nfrs"
    CUSTOM = "custom"


class EffectiveDateRange(BaseModel):
    model_config = ConfigDict(frozen=True)

    effective_from: str
    effective_to: str | None = None
    supersedes: str | None = None
    superseded_by: str | None = None
    revision: str = "1.0"


class KnowledgeVersion(BaseModel):
    model_config = ConfigDict(frozen=True)

    version_id: str
    document_id: str
    revision: str
    created_at: str
    content_hash: str


class EmbeddingVersion(BaseModel):
    model_config = ConfigDict(frozen=True)

    embedding_version_id: str
    model_name: str
    model_version: str
    chunk_strategy: str
    created_at: str


class RetrievalScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    lexical: float = 0.0
    semantic: float = 0.0
    authority: float = 0.0
    freshness: float = 0.0


class HybridScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    combined: float
    lexical_weight: float = 0.3
    semantic_weight: float = 0.5
    authority_weight: float = 0.15
    freshness_weight: float = 0.05
    components: RetrievalScore = Field(default_factory=RetrievalScore)


class FreshnessScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    score: float
    age_days: float = 0.0
    effective: bool = True


class EvidenceHash(BaseModel):
    model_config = ConfigDict(frozen=True)

    hash_value: str
    algorithm: str = "sha256"
    document_ids: tuple[str, ...] = Field(default_factory=tuple)


class KnowledgeHash(BaseModel):
    model_config = ConfigDict(frozen=True)

    hash_value: str
    algorithm: str = "sha256"
    content_version: str = ""


class RetrievalMode(str, Enum):
    LEXICAL = "lexical"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"
    AUTHORITY_ONLY = "authority_only"


class RetrievalStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class EmbeddingGenerationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class PoisonReason(str, Enum):
    AUTHORITY_MISMATCH = "authority_mismatch"
    DUPLICATE_CONFLICT = "duplicate_conflict"
    PROMPT_INJECTION = "prompt_injection"
    SUSPICIOUS_METADATA = "suspicious_metadata"
    STALE_DOCUMENT = "stale_document"
    HASH_MISMATCH = "hash_mismatch"


class DocumentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"
    BLOCKED = "blocked"
    ARCHIVED = "archived"
