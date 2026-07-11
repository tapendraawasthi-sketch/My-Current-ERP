"""Memory Runtime application service — constitutional recall layer."""

from __future__ import annotations

import hashlib
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from ...domain.entities import MemoryAggregate, MemoryCollection, MemoryRecallExecution, MemoryRecord
from ...domain.events import (
    MemoryArchivedEvent,
    MemoryConsolidatedEvent,
    MemoryDeletedEvent,
    MemoryDemotedEvent,
    MemoryExpiredEvent,
    MemoryMergedEvent,
    MemoryPromotedEvent,
    MemoryRecalledEvent,
    MemoryStoredEvent,
    MemoryUpdatedEvent,
    build_memory_event,
)
from ...domain.importance_registry import ImportanceRegistry, create_default_importance_registry
from ...domain.merge_strategy_registry import MergeStrategyRegistry, create_default_merge_strategy_registry
from ...domain.memory_type_registry import create_default_memory_type_registry
from ...domain.promotion_policy_registry import PromotionPolicyRegistry, create_default_promotion_policy_registry
from ...domain.recall_strategy_registry import RecallStrategyRegistry
from ...domain.retention_registry import create_default_retention_registry
from ...domain.value_objects import (
    CollectionScope,
    EntityRef,
    Freshness,
    Importance,
    MemoryHash,
    MemoryLineage,
    MemoryStatus,
    MemoryType,
    PayloadHash,
    RecallMode,
)
from ..pipeline.context import RecallPipelineContext, StorePipelineContext
from ..pipeline.pipeline import MemoryStorePipeline
from ..ports.memory_ports import CachePort, MemoryRepositoryPort, MemoryRuntimePort
from ..projectors.memory_projectors import MemoryProjector


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_query(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode()).hexdigest()


class MemoryRuntimeService(MemoryRuntimePort):
    def __init__(
        self,
        *,
        store_pipeline: MemoryStorePipeline,
        repository: MemoryRepositoryPort,
        recall_registry: RecallStrategyRegistry,
        cache: CachePort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
    ) -> None:
        self._store_pipeline = store_pipeline
        self._repository = repository
        self._recall_registry = recall_registry
        self._cache = cache
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._projector = MemoryProjector()
        self._type_registry = create_default_memory_type_registry()
        self._importance_registry = create_default_importance_registry()
        self._merge_registry = create_default_merge_strategy_registry()
        retention_registry = create_default_retention_registry()
        self._promotion_registry = create_default_promotion_policy_registry(self._importance_registry)

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
    ) -> MemoryAggregate:
        if not self._settings.memory_enabled:
            raise ValueError("Memory runtime module is disabled")

        context = StorePipelineContext(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            company_id=company_id,
            conversation_id=conversation_id,
            workflow_id=workflow_id,
            source_module=source_module,
            memory_type=MemoryType(memory_type),
            summary=summary,
            content=content,
            importance=Importance(importance),
            confidence=confidence,
            tags=tags,
            entities=entities,
            metadata=metadata or {},
        )
        result = await self._store_pipeline.execute(context)
        memory = result.memory
        if memory is None:
            raise RuntimeError("memory_store_failed")

        event = build_memory_event(
            MemoryStoredEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            memory_id=memory.memory_id,
            payload={"memory_type": memory.memory_type.value, "duplicate": bool(result.duplicate_memory_id)},
        )
        await self._publish(event, request_id)
        await self._audit_mutation(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event.event_type,
            payload=event.payload,
        )
        await self._lineage.append_node(
            tenant_id=tenant_id,
            request_id=request_id,
            node_type="Memory",
            payload={"memory_id": memory.memory_id, "source_module": source_module},
        )
        return memory

    async def update(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        request_id: str,
        memory_id: str,
        summary: str | None = None,
        content: str | None = None,
        importance: str | None = None,
        confidence: float | None = None,
        tags: tuple[str, ...] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> MemoryAggregate:
        existing = await self._repository.get_memory(tenant_id=tenant_id, memory_id=memory_id)
        if existing is None:
            raise ValueError("memory_not_found")
        now = _utc_now()
        updated = existing.model_copy(
            update={
                "summary": summary if summary is not None else existing.summary,
                "content": content if content is not None else existing.content,
                "importance": Importance(importance) if importance else existing.importance,
                "confidence": confidence if confidence is not None else existing.confidence,
                "tags": tags if tags is not None else existing.tags,
                "metadata": {**existing.metadata, **(metadata or {})},
                "updated_at": now,
            }
        )
        await self._repository.save_memory(updated)
        record = MemoryRecord(
            record_id=str(uuid.uuid4()),
            memory_id=memory_id,
            tenant_id=tenant_id,
            source_module="memory_runtime",
            payload_hash=PayloadHash(hash_value=_hash_query(updated.summary + updated.content)),
            snapshot_pointer=f"memory://{memory_id}/update/{now.timestamp()}",
            evidence={"update_fields": [k for k, v in {"summary": summary, "content": content}.items() if v]},
            lineage=updated.lineage,
            sequence=len(await self._repository.get_records(tenant_id=tenant_id, memory_id=memory_id)) + 1,
            created_at=now,
        )
        await self._repository.save_record(record)
        event = build_memory_event(
            MemoryUpdatedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=updated.company_id,
            memory_id=memory_id,
            payload={"record_id": record.record_id},
        )
        await self._publish(event, request_id)
        await self._audit_mutation(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event.event_type,
            payload=event.payload,
        )
        return updated

    async def merge(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        request_id: str,
        primary_memory_id: str,
        secondary_memory_id: str,
        strategy: str = "union",
    ) -> MemoryAggregate:
        primary = await self._repository.get_memory(tenant_id=tenant_id, memory_id=primary_memory_id)
        secondary = await self._repository.get_memory(tenant_id=tenant_id, memory_id=secondary_memory_id)
        if primary is None or secondary is None:
            raise ValueError("memory_not_found")
        merge_strategy = self._merge_registry.get(strategy) or self._merge_registry.get(
            self._merge_registry.default_name()
        )
        assert merge_strategy is not None
        merged_hash = MemoryHash(hash_value=_hash_query(primary.summary + secondary.summary))
        merged_fields = merge_strategy.merge(
            primary,
            secondary,
            merged_summary=f"{primary.summary} | {secondary.summary}",
            merged_hash=merged_hash,
        )
        now = _utc_now()
        merged = primary.model_copy(update={**merged_fields, "updated_at": now, "status": MemoryStatus.ACTIVE})
        await self._repository.save_memory(merged)
        archived_secondary = secondary.model_copy(
            update={"status": MemoryStatus.MERGED, "archived": True, "updated_at": now}
        )
        await self._repository.save_memory(archived_secondary)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="merge_count")
        event = build_memory_event(
            MemoryMergedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=merged.company_id,
            memory_id=merged.memory_id,
            payload={"secondary_memory_id": secondary_memory_id, "strategy": strategy},
        )
        await self._publish(event, request_id)
        return merged

    async def archive(
        self, *, tenant_id: str, correlation_id: str, request_id: str, memory_id: str
    ) -> MemoryAggregate:
        memory = await self._require_memory(tenant_id, memory_id)
        now = _utc_now()
        archived = memory.model_copy(
            update={
                "archived": True,
                "freshness": Freshness.ARCHIVED,
                "status": MemoryStatus.ARCHIVED,
                "updated_at": now,
            }
        )
        await self._repository.save_memory(archived)
        event = build_memory_event(
            MemoryArchivedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=archived.company_id,
            memory_id=memory_id,
            payload={},
        )
        await self._publish(event, request_id)
        return archived

    async def delete(
        self, *, tenant_id: str, correlation_id: str, request_id: str, memory_id: str
    ) -> MemoryAggregate:
        memory = await self._require_memory(tenant_id, memory_id)
        now = _utc_now()
        deleted = memory.model_copy(update={"status": MemoryStatus.DELETED, "updated_at": now})
        await self._repository.save_memory(deleted)
        event = build_memory_event(
            MemoryDeletedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=deleted.company_id,
            memory_id=memory_id,
            payload={},
        )
        await self._publish(event, request_id)
        return deleted

    async def expire(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        request_id: str,
        memory_id: str | None = None,
        tenant_wide: bool = False,
    ) -> int:
        now = _utc_now()
        if tenant_wide:
            count = await self._repository.expire_due_memories(tenant_id=tenant_id, now=now)
        else:
            if memory_id is None:
                raise ValueError("memory_id_required")
            memory = await self._require_memory(tenant_id, memory_id)
            expired = memory.model_copy(update={"status": MemoryStatus.EXPIRED, "updated_at": now})
            await self._repository.save_memory(expired)
            count = 1
        event = build_memory_event(
            MemoryExpiredEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=None,
            memory_id=memory_id or "tenant-wide",
            payload={"count": count},
        )
        await self._publish(event, request_id)
        return count

    async def promote(
        self, *, tenant_id: str, correlation_id: str, request_id: str, memory_id: str
    ) -> MemoryAggregate:
        memory = await self._require_memory(tenant_id, memory_id)
        handler = self._promotion_registry.get_handler("confidence_access")
        policy = self._promotion_registry.get_policy("confidence_access")
        assert handler is not None and policy is not None
        access_count = memory.metadata.get("access_count", 0)
        if not handler.should_promote(
            confidence=memory.confidence, access_count=access_count, definition=policy
        ):
            return memory
        now = _utc_now()
        promoted = memory.model_copy(
            update={
                "importance": handler.promote_importance(memory.importance),
                "freshness": handler.promote_freshness(memory.freshness),
                "updated_at": now,
            }
        )
        await self._repository.save_memory(promoted)
        event = build_memory_event(
            MemoryPromotedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=promoted.company_id,
            memory_id=memory_id,
            payload={"importance": promoted.importance.value},
        )
        await self._publish(event, request_id)
        return promoted

    async def demote(
        self, *, tenant_id: str, correlation_id: str, request_id: str, memory_id: str
    ) -> MemoryAggregate:
        memory = await self._require_memory(tenant_id, memory_id)
        now = _utc_now()
        demoted = memory.model_copy(
            update={
                "importance": self._importance_registry.demote(memory.importance),
                "freshness": Freshness.COLD,
                "updated_at": now,
            }
        )
        await self._repository.save_memory(demoted)
        event = build_memory_event(
            MemoryDemotedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=demoted.company_id,
            memory_id=memory_id,
            payload={"importance": demoted.importance.value},
        )
        await self._publish(event, request_id)
        return demoted

    async def consolidate(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        request_id: str,
        workflow_id: str | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
    ) -> tuple[MemoryAggregate, ...]:
        filters: dict[str, Any] = {}
        if workflow_id:
            filters["workflow_id"] = workflow_id
        if conversation_id:
            filters["conversation_id"] = conversation_id
        if company_id:
            filters["company_id"] = company_id
        memories = await self._repository.search_timeline(tenant_id=tenant_id, limit=100, **filters)
        if len(memories) < 2:
            return memories
        summary = " | ".join(m.summary for m in memories[:5])
        consolidated = await self.store(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            summary=f"Consolidated: {summary[:500]}",
            content="\n".join(m.content for m in memories[:5] if m.content),
            memory_type=MemoryType.SEMANTIC.value,
            source_module="consolidation",
            company_id=company_id,
            conversation_id=conversation_id,
            workflow_id=workflow_id,
            importance=Importance.HIGH.value,
            confidence=0.9,
            tags=("consolidated",),
        )
        event = build_memory_event(
            MemoryConsolidatedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            memory_id=consolidated.memory_id,
            payload={"source_count": len(memories)},
        )
        await self._publish(event, request_id)
        return (consolidated,)

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
    ) -> tuple[MemoryAggregate, ...]:
        if not self._settings.memory_enabled:
            raise ValueError("Memory runtime module is disabled")

        recall_mode = mode if isinstance(mode, RecallMode) else RecallMode(mode)
        normalized = re.sub(r"\s+", " ", query.strip().lower())
        query_hash = _hash_query(normalized)
        cache_key = f"{tenant_id}:{query_hash}:{recall_mode.value}:{conversation_id}:{workflow_id}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            await self._repository.increment_metrics(tenant_id=tenant_id, metric="cache_hits")
            return cached

        started = time.monotonic()
        context = RecallPipelineContext(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            query=query,
            mode=recall_mode,
            company_id=company_id,
            conversation_id=conversation_id,
            workflow_id=workflow_id,
            limit=limit,
            normalized_query=normalized,
            query_hash=query_hash,
        )
        strategy = self._recall_registry.get_strategy(recall_mode)
        if strategy is None:
            raise ValueError(f"unsupported_recall_mode:{recall_mode.value}")
        context = await strategy.recall(context)
        latency_ms = int((time.monotonic() - started) * 1000)
        context.latency_ms = latency_ms

        recall_id = str(uuid.uuid4())
        recall_exec = MemoryRecallExecution(
            recall_id=recall_id,
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            query=query,
            query_hash=query_hash,
            mode=recall_mode.value,
            result_count=len(context.memories),
            cache_hit=False,
            latency_ms=latency_ms,
            created_at=_utc_now(),
        )
        await self._repository.save_recall(recall_exec)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="recall_count")
        if context.memories:
            await self._repository.increment_metrics(tenant_id=tenant_id, metric="recall_hits")
        await self._repository.increment_metrics(
            tenant_id=tenant_id, metric="recall_latency_ms_total", value=float(latency_ms)
        )
        await self._cache.set(cache_key, context.memories)

        event = build_memory_event(
            MemoryRecalledEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            memory_id=recall_id,
            payload={"mode": recall_mode.value, "result_count": len(context.memories), "latency_ms": latency_ms},
        )
        await self._publish(event, request_id)
        return context.memories

    async def get_memory(self, *, tenant_id: str, memory_id: str) -> MemoryAggregate | None:
        return await self._repository.get_memory(tenant_id=tenant_id, memory_id=memory_id)

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None):
        return await self._repository.get_metrics(tenant_id=tenant_id, metric_date=metric_date)

    async def get_statistics(self, *, tenant_id: str):
        return await self._repository.get_statistics(tenant_id=tenant_id)

    async def get_timeline(
        self,
        *,
        tenant_id: str,
        conversation_id: str | None = None,
        workflow_id: str | None = None,
        company_id: str | None = None,
        limit: int = 50,
    ) -> tuple[MemoryAggregate, ...]:
        filters: dict[str, Any] = {}
        if conversation_id:
            filters["conversation_id"] = conversation_id
        if workflow_id:
            filters["workflow_id"] = workflow_id
        if company_id:
            filters["company_id"] = company_id
        return await self._repository.search_timeline(tenant_id=tenant_id, limit=limit, **filters)

    async def get_related(self, *, tenant_id: str, memory_id: str, limit: int = 10) -> tuple[MemoryAggregate, ...]:
        links = await self._repository.get_links(tenant_id=tenant_id, memory_id=memory_id)
        related_ids = [
            link.target_memory_id if link.source_memory_id == memory_id else link.source_memory_id
            for link in links
        ]
        memories: list[MemoryAggregate] = []
        for related_id in related_ids[:limit]:
            memory = await self._repository.get_memory(tenant_id=tenant_id, memory_id=related_id)
            if memory:
                memories.append(memory)
        return tuple(memories)

    async def list_collections(self, *, tenant_id: str, scope: str | None = None):
        return await self._repository.list_collections(tenant_id=tenant_id, scope=scope)

    async def list_patterns(self, *, tenant_id: str, pattern_type: str, limit: int):
        return await self._repository.list_patterns(tenant_id=tenant_id, pattern_type=pattern_type, limit=limit)

    async def list_failures(self, *, tenant_id: str, limit: int):
        return await self._repository.list_failures(tenant_id=tenant_id, limit=limit)

    async def _require_memory(self, tenant_id: str, memory_id: str) -> MemoryAggregate:
        memory = await self._repository.get_memory(tenant_id=tenant_id, memory_id=memory_id)
        if memory is None:
            raise ValueError("memory_not_found")
        return memory

    async def _publish(self, event, request_id: str) -> None:
        envelope = DomainEventEnvelope(event=event, request_id=request_id)
        await self._outbox.enqueue(envelope)

    async def _audit_mutation(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        event_name: str,
        payload: dict,
    ) -> None:
        await self._audit.record(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event_name,
            payload_redacted=payload,
        )
