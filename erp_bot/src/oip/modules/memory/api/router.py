"""Memory Runtime HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import (
    ArchiveMemoryCommand,
    ConsolidateMemoryCommand,
    RecallMemoryCommand,
    StoreMemoryCommand,
)
from ..application.queries import GetMemoryQuery, MemoryMetricsQuery, PatternSearchQuery, TimelineQuery

router = APIRouter(prefix="/memory", tags=["memory-runtime"])


class StoreMemoryRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    summary: str = Field(..., min_length=1)
    content: str = ""
    memory_type: str = Field(default="ConversationMemory")
    source_module: str = Field(default="api")
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    importance: str = Field(default="Medium")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    tags: tuple[str, ...] = ()
    entities: tuple[dict[str, Any], ...] = ()
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecallMemoryRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    query: str = Field(..., min_length=1)
    mode: str = Field(default="Hybrid")
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class ConsolidateMemoryRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    workflow_id: str | None = None
    conversation_id: str | None = None
    company_id: str | None = None


class ArchiveMemoryRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    memory_id: str


@router.post("/store")
async def store_memory(req: StoreMemoryRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.memory_enabled:
        raise HTTPException(status_code=503, detail="Memory runtime is disabled")
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        StoreMemoryCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            summary=req.summary,
            content=req.content,
            memory_type=req.memory_type,
            source_module=req.source_module,
            company_id=req.company_id,
            conversation_id=req.conversation_id,
            workflow_id=req.workflow_id,
            importance=req.importance,
            confidence=req.confidence,
            tags=req.tags,
            entities=req.entities,
            metadata=req.metadata,
        )
    )


@router.post("/recall")
async def recall_memory(req: RecallMemoryRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.memory_enabled:
        raise HTTPException(status_code=503, detail="Memory runtime is disabled")
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        RecallMemoryCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            query=req.query,
            mode=req.mode,
            company_id=req.company_id,
            conversation_id=req.conversation_id,
            workflow_id=req.workflow_id,
            limit=req.limit,
        )
    )


@router.get("/timeline")
async def memory_timeline(
    tenant_id: str = "tenant-a",
    conversation_id: str | None = None,
    workflow_id: str | None = None,
    company_id: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        TimelineQuery(
            tenant_id=TenantId(tenant_id),
            conversation_id=conversation_id,
            workflow_id=workflow_id,
            company_id=company_id,
            limit=limit,
        )
    )


@router.get("/patterns")
async def memory_patterns(
    tenant_id: str = "tenant-a",
    pattern_type: str = "success",
    limit: int = 20,
) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        PatternSearchQuery(tenant_id=TenantId(tenant_id), pattern_type=pattern_type, limit=limit)
    )


@router.get("/metrics")
async def memory_metrics(tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        MemoryMetricsQuery(tenant_id=TenantId(tenant_id))
    )


@router.post("/consolidate")
async def consolidate_memory(req: ConsolidateMemoryRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.memory_enabled:
        raise HTTPException(status_code=503, detail="Memory runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        ConsolidateMemoryCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            workflow_id=req.workflow_id,
            conversation_id=req.conversation_id,
            company_id=req.company_id,
        )
    )


@router.post("/archive")
async def archive_memory(req: ArchiveMemoryRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.memory_enabled:
        raise HTTPException(status_code=503, detail="Memory runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        ArchiveMemoryCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            memory_id=req.memory_id,
        )
    )


@router.get("/{memory_id}")
async def get_memory(memory_id: str, tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    result = await container.query_bus.dispatch(
        GetMemoryQuery(tenant_id=TenantId(tenant_id), memory_id=memory_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"memory": result}
