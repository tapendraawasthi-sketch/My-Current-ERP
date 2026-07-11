"""Knowledge Runtime HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import IndexKnowledgeCommand, ReembedKnowledgeCommand, RetrieveKnowledgeCommand
from ..application.queries import GetEvidenceBundleQuery, GetKnowledgeDocumentQuery, KnowledgeMetricsQuery

router = APIRouter(prefix="/knowledge", tags=["knowledge-runtime"])


class RetrieveRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    query: str = Field(..., min_length=1)
    jurisdiction: str = Field(default="nepal")
    as_of: str | None = None
    mode: str = Field(default="hybrid")
    company_id: str | None = None


class IndexDocumentRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    collection_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    authority_level: str = Field(default="approved_internal_knowledge")
    jurisdiction: str = Field(default="nepal")
    effective_from: str = Field(default="2020-01-01")
    effective_to: str | None = None
    company_id: str | None = None
    tags: tuple[str, ...] = ()
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReembedRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    collection_id: str | None = None
    campaign_name: str = Field(default="default")


@router.post("/retrieve")
async def retrieve_knowledge(req: RetrieveRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.knowledge_enabled:
        raise HTTPException(status_code=503, detail="Knowledge runtime is disabled")
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        RetrieveKnowledgeCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            query=req.query,
            jurisdiction=req.jurisdiction,
            as_of=req.as_of,
            mode=req.mode,
            company_id=req.company_id,
        )
    )


@router.post("/index")
async def index_document(req: IndexDocumentRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.knowledge_enabled:
        raise HTTPException(status_code=503, detail="Knowledge runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        IndexKnowledgeCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            collection_id=req.collection_id,
            title=req.title,
            content=req.content,
            authority_level=req.authority_level,
            jurisdiction=req.jurisdiction,
            effective_from=req.effective_from,
            effective_to=req.effective_to,
            company_id=req.company_id,
            tags=req.tags,
            metadata=req.metadata,
        )
    )


@router.post("/reembed")
async def reembed_knowledge(req: ReembedRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.knowledge_enabled:
        raise HTTPException(status_code=503, detail="Knowledge runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        ReembedKnowledgeCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            collection_id=req.collection_id,
            campaign_name=req.campaign_name,
        )
    )


@router.get("/documents/{document_id}")
async def get_document(document_id: str, tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    result = await container.query_bus.dispatch(
        GetKnowledgeDocumentQuery(tenant_id=TenantId(tenant_id), document_id=document_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document": result}


@router.get("/bundles/{bundle_id}")
async def get_bundle(bundle_id: str, tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    result = await container.query_bus.dispatch(
        GetEvidenceBundleQuery(tenant_id=TenantId(tenant_id), bundle_id=bundle_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Bundle not found")
    return {"bundle": result}


@router.get("/metrics")
async def knowledge_metrics(tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        KnowledgeMetricsQuery(tenant_id=TenantId(tenant_id))
    )
