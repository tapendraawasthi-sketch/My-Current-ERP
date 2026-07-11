"""Memory Runtime projectors."""

from __future__ import annotations

from ..read_models.memory_read_models import MemoryCollectionReadModel, MemoryReadModel
from ...domain.entities import MemoryAggregate, MemoryCollection


class MemoryProjector:
    def project(self, memory: MemoryAggregate) -> MemoryReadModel:
        return MemoryReadModel(
            memory_id=memory.memory_id,
            tenant_id=memory.tenant_id,
            memory_type=memory.memory_type.value,
            category=memory.category.value,
            summary=memory.summary,
            importance=memory.importance.value,
            freshness=memory.freshness.value,
            confidence=memory.confidence,
            tags=memory.tags,
            conversation_id=memory.conversation_id,
            workflow_id=memory.workflow_id,
            company_id=memory.company_id,
            archived=memory.archived,
            created_at=memory.created_at.isoformat(),
            updated_at=memory.updated_at.isoformat(),
        )


class MemoryCollectionProjector:
    def project(self, collection: MemoryCollection) -> MemoryCollectionReadModel:
        return MemoryCollectionReadModel(
            collection_id=collection.collection_id,
            name=collection.name,
            scope=collection.scope.value,
            memory_count=collection.memory_count,
            company_id=collection.company_id,
            conversation_id=collection.conversation_id,
            workflow_id=collection.workflow_id,
        )
