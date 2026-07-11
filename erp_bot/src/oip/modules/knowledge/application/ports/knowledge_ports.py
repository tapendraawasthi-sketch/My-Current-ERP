"""Knowledge Runtime ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..read_models.knowledge_read_models import KnowledgeMetricsReadModel
from ...domain.entities import (
    EmbeddingGeneration,
    EvidenceBundle,
    KnowledgeCollection,
    KnowledgeDocument,
    KnowledgeSnapshot,
    RetrievalExecution,
)
from ...domain.value_objects import HybridScore, RetrievalMode


class KnowledgeRepositoryPort(ABC):
    @abstractmethod
    async def save_document(self, document: KnowledgeDocument) -> None: ...

    @abstractmethod
    async def get_document(self, *, tenant_id: str, document_id: str) -> KnowledgeDocument | None: ...

    @abstractmethod
    async def save_collection(self, collection: KnowledgeCollection) -> None: ...

    @abstractmethod
    async def save_retrieval(self, retrieval: RetrievalExecution) -> None: ...

    @abstractmethod
    async def get_retrieval(self, *, tenant_id: str, retrieval_id: str) -> RetrievalExecution | None: ...

    @abstractmethod
    async def save_bundle(self, bundle: EvidenceBundle) -> None: ...

    @abstractmethod
    async def get_bundle(self, *, tenant_id: str, bundle_id: str) -> EvidenceBundle | None: ...

    @abstractmethod
    async def save_snapshot(self, snapshot: KnowledgeSnapshot) -> None: ...

    @abstractmethod
    async def get_snapshot(self, *, tenant_id: str, snapshot_id: str) -> KnowledgeSnapshot | None: ...

    @abstractmethod
    async def save_embedding_generation(self, generation: EmbeddingGeneration) -> None: ...

    @abstractmethod
    async def search_lexical(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]: ...

    @abstractmethod
    async def search_semantic(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]: ...

    @abstractmethod
    async def list_documents_by_jurisdiction(
        self, *, tenant_id: str, jurisdiction: str, as_of: str, authority_levels: tuple[str, ...] | None = None
    ) -> tuple[KnowledgeDocument, ...]: ...

    @abstractmethod
    async def get_cached_retrieval(
        self, *, tenant_id: str, query_hash: str, jurisdiction: str, as_of: str
    ) -> RetrievalExecution | None: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> KnowledgeMetricsReadModel: ...

    @abstractmethod
    async def store_chunk(
        self, *, tenant_id: str, document_id: str, chunk_id: str, content: str, metadata: dict
    ) -> None: ...


class LexicalSearchPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]: ...


class SemanticSearchPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, query: str, jurisdiction: str, as_of: str, limit: int = 50
    ) -> tuple[dict[str, Any], ...]: ...


class HybridRankingPort(ABC):
    @abstractmethod
    async def rank(
        self,
        *,
        lexical_hits: tuple[dict[str, Any], ...],
        semantic_hits: tuple[dict[str, Any], ...],
        authority_registry,
        as_of: str,
    ) -> tuple[dict[str, Any], ...]: ...


class EmbeddingProviderPort(ABC):
    @abstractmethod
    async def embed(self, *, texts: tuple[str, ...], model: str) -> tuple[tuple[float, ...], ...]: ...

    @abstractmethod
    async def store_vectors(
        self, *, tenant_id: str, document_id: str, chunk_id: str, vector: tuple[float, ...], version: str
    ) -> None: ...


class AuthorityRegistryPort(ABC):
    @abstractmethod
    def rank(self, level: str) -> int: ...

    @abstractmethod
    def dominates(self, higher: str, lower: str) -> bool: ...

    @abstractmethod
    def ordered_levels(self) -> tuple[str, ...]: ...


class JurisdictionRegistryPort(ABC):
    @abstractmethod
    def is_valid(self, code: str) -> bool: ...

    @abstractmethod
    def list_packs(self) -> tuple[dict[str, str], ...]: ...


class KnowledgeStoragePort(ABC):
    @abstractmethod
    async def store_chunk(
        self, *, tenant_id: str, document_id: str, chunk_id: str, content: str, metadata: dict
    ) -> None: ...


class KnowledgeSnapshotPort(ABC):
    @abstractmethod
    async def create_from_bundle(
        self, *, retrieval: RetrievalExecution, bundle: EvidenceBundle
    ) -> KnowledgeSnapshot: ...


class KnowledgeRuntimePort(ABC):
    @abstractmethod
    async def retrieve(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        query: str,
        jurisdiction: str = "nepal",
        as_of: str | None = None,
        mode: RetrievalMode | None = None,
        company_id: str | None = None,
    ) -> tuple[KnowledgeSnapshot, EvidenceBundle]: ...

    @abstractmethod
    async def index_document(
        self, *, tenant_id: str, document: KnowledgeDocument
    ) -> KnowledgeDocument: ...

    @abstractmethod
    async def reembed(
        self, *, tenant_id: str, collection_id: str | None, campaign_name: str
    ) -> EmbeddingGeneration: ...
