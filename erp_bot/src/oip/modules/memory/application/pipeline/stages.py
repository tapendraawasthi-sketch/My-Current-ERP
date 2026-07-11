"""Memory store pipeline stages — independently replaceable."""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.conflict_resolver_registry import ConflictResolverRegistry
from ...domain.importance_registry import ImportanceRegistry
from ...domain.memory_type_registry import MemoryTypeRegistry
from ...domain.value_objects import EntityRef, Importance, MemoryCategory, MemoryType, PayloadHash
from ..ports.memory_ports import CompressionPort, EmbeddingPort, MemoryRepositoryPort, RetentionPort, SnapshotPort
from .context import StorePipelineContext


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MemoryStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: StorePipelineContext) -> StorePipelineContext: ...


class NormalizeStage:
    name = "normalize"

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        context.normalized_summary = re.sub(r"\s+", " ", context.summary.strip())
        context.normalized_content = re.sub(r"\s+", " ", context.content.strip())
        context.events.append({"stage": self.name, "summary_len": len(context.normalized_summary)})
        return context


class DeduplicateStage:
    name = "deduplicate"

    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        payload = f"{context.memory_type.value}:{context.normalized_summary}:{context.normalized_content}"
        context.payload_hash = hashlib.sha256(payload.encode()).hexdigest()
        duplicate = await self._repository.find_duplicate(
            tenant_id=context.tenant_id,
            payload_hash=context.payload_hash,
            memory_type=context.memory_type.value,
        )
        if duplicate:
            context.duplicate_memory_id = duplicate.memory_id
            context.memory = duplicate
        context.events.append({"stage": self.name, "duplicate": context.duplicate_memory_id})
        return context


class ClassifyStage:
    name = "classify"

    def __init__(self, type_registry: MemoryTypeRegistry) -> None:
        self._types = type_registry

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id:
            return context
        if context.retention_policy is None:
            context.retention_policy = self._types.resolve_retention(context.memory_type)
        context.events.append(
            {
                "stage": self.name,
                "category": self._types.resolve_category(context.memory_type).value,
            }
        )
        return context


class ImportanceStage:
    name = "importance"

    def __init__(self, importance_registry: ImportanceRegistry) -> None:
        self._importance = importance_registry

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id:
            return context
        weight = self._importance.score_weight(context.importance)
        context.confidence = min(1.0, context.confidence * (0.5 + weight))
        context.events.append({"stage": self.name, "weight": weight})
        return context


class EmbeddingStage:
    name = "embedding"

    def __init__(self, embedding: EmbeddingPort) -> None:
        self._embedding = embedding

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id:
            return context
        text = context.normalized_content or context.normalized_summary
        if not text:
            return context
        vector = await self._embedding.embed(text=text)
        context.embedding_vector = vector
        context.embedding_id = str(uuid.uuid4())
        context.events.append({"stage": self.name, "embedding_id": context.embedding_id})
        return context


class LinkStage:
    name = "link"

    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id:
            return context
        if context.conversation_id:
            related = await self._repository.search_timeline(
                tenant_id=context.tenant_id,
                conversation_id=context.conversation_id,
                limit=5,
            )
            context.linked_memory_ids = tuple(m.memory_id for m in related[:3])
        context.events.append({"stage": self.name, "links": len(context.linked_memory_ids)})
        return context


class RetentionStage:
    name = "retention"

    def __init__(self, retention: RetentionPort) -> None:
        self._retention = retention

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id:
            return context
        policy = context.retention_policy.value if context.retention_policy else "Conversation"
        context.expires_at = self._retention.compute_expiry(policy, _utc_now())
        context.events.append({"stage": self.name, "expires_at": str(context.expires_at)})
        return context


class PersistStage:
    name = "persist"

    def __init__(
        self,
        repository: MemoryRepositoryPort,
        type_registry: MemoryTypeRegistry,
        compression: CompressionPort,
        snapshot: SnapshotPort,
        conflict_registry: ConflictResolverRegistry,
    ) -> None:
        self._repository = repository
        self._types = type_registry
        self._compression = compression
        self._snapshot = snapshot
        self._conflicts = conflict_registry

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        if context.duplicate_memory_id and context.memory:
            await self._repository.increment_metrics(tenant_id=context.tenant_id, metric="duplicate_hits")
            return context

        now = _utc_now()
        memory_id = str(uuid.uuid4())
        compressed_content, ratio = self._compression.compress(context.normalized_content)
        from ...domain.entities import MemoryAggregate, MemoryRecord
        from ...domain.value_objects import Freshness, MemoryHash, MemoryLineage, MemoryStatus

        entities = tuple(
            EntityRef(
                entity_type=e.get("entity_type", "unknown"),
                entity_id=e.get("entity_id", ""),
                label=e.get("label", ""),
                metadata=e.get("metadata", {}),
            )
            for e in context.entities
        )
        memory = MemoryAggregate(
            memory_id=memory_id,
            tenant_id=context.tenant_id,
            company_id=context.company_id,
            conversation_id=context.conversation_id,
            workflow_id=context.workflow_id,
            request_id=context.request_id,
            memory_type=context.memory_type,
            category=self._types.resolve_category(context.memory_type),
            summary=context.normalized_summary,
            content=compressed_content,
            embedding_id=context.embedding_id,
            importance=context.importance,
            confidence=context.confidence,
            freshness=Freshness.HOT,
            tags=context.tags,
            entities=entities,
            retention_policy=context.retention_policy or self._types.resolve_retention(context.memory_type),
            memory_hash=MemoryHash(hash_value=context.payload_hash),
            status=MemoryStatus.ACTIVE,
            lineage=MemoryLineage(
                nodes=("Conversation", "Knowledge", "Memory"),
                source_module=context.source_module,
            ),
            metadata={**context.metadata, "compression_ratio": ratio},
            created_at=now,
            updated_at=now,
            expires_at=context.expires_at,
        )
        await self._repository.save_memory(memory)
        pointer = self._snapshot.create_pointer(
            memory_id=memory_id, sequence=1, payload_hash=context.payload_hash
        )
        record = MemoryRecord(
            record_id=str(uuid.uuid4()),
            memory_id=memory_id,
            tenant_id=context.tenant_id,
            source_module=context.source_module,
            payload_hash=PayloadHash(hash_value=context.payload_hash),
            snapshot_pointer=pointer,
            evidence={"pipeline_events": context.events},
            lineage=memory.lineage,
            sequence=1,
            created_at=now,
        )
        await self._repository.save_record(record)
        if context.embedding_id and context.embedding_vector:
            await self._repository.store_embedding(
                tenant_id=context.tenant_id,
                memory_id=memory_id,
                embedding_id=context.embedding_id,
                vector=context.embedding_vector,
                model="hash-v1",
            )
        for linked_id in context.linked_memory_ids:
            from ...domain.entities import MemoryLink

            link = MemoryLink(
                link_id=str(uuid.uuid4()),
                tenant_id=context.tenant_id,
                source_memory_id=memory_id,
                target_memory_id=linked_id,
                link_type="conversation_context",
                created_at=now,
            )
            await self._repository.save_link(link)
        context.memory = memory
        context.record = record
        context.events.append({"stage": self.name, "memory_id": memory_id})
        return context


class PublishStage:
    name = "publish"

    async def run(self, context: StorePipelineContext) -> StorePipelineContext:
        context.events.append({"stage": self.name, "published": context.memory is not None})
        return context
