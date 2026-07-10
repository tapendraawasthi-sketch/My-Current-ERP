"""Protocols for loosely-coupled knowledge pipeline components."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from backend.knowledge.models import (
    ExtractionResult,
    IngestionJob,
    KnowledgeDocument,
    TextChunk,
)


@runtime_checkable
class DocumentRepository(Protocol):
    """PostgreSQL document metadata store."""

    def create_document(self, doc: KnowledgeDocument) -> KnowledgeDocument: ...

    def get_document(self, document_id: UUID) -> KnowledgeDocument | None: ...

    def update_document_status(
        self,
        document_id: UUID,
        *,
        status: str,
        processing_stage: str,
        error_message: str | None = None,
        r2_markdown_key: str | None = None,
        chunk_count: int | None = None,
        requires_ocr: bool | None = None,
    ) -> None: ...

    def list_documents(
        self,
        tenant_id: UUID,
        company_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
    ) -> Sequence[KnowledgeDocument]: ...

    def create_job(self, job: IngestionJob) -> IngestionJob: ...

    def claim_next_job(self) -> IngestionJob | None: ...

    def update_job(
        self,
        job_id: UUID,
        *,
        status: str,
        stage: str,
        attempt: int | None = None,
        error_message: str | None = None,
        scheduled_at: Any = None,
        started_at: Any = None,
        finished_at: Any = None,
    ) -> None: ...

    def save_chunks(
        self,
        document_id: UUID,
        tenant_id: UUID,
        company_id: UUID,
        chunks: Sequence[tuple[int, str, str, int, str]],
    ) -> None: ...

    def delete_chunks_for_document(self, document_id: UUID) -> None: ...


@runtime_checkable
class ObjectStorage(Protocol):
    """Object storage for originals and derived markdown."""

    def upload_bytes(
        self, data: bytes, key: str, *, content_type: str, metadata: dict | None
    ) -> str: ...

    def download_bytes(self, key: str) -> bytes: ...

    def upload_file(self, local_path: str, key: str, *, content_type: str) -> str: ...


@runtime_checkable
class TextExtractor(Protocol):
    """Extracts markdown text from raw file bytes."""

    def extract(
        self, data: bytes, *, mime_type: str, filename: str
    ) -> ExtractionResult: ...


@runtime_checkable
class Chunker(Protocol):
    """Splits markdown into chunks."""

    def chunk(self, markdown: str, *, document_id: UUID) -> list[TextChunk]: ...


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Generates vector embeddings."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...


@runtime_checkable
class VectorStore(Protocol):
    """Stores and searches document embeddings."""

    def upsert_chunks(
        self,
        *,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None: ...

    def delete_by_document(self, document_id: str) -> None: ...

    def search(
        self,
        query: str,
        *,
        tenant_id: str,
        company_id: str,
        k: int = 8,
    ) -> list[dict]: ...


@runtime_checkable
class AuditLogger(Protocol):
    """Append-only audit trail for pipeline events."""

    def record(
        self,
        action: str,
        *,
        tenant_id: UUID | None = None,
        company_id: UUID | None = None,
        document_id: UUID | None = None,
        job_id: UUID | None = None,
        stage: str | None = None,
        payload: dict | None = None,
    ) -> str: ...


@runtime_checkable
class JobQueue(Protocol):
    """Enqueue ingestion jobs for background processing."""

    def enqueue(self, job_id: UUID, *, delay_sec: float = 0) -> None: ...

    def dequeue(self, timeout_sec: float = 2.0) -> UUID | None: ...

    def enqueue_retry(self, job_id: UUID, delay_sec: float) -> None: ...
