"""Recall strategy implementations registered by mode."""

from __future__ import annotations

import hashlib
import time

from ...application.pipeline.context import RecallPipelineContext
from ...application.ports.memory_ports import (
    CachePort,
    HybridRecallPort,
    LexicalRecallPort,
    MemoryRepositoryPort,
    SemanticRecallPort,
    TimelineRecallPort,
)
from ...domain.entities import MemoryRecallExecution
from ...domain.value_objects import RecallMode


def _hash_query(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode()).hexdigest()


class ExactRecallStrategy:
    name = "exact"

    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        duplicate = await self._repository.find_duplicate(
            tenant_id=context.tenant_id,
            payload_hash=_hash_query(context.normalized_query or context.query),
            memory_type="SemanticMemory",
        )
        if duplicate:
            context.memories = (duplicate,)
        return context


class SemanticRecallStrategy:
    name = "semantic"

    def __init__(self, semantic: SemanticRecallPort) -> None:
        self._semantic = semantic

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        hits = await self._semantic.search(
            tenant_id=context.tenant_id,
            query=context.normalized_query or context.query,
            limit=context.limit,
            company_id=context.company_id,
            conversation_id=context.conversation_id,
            workflow_id=context.workflow_id,
        )
        context.hits = list(hits)
        context.memories = tuple(hit["memory"] for hit in hits)
        return context


class HybridRecallStrategy:
    name = "hybrid"

    def __init__(self, hybrid: HybridRecallPort) -> None:
        self._hybrid = hybrid

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        hits = await self._hybrid.search(
            tenant_id=context.tenant_id,
            query=context.normalized_query or context.query,
            limit=context.limit,
            company_id=context.company_id,
            conversation_id=context.conversation_id,
            workflow_id=context.workflow_id,
        )
        context.hits = list(hits)
        context.memories = tuple(hit["memory"] for hit in hits)
        return context


class TimelineRecallStrategy:
    name = "timeline"

    def __init__(self, timeline: TimelineRecallPort) -> None:
        self._timeline = timeline

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        memories = await self._timeline.recall(
            tenant_id=context.tenant_id,
            limit=context.limit,
            company_id=context.company_id,
            conversation_id=context.conversation_id,
            workflow_id=context.workflow_id,
        )
        context.memories = memories
        return context


class PatternRecallStrategy:
    name = "pattern"

    def __init__(self, repository: MemoryRepositoryPort) -> None:
        self._repository = repository

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        pattern_type = context.metadata.get("pattern_type", "success")
        context.memories = await self._repository.list_patterns(
            tenant_id=context.tenant_id,
            pattern_type=pattern_type,
            limit=context.limit,
        )
        return context


class ContextRecallStrategy:
    name = "context"

    def __init__(self, hybrid: HybridRecallPort, timeline: TimelineRecallPort) -> None:
        self._hybrid = hybrid
        self._timeline = timeline

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext:
        if context.conversation_id or context.workflow_id:
            timeline = await self._timeline.recall(
                tenant_id=context.tenant_id,
                limit=max(5, context.limit // 2),
                conversation_id=context.conversation_id,
                workflow_id=context.workflow_id,
            )
            hits = await self._hybrid.search(
                tenant_id=context.tenant_id,
                query=context.normalized_query or context.query,
                limit=context.limit,
                conversation_id=context.conversation_id,
                workflow_id=context.workflow_id,
            )
            seen: set[str] = set()
            merged = []
            for memory in timeline:
                if memory.memory_id not in seen:
                    seen.add(memory.memory_id)
                    merged.append(memory)
            for hit in hits:
                memory = hit["memory"]
                if memory.memory_id not in seen:
                    seen.add(memory.memory_id)
                    merged.append(memory)
            context.memories = tuple(merged[: context.limit])
        else:
            hits = await self._hybrid.search(
                tenant_id=context.tenant_id,
                query=context.normalized_query or context.query,
                limit=context.limit,
            )
            context.memories = tuple(hit["memory"] for hit in hits)
        return context


def register_recall_strategies(
    registry,
    *,
    repository: MemoryRepositoryPort,
    lexical: LexicalRecallPort,
    semantic: SemanticRecallPort,
    hybrid: HybridRecallPort,
    timeline: TimelineRecallPort,
) -> None:
    registry.register_strategy(ExactRecallStrategy(repository))
    registry.register_strategy(SemanticRecallStrategy(semantic))
    registry.register_strategy(HybridRecallStrategy(hybrid))
    registry.register_strategy(TimelineRecallStrategy(timeline))
    registry.register_strategy(PatternRecallStrategy(repository))
    registry.register_strategy(ContextRecallStrategy(hybrid, timeline))
