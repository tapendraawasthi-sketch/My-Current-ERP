"""Unit tests for knowledge pipeline components."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from backend.knowledge.jobs.queue import InMemoryJobQueue
from backend.knowledge.jobs.retry import compute_retry_delay
from backend.knowledge.models import ExtractionResult
from backend.knowledge.pipeline.chunker import MarkdownChunker
from backend.knowledge.pipeline.extractors import DocumentTextExtractor
from backend.knowledge.pipeline.orchestrator import KnowledgeIngestionOrchestrator


class TestChunker:
    def test_chunks_markdown(self) -> None:
        md = "# Title\n\n" + ("word " * 400)
        chunks = MarkdownChunker(chunk_size=200, chunk_overlap=20).chunk(
            md, document_id=uuid.uuid4()
        )
        assert len(chunks) >= 2
        assert all(c.text_hash for c in chunks)


class TestExtractor:
    def test_plain_text(self) -> None:
        result = DocumentTextExtractor().extract(
            b"Hello knowledge base",
            mime_type="text/plain",
            filename="note.txt",
        )
        assert "Hello knowledge base" in result.markdown


class TestRetry:
    def test_exponential_delay(self) -> None:
        assert compute_retry_delay(1) < compute_retry_delay(3)


class TestJobQueue:
    def test_enqueue_dequeue(self) -> None:
        q = InMemoryJobQueue()
        job_id = uuid.uuid4()
        q.enqueue(job_id)
        assert q.dequeue(timeout_sec=1.0) == job_id


class TestOrchestratorUpload:
    def test_ingest_upload_enqueues(self) -> None:
        repo = MagicMock()
        storage = MagicMock()
        storage.upload_bytes.return_value = "key"
        queue = InMemoryJobQueue()
        audit = MagicMock()

        doc_id = uuid.uuid4()
        repo.create_document.side_effect = lambda d: d
        repo.create_job.side_effect = lambda j: j

        orch = KnowledgeIngestionOrchestrator(
            repository=repo,
            storage=storage,
            extractor=DocumentTextExtractor(),
            chunker=MarkdownChunker(),
            embedder=MagicMock(),
            vector_store=MagicMock(),
            audit=audit,
            job_queue=queue,
        )

        tid, cid = uuid.uuid4(), uuid.uuid4()
        doc, job = orch.ingest_upload(
            tenant_id=tid,
            company_id=cid,
            filename="test.txt",
            mime_type="text/plain",
            data=b"# Doc\n\nSample content for testing pipeline.",
        )
        assert doc.r2_original_key
        storage.upload_bytes.assert_called_once()
        repo.create_document.assert_called_once()
        repo.create_job.assert_called_once()
        audit.record.assert_called()
        assert queue.dequeue(timeout_sec=0.1) == job.id
