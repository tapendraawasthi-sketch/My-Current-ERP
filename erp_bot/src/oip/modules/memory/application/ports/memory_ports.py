"""Memory Runtime ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from ..read_models.memory_read_models import (
    MemoryCollectionReadModel,
    MemoryMetricsReadModel,
    MemoryStatisticsReadModel,
)
from ...domain.entities import MemoryAggregate, MemoryCollection, MemoryLink, MemoryRecallExecution, MemoryRecord
from ...domain.value_objects import RecallMode


class MemoryRepositoryPort(ABC):
    @abstractmethod
    async def save_memory(self, memory: MemoryAggregate) -> None: ...

    @abstractmethod
    async def get_memory(self, *, tenant_id: str, memory_id: str) -> MemoryAggregate | None: ...

    @abstractmethod
    async def save_record(self, record: MemoryRecord) -> None: ...

    @abstractmethod
    async def get_records(self, *, tenant_id: str, memory_id: str) -> tuple[MemoryRecord, ...]: ...

    @abstractmethod
    async def save_collection(self, collection: MemoryCollection) -> None: ...

    @abstractmethod
    async def list_collections(
        self, *, tenant_id: str, scope: str | None = None
    ) -> tuple[MemoryCollection, ...]: ...

    @abstractmethod
    async def save_link(self, link: MemoryLink) -> None: ...

    @abstractmethod
    async def get_links(self, *, tenant_id: str, memory_id: str) -> tuple[MemoryLink, ...]: ...

    @abstractmethod
    async def store_embedding(
        self, *, tenant_id: str, memory_id: str, embedding_id: str, vector: tuple[float, ...], model: str
    ) -> None: ...

    @abstractmethod
    async def search_lexical(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]: ...

    @abstractmethod
    async def search_semantic(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]: ...

    @abstractmethod
    async def search_timeline(
        self, *, tenant_id: str, limit: int = 50, **filters: Any
    ) -> tuple[MemoryAggregate, ...]: ...

    @abstractmethod
    async def find_duplicate(
        self, *, tenant_id: str, payload_hash: str, memory_type: str
    ) -> MemoryAggregate | None: ...

    @abstractmethod
    async def save_recall(self, recall: MemoryRecallExecution) -> None: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str, value: float = 1.0) -> None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> MemoryMetricsReadModel: ...

    @abstractmethod
    async def get_statistics(self, *, tenant_id: str) -> MemoryStatisticsReadModel: ...

    @abstractmethod
    async def list_patterns(self, *, tenant_id: str, pattern_type: str, limit: int) -> tuple[MemoryAggregate, ...]: ...

    @abstractmethod
    async def list_failures(self, *, tenant_id: str, limit: int) -> tuple[MemoryAggregate, ...]: ...

    @abstractmethod
    async def expire_due_memories(self, *, tenant_id: str, now: datetime) -> int: ...


class EmbeddingPort(ABC):
    @abstractmethod
    async def embed(self, *, text: str) -> tuple[float, ...]: ...

    @abstractmethod
    async def store(self, *, tenant_id: str, memory_id: str, vector: tuple[float, ...]) -> str: ...


class LexicalRecallPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]: ...


class SemanticRecallPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]: ...


class HybridRecallPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, query: str, limit: int = 20, **filters: Any
    ) -> tuple[dict[str, Any], ...]: ...


class TimelineRecallPort(ABC):
    @abstractmethod
    async def recall(
        self, *, tenant_id: str, limit: int = 50, **filters: Any
    ) -> tuple[MemoryAggregate, ...]: ...


class PatternRecallPort(ABC):
    @abstractmethod
    async def search(
        self, *, tenant_id: str, pattern_type: str, limit: int = 20
    ) -> tuple[MemoryAggregate, ...]: ...


class EntityRecallPort(ABC):
    @abstractmethod
    async def recall_by_entity(
        self, *, tenant_id: str, entity_type: str, entity_id: str, limit: int = 20
    ) -> tuple[MemoryAggregate, ...]: ...


class RetentionPort(ABC):
    @abstractmethod
    def compute_expiry(self, policy: str, created_at: datetime) -> datetime | None: ...


class CompressionPort(ABC):
    @abstractmethod
    def compress(self, content: str) -> tuple[str, float]: ...


class SnapshotPort(ABC):
    @abstractmethod
    def create_pointer(self, *, memory_id: str, sequence: int, payload_hash: str) -> str: ...


class CachePort(ABC):
    @abstractmethod
    async def get(self, key: str) -> tuple[MemoryAggregate, ...] | None: ...

    @abstractmethod
    async def set(self, key: str, memories: tuple[MemoryAggregate, ...], ttl_seconds: int = 300) -> None: ...


class MemoryRuntimePort(ABC):
    @abstractmethod
    async def store(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        summary: str,
        content: str = "",
        memory_type: str = "ConversationMemory",
        source_module: str = "api",
        company_id: str | None = None,
        conversation_id: str | None = None,
        workflow_id: str | None = None,
        importance: str = "Medium",
        confidence: float = 0.8,
        tags: tuple[str, ...] = (),
        entities: tuple[dict[str, Any], ...] = (),
        metadata: dict[str, Any] | None = None,
    ) -> MemoryAggregate: ...

    @abstractmethod
    async def recall(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        query: str,
        mode: RecallMode | str = RecallMode.HYBRID,
        company_id: str | None = None,
        conversation_id: str | None = None,
        workflow_id: str | None = None,
        limit: int = 20,
    ) -> tuple[MemoryAggregate, ...]: ...
