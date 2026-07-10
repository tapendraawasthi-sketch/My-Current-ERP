"""Domain models for the knowledge pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingStage(str, Enum):
    UPLOADED = "uploaded"
    EXTRACTING = "extracting"
    OCR = "ocr"
    MARKDOWN_STORED = "markdown_stored"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass(slots=True)
class KnowledgeDocument:
    """A user-uploaded knowledge document."""

    id: UUID
    tenant_id: UUID
    company_id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    r2_original_key: str
    status: DocumentStatus
    processing_stage: ProcessingStage
    r2_markdown_key: str | None = None
    error_message: str | None = None
    requires_ocr: bool = False
    chunk_count: int = 0
    uploaded_by: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(slots=True)
class IngestionJob:
    """Background ingestion job for a document."""

    id: UUID
    document_id: UUID
    status: JobStatus
    stage: str
    attempt: int = 0
    max_attempts: int = 5
    error_message: str | None = None
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime | None = None


@dataclass(slots=True)
class TextChunk:
    """A chunk of extracted text ready for embedding."""

    index: int
    text: str
    text_hash: str
    token_estimate: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExtractionResult:
    """Result of text extraction / OCR."""

    markdown: str
    requires_ocr: bool
    ocr_used: bool
    source_mime: str
