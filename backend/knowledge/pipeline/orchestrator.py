"""Knowledge ingestion orchestrator — coordinates all pipeline stages."""

from __future__ import annotations

import logging
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from backend.knowledge.adapters.chroma_store import chroma_id_for
from backend.knowledge.config import (
    EMBED_BATCH_SIZE,
    JOB_MAX_ATTEMPTS,
    R2_KNOWLEDGE_PREFIX,
)
from backend.knowledge.jobs.retry import compute_retry_delay
from backend.knowledge.models import (
    DocumentStatus,
    IngestionJob,
    JobStatus,
    KnowledgeDocument,
    ProcessingStage,
)
from backend.knowledge.protocols import (
    AuditLogger,
    Chunker,
    DocumentRepository,
    EmbeddingProvider,
    JobQueue,
    ObjectStorage,
    TextExtractor,
    VectorStore,
)

logger = logging.getLogger(__name__)


def _r2_key(
    tenant_id: UUID,
    company_id: UUID,
    document_id: UUID,
    filename: str,
    *,
    suffix: str = "",
) -> str:
    safe_name = filename.replace("\\", "/").split("/")[-1]
    base = f"{R2_KNOWLEDGE_PREFIX}/{tenant_id}/{company_id}/{document_id}"
    if suffix:
        return f"{base}/{suffix}"
    return f"{base}/{safe_name}"


class KnowledgeIngestionOrchestrator:
    """End-to-end document ingestion: R2 → PG → extract → chunk → embed → Chroma."""

    def __init__(
        self,
        *,
        repository: DocumentRepository,
        storage: ObjectStorage,
        extractor: TextExtractor,
        chunker: Chunker,
        embedder: EmbeddingProvider,
        vector_store: VectorStore,
        audit: AuditLogger,
        job_queue: JobQueue,
    ) -> None:
        self._repo = repository
        self._storage = storage
        self._extractor = extractor
        self._chunker = chunker
        self._embedder = embedder
        self._vector_store = vector_store
        self._audit = audit
        self._queue = job_queue

    def ingest_upload(
        self,
        *,
        tenant_id: UUID,
        company_id: UUID,
        filename: str,
        mime_type: str,
        data: bytes,
        uploaded_by: str | None = None,
        metadata: dict | None = None,
    ) -> tuple[KnowledgeDocument, IngestionJob]:
        """Upload original to R2, persist metadata, enqueue background job."""
        document_id = uuid.uuid4()
        r2_key = _r2_key(tenant_id, company_id, document_id, filename)

        self._storage.upload_bytes(
            data,
            r2_key,
            content_type=mime_type,
            metadata={
                "tenant_id": str(tenant_id),
                "company_id": str(company_id),
                "document_id": str(document_id),
                "filename": filename,
            },
        )

        doc = KnowledgeDocument(
            id=document_id,
            tenant_id=tenant_id,
            company_id=company_id,
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(data),
            r2_original_key=r2_key,
            status=DocumentStatus.PENDING,
            processing_stage=ProcessingStage.UPLOADED,
            uploaded_by=uploaded_by,
            metadata=metadata or {},
        )
        doc = self._repo.create_document(doc)

        job = IngestionJob(
            id=uuid.uuid4(),
            document_id=document_id,
            status=JobStatus.QUEUED,
            stage="queued",
            max_attempts=JOB_MAX_ATTEMPTS,
        )
        job = self._repo.create_job(job)
        self._queue.enqueue(job.id)

        self._audit.record(
            "document.uploaded",
            tenant_id=tenant_id,
            company_id=company_id,
            document_id=document_id,
            job_id=job.id,
            stage=ProcessingStage.UPLOADED.value,
            payload={"r2_key": r2_key, "size": len(data), "mime_type": mime_type},
        )
        return doc, job

    def process_job(self, job_id: UUID) -> None:
        """Run full ingestion pipeline for a single job."""
        job = self._repo.get_job(job_id)
        if job is None:
            logger.warning("Job not found: %s", job_id)
            return
        if job.status not in {JobStatus.QUEUED, JobStatus.RETRYING, JobStatus.RUNNING}:
            return

        if job.status != JobStatus.RUNNING:
            job = self._repo.mark_job_running(job_id) or job

        doc = self._repo.get_document(job.document_id)
        if doc is None:
            self._fail_job(job, "Document not found")
            return

        try:
            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.EXTRACTING.value,
            )
            self._audit.record(
                "job.started",
                tenant_id=doc.tenant_id,
                company_id=doc.company_id,
                document_id=doc.id,
                job_id=job.id,
                stage=ProcessingStage.EXTRACTING.value,
            )

            raw = self._storage.download_bytes(doc.r2_original_key)
            extraction = self._extractor.extract(
                raw, mime_type=doc.mime_type, filename=doc.filename
            )

            if extraction.requires_ocr and not extraction.ocr_used:
                self._repo.update_document_status(
                    doc.id,
                    status=DocumentStatus.PROCESSING.value,
                    processing_stage=ProcessingStage.OCR.value,
                    requires_ocr=True,
                )
                self._audit.record(
                    "document.ocr_required",
                    tenant_id=doc.tenant_id,
                    company_id=doc.company_id,
                    document_id=doc.id,
                    job_id=job.id,
                    stage=ProcessingStage.OCR.value,
                )

            md_key = _r2_key(
                doc.tenant_id,
                doc.company_id,
                doc.id,
                doc.filename,
                suffix="extracted.md",
            )
            self._storage.upload_bytes(
                extraction.markdown.encode("utf-8"),
                md_key,
                content_type="text/markdown",
                metadata={"document_id": str(doc.id)},
            )
            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.MARKDOWN_STORED.value,
                r2_markdown_key=md_key,
                requires_ocr=extraction.requires_ocr,
            )
            self._audit.record(
                "document.markdown_stored",
                tenant_id=doc.tenant_id,
                company_id=doc.company_id,
                document_id=doc.id,
                job_id=job.id,
                stage=ProcessingStage.MARKDOWN_STORED.value,
                payload={"r2_markdown_key": md_key, "chars": len(extraction.markdown)},
            )

            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.CHUNKING.value,
            )
            chunks = self._chunker.chunk(extraction.markdown, document_id=doc.id)
            if not chunks:
                raise ValueError("No chunks produced from extracted text")

            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.EMBEDDING.value,
            )
            self._vector_store.delete_by_document(str(doc.id))

            ids: list[str] = []
            texts: list[str] = []
            metadatas: list[dict] = []
            pg_chunks: list[tuple[int, str, str, int, str]] = []

            for ch in chunks:
                cid = chroma_id_for(doc.id, ch.index)
                ids.append(cid)
                texts.append(ch.text)
                meta = {
                    **ch.metadata,
                    "tenant_id": str(doc.tenant_id),
                    "company_id": str(doc.company_id),
                    "document_id": str(doc.id),
                    "filename": doc.filename,
                    "text_hash": ch.text_hash,
                }
                metadatas.append(meta)
                pg_chunks.append((ch.index, cid, ch.text_hash, ch.token_estimate, ch.text))

            all_embeddings: list[list[float]] = []
            for i in range(0, len(texts), EMBED_BATCH_SIZE):
                batch = texts[i : i + EMBED_BATCH_SIZE]
                all_embeddings.extend(self._embedder.embed_documents(batch))

            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.INDEXING.value,
            )
            self._vector_store.upsert_chunks(
                ids=ids,
                embeddings=all_embeddings,
                documents=texts,
                metadatas=metadatas,
            )
            self._repo.save_chunks(
                doc.id, doc.tenant_id, doc.company_id, pg_chunks
            )
            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.COMPLETED.value,
                processing_stage=ProcessingStage.COMPLETED.value,
                chunk_count=len(chunks),
            )
            self._repo.update_job(
                job.id,
                status=JobStatus.COMPLETED.value,
                stage=ProcessingStage.COMPLETED.value,
                finished_at=datetime.now(timezone.utc),
            )
            self._audit.record(
                "document.indexed",
                tenant_id=doc.tenant_id,
                company_id=doc.company_id,
                document_id=doc.id,
                job_id=job.id,
                stage=ProcessingStage.COMPLETED.value,
                payload={"chunk_count": len(chunks)},
            )
            logger.info(
                "Ingestion completed document_id=%s chunks=%d",
                doc.id,
                len(chunks),
            )

        except Exception as exc:
            logger.exception("Ingestion failed job_id=%s", job.id)
            self._handle_failure(job, doc, str(exc))

    def _handle_failure(
        self, job: IngestionJob, doc: KnowledgeDocument, error: str
    ) -> None:
        if job.attempt < job.max_attempts:
            delay = compute_retry_delay(job.attempt)
            retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
            self._repo.update_job(
                job.id,
                status=JobStatus.RETRYING.value,
                stage=ProcessingStage.FAILED.value,
                error_message=error,
                scheduled_at=retry_at,
            )
            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.PROCESSING.value,
                processing_stage=ProcessingStage.FAILED.value,
                error_message=error,
            )
            self._queue.enqueue_retry(job.id, delay)
            self._audit.record(
                "job.retry_scheduled",
                tenant_id=doc.tenant_id,
                company_id=doc.company_id,
                document_id=doc.id,
                job_id=job.id,
                payload={"attempt": job.attempt, "delay_sec": delay, "error": error},
            )
        else:
            self._fail_job(job, error, doc)

    def _fail_job(
        self,
        job: IngestionJob,
        error: str,
        doc: KnowledgeDocument | None = None,
    ) -> None:
        self._repo.update_job(
            job.id,
            status=JobStatus.FAILED.value,
            stage=ProcessingStage.FAILED.value,
            error_message=error,
            finished_at=datetime.now(timezone.utc),
        )
        if doc:
            self._repo.update_document_status(
                doc.id,
                status=DocumentStatus.FAILED.value,
                processing_stage=ProcessingStage.FAILED.value,
                error_message=error,
            )
            self._audit.record(
                "job.failed",
                tenant_id=doc.tenant_id,
                company_id=doc.company_id,
                document_id=doc.id,
                job_id=job.id,
                payload={"error": error},
            )

    def search_documents(
        self,
        query: str,
        *,
        tenant_id: UUID,
        company_id: UUID,
        k: int = 8,
    ) -> list[dict]:
        return self._vector_store.search(
            query,
            tenant_id=str(tenant_id),
            company_id=str(company_id),
            k=k,
        )
