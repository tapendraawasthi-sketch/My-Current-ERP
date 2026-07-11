"""Memory Runtime CQRS handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    ArchiveMemoryCommand,
    ConsolidateMemoryCommand,
    DeleteMemoryCommand,
    DemoteMemoryCommand,
    ExpireMemoryCommand,
    MergeMemoryCommand,
    PromoteMemoryCommand,
    RecallMemoryCommand,
    StoreMemoryCommand,
    UpdateMemoryCommand,
)
from ..projectors.memory_projectors import MemoryCollectionProjector, MemoryProjector
from ..queries import (
    CollectionsQuery,
    GetMemoryQuery,
    MemoryMetricsQuery,
    PatternSearchQuery,
    RelatedMemoryQuery,
    SearchMemoryQuery,
    StatisticsQuery,
    TimelineQuery,
)
from ..services.memory_runtime_service import MemoryRuntimeService
from ...domain.value_objects import RecallMode


class StoreMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: StoreMemoryCommand) -> dict[str, Any]:
        memory = await self._service.store(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            summary=command.summary,
            content=command.content,
            memory_type=command.memory_type,
            source_module=command.source_module,
            company_id=command.company_id,
            conversation_id=command.conversation_id,
            workflow_id=command.workflow_id,
            importance=command.importance,
            confidence=command.confidence,
            tags=command.tags,
            entities=command.entities,
            metadata=command.metadata,
        )
        return self._projector.project(memory).model_dump(mode="json")


class UpdateMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: UpdateMemoryCommand) -> dict[str, Any]:
        memory = await self._service.update(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
            summary=command.summary,
            content=command.content,
            importance=command.importance,
            confidence=command.confidence,
            tags=command.tags,
            metadata=command.metadata,
        )
        return self._projector.project(memory).model_dump(mode="json")


class MergeMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: MergeMemoryCommand) -> dict[str, Any]:
        memory = await self._service.merge(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            primary_memory_id=command.primary_memory_id,
            secondary_memory_id=command.secondary_memory_id,
            strategy=command.strategy,
        )
        return self._projector.project(memory).model_dump(mode="json")


class ArchiveMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: ArchiveMemoryCommand) -> dict[str, Any]:
        memory = await self._service.archive(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
        )
        return self._projector.project(memory).model_dump(mode="json")


class DeleteMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: DeleteMemoryCommand) -> dict[str, Any]:
        memory = await self._service.delete(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
        )
        return self._projector.project(memory).model_dump(mode="json")


class ExpireMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service

    async def __call__(self, command: ExpireMemoryCommand) -> dict[str, Any]:
        count = await self._service.expire(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
            tenant_wide=command.tenant_wide,
        )
        return {"expired_count": count}


class PromoteMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: PromoteMemoryCommand) -> dict[str, Any]:
        memory = await self._service.promote(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
        )
        return self._projector.project(memory).model_dump(mode="json")


class DemoteMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: DemoteMemoryCommand) -> dict[str, Any]:
        memory = await self._service.demote(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            memory_id=command.memory_id,
        )
        return self._projector.project(memory).model_dump(mode="json")


class ConsolidateMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: ConsolidateMemoryCommand) -> dict[str, Any]:
        memories = await self._service.consolidate(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            request_id=str(command.command_id),
            workflow_id=command.workflow_id,
            conversation_id=command.conversation_id,
            company_id=command.company_id,
        )
        return {"memories": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class RecallMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, command: RecallMemoryCommand) -> dict[str, Any]:
        memories = await self._service.recall(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            query=command.query,
            mode=RecallMode(command.mode),
            company_id=command.company_id,
            conversation_id=command.conversation_id,
            workflow_id=command.workflow_id,
            limit=command.limit,
        )
        return {"memories": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class GetMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, query: GetMemoryQuery) -> dict[str, Any] | None:
        memory = await self._service.get_memory(
            tenant_id=str(query.tenant_id), memory_id=query.memory_id
        )
        return self._projector.project(memory).model_dump(mode="json") if memory else None


class TimelineHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, query: TimelineQuery) -> dict[str, Any]:
        memories = await self._service.get_timeline(
            tenant_id=str(query.tenant_id),
            conversation_id=query.conversation_id,
            workflow_id=query.workflow_id,
            company_id=query.company_id,
            limit=query.limit,
        )
        return {"memories": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class SearchMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, query: SearchMemoryQuery) -> dict[str, Any]:
        memories = await self._service.recall(
            tenant_id=str(query.tenant_id),
            request_id=str(query.correlation_id),
            correlation_id=str(query.correlation_id),
            query=query.query,
            mode=RecallMode(query.mode),
            company_id=query.company_id,
            conversation_id=query.conversation_id,
            limit=query.limit,
        )
        return {"memories": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class PatternSearchHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, query: PatternSearchQuery) -> dict[str, Any]:
        memories = await self._service.list_patterns(
            tenant_id=str(query.tenant_id),
            pattern_type=query.pattern_type,
            limit=query.limit,
        )
        return {"patterns": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class RelatedMemoryHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryProjector()

    async def __call__(self, query: RelatedMemoryQuery) -> dict[str, Any]:
        memories = await self._service.get_related(
            tenant_id=str(query.tenant_id),
            memory_id=query.memory_id,
            limit=query.limit,
        )
        return {"memories": [self._projector.project(m).model_dump(mode="json") for m in memories]}


class MemoryMetricsHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: MemoryMetricsQuery) -> dict[str, Any]:
        metrics = await self._service.get_metrics(
            tenant_id=str(query.tenant_id), metric_date=query.metric_date
        )
        return metrics.model_dump(mode="json")


class CollectionsHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service
        self._projector = MemoryCollectionProjector()

    async def __call__(self, query: CollectionsQuery) -> dict[str, Any]:
        collections = await self._service.list_collections(
            tenant_id=str(query.tenant_id), scope=query.scope
        )
        return {
            "collections": [self._projector.project(c).model_dump(mode="json") for c in collections]
        }


class StatisticsHandler:
    def __init__(self, service: MemoryRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: StatisticsQuery) -> dict[str, Any]:
        stats = await self._service.get_statistics(tenant_id=str(query.tenant_id))
        return stats.model_dump(mode="json")
