"""FastAPI routes for knowledge document ingestion."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.knowledge.container import get_knowledge_container
from backend.knowledge.models import DocumentStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge/v1", tags=["knowledge"])


class DocumentResponse(BaseModel):
    id: str
    status: str
    processing_stage: str
    filename: str
    mime_type: str
    size_bytes: int
    r2_original_key: str
    chunk_count: int = 0
    error_message: str | None = None
    job_id: str | None = None


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    tenant_id: str
    company_id: str
    k: int = Field(default=8, ge=1, le=50)


class SearchHit(BaseModel):
    id: str
    text: str
    metadata: dict
    distance: float | None = None


@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    company_id: str = Form(...),
    uploaded_by: str | None = Form(None),
) -> DocumentResponse:
    """Upload a document and enqueue knowledge ingestion."""
    try:
        tid = UUID(tenant_id)
        cid = UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid tenant_id or company_id") from exc

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    max_size = 500 * 1024 * 1024  # 500 MB
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail="File exceeds 500MB limit")

    filename = file.filename or "document"
    mime_type = file.content_type or "application/octet-stream"

    container = get_knowledge_container()
    try:
        container.repository.ensure_schema()
    except Exception as exc:
        logger.warning("Schema ensure: %s", exc)

    doc, job = container.orchestrator.ingest_upload(
        tenant_id=tid,
        company_id=cid,
        filename=filename,
        mime_type=mime_type,
        data=data,
        uploaded_by=uploaded_by,
    )
    return DocumentResponse(
        id=str(doc.id),
        status=doc.status.value,
        processing_stage=doc.processing_stage.value,
        filename=doc.filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        r2_original_key=doc.r2_original_key,
        job_id=str(job.id),
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str) -> DocumentResponse:
    """Get document processing status."""
    try:
        did = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document_id") from exc

    container = get_knowledge_container()
    doc = container.repository.get_document(did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(
        id=str(doc.id),
        status=doc.status.value,
        processing_stage=doc.processing_stage.value,
        filename=doc.filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        r2_original_key=doc.r2_original_key,
        chunk_count=doc.chunk_count,
        error_message=doc.error_message,
    )


@router.get("/documents")
def list_documents(
    tenant_id: str,
    company_id: str,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
) -> dict:
    """List documents for a tenant/company (paginated)."""
    try:
        tid, cid = UUID(tenant_id), UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid UUID") from exc

    if status and status not in {s.value for s in DocumentStatus}:
        raise HTTPException(status_code=400, detail="Invalid status filter")

    container = get_knowledge_container()
    docs = container.repository.list_documents(
        tid, cid, limit=min(limit, 200), offset=offset, status=status
    )
    return {
        "count": len(docs),
        "documents": [
            DocumentResponse(
                id=str(d.id),
                status=d.status.value,
                processing_stage=d.processing_stage.value,
                filename=d.filename,
                mime_type=d.mime_type,
                size_bytes=d.size_bytes,
                r2_original_key=d.r2_original_key,
                chunk_count=d.chunk_count,
                error_message=d.error_message,
            ).model_dump()
            for d in docs
        ],
    }


@router.post("/search")
def search_knowledge(req: SearchRequest) -> dict:
    """Semantic search over ingested tenant documents."""
    try:
        tid, cid = UUID(req.tenant_id), UUID(req.company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid UUID") from exc

    container = get_knowledge_container()
    hits = container.orchestrator.search_documents(
        req.query, tenant_id=tid, company_id=cid, k=req.k
    )
    return {
        "query": req.query,
        "hits": [
            SearchHit(
                id=h["id"],
                text=h["text"],
                metadata=h.get("metadata") or {},
                distance=h.get("distance"),
            ).model_dump()
            for h in hits
        ],
    }


@router.get("/health")
def knowledge_health() -> dict:
    """Knowledge pipeline health check."""
    container = get_knowledge_container()
    return {
        "status": "ok",
        "worker_enabled": True,
        "chroma_collection": "tenant_documents",
    }
