"""PostgreSQL repository for knowledge documents and jobs."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator, Sequence
from uuid import UUID

from backend.knowledge.config import DATABASE_URL, JOB_MAX_ATTEMPTS
from backend.knowledge.models import (
    DocumentStatus,
    IngestionJob,
    JobStatus,
    KnowledgeDocument,
    ProcessingStage,
)

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeRepository:
    """Synchronous PostgreSQL access for knowledge metadata."""

    def __init__(self, dsn: str | None = None) -> None:
        self._dsn = dsn or DATABASE_URL
        if not self._dsn:
            raise ValueError("DATABASE_URL is required for knowledge pipeline")

    @contextmanager
    def _conn(self) -> Generator[Any, None, None]:
        import psycopg2
        import psycopg2.extras

        conn = psycopg2.connect(self._dsn)
        conn.autocommit = False
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def ensure_schema(self) -> None:
        """Apply knowledge schema if tables are missing."""
        from backend.knowledge.schema.sql_loader import load_schema_sql

        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(load_schema_sql())

    def create_document(self, doc: KnowledgeDocument) -> KnowledgeDocument:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO knowledge_documents (
                      id, tenant_id, company_id, filename, mime_type, size_bytes,
                      r2_original_key, status, processing_stage, requires_ocr,
                      uploaded_by, metadata
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING created_at, updated_at
                    """,
                    (
                        str(doc.id),
                        str(doc.tenant_id),
                        str(doc.company_id),
                        doc.filename,
                        doc.mime_type,
                        doc.size_bytes,
                        doc.r2_original_key,
                        doc.status.value,
                        doc.processing_stage.value,
                        doc.requires_ocr,
                        doc.uploaded_by,
                        json.dumps(doc.metadata),
                    ),
                )
                row = cur.fetchone()
        doc.created_at = row[0]
        doc.updated_at = row[1]
        return doc

    def get_document(self, document_id: UUID) -> KnowledgeDocument | None:
        with self._conn() as conn:
            import psycopg2.extras

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM knowledge_documents WHERE id = %s",
                    (str(document_id),),
                )
                row = cur.fetchone()
        return self._row_to_document(row) if row else None

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
    ) -> None:
        sets = ["status = %s", "processing_stage = %s", "updated_at = NOW()"]
        params: list[Any] = [status, processing_stage]
        if error_message is not None:
            sets.append("error_message = %s")
            params.append(error_message)
        if r2_markdown_key is not None:
            sets.append("r2_markdown_key = %s")
            params.append(r2_markdown_key)
        if chunk_count is not None:
            sets.append("chunk_count = %s")
            params.append(chunk_count)
        if requires_ocr is not None:
            sets.append("requires_ocr = %s")
            params.append(requires_ocr)
        params.append(str(document_id))
        sql = f"UPDATE knowledge_documents SET {', '.join(sets)} WHERE id = %s"
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)

    def list_documents(
        self,
        tenant_id: UUID,
        company_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
    ) -> Sequence[KnowledgeDocument]:
        import psycopg2.extras

        clauses = ["tenant_id = %s", "company_id = %s"]
        params: list[Any] = [str(tenant_id), str(company_id)]
        if status:
            clauses.append("status = %s")
            params.append(status)
        params.extend([limit, offset])
        sql = f"""
            SELECT * FROM knowledge_documents
            WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        return [self._row_to_document(r) for r in rows]

    def get_job(self, job_id: UUID) -> IngestionJob | None:
        import psycopg2.extras

        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM knowledge_ingestion_jobs WHERE id = %s",
                    (str(job_id),),
                )
                row = cur.fetchone()
        return self._row_to_job(row) if row else None

    def mark_job_running(self, job_id: UUID) -> IngestionJob | None:
        import psycopg2.extras

        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    UPDATE knowledge_ingestion_jobs
                    SET status = 'running', started_at = NOW(), attempt = attempt + 1
                    WHERE id = %s AND status IN ('queued', 'retrying')
                    RETURNING *
                    """,
                    (str(job_id),),
                )
                row = cur.fetchone()
        return self._row_to_job(row) if row else None

    def create_job(self, job: IngestionJob) -> IngestionJob:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO knowledge_ingestion_jobs (
                      id, document_id, status, stage, attempt, max_attempts, scheduled_at
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                    RETURNING created_at
                    """,
                    (
                        str(job.id),
                        str(job.document_id),
                        job.status.value,
                        job.stage,
                        job.attempt,
                        job.max_attempts,
                        job.scheduled_at or _utcnow(),
                    ),
                )
                job.created_at = cur.fetchone()[0]
        return job

    def claim_next_job(self) -> IngestionJob | None:
        """Atomically claim the next due job (SKIP LOCKED for horizontal scale)."""
        import psycopg2.extras

        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM knowledge_ingestion_jobs
                    WHERE status IN ('queued', 'retrying')
                      AND scheduled_at <= NOW()
                    ORDER BY scheduled_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                    """
                )
                row = cur.fetchone()
                if not row:
                    return None
                cur.execute(
                    """
                    UPDATE knowledge_ingestion_jobs
                    SET status = 'running', started_at = NOW(), attempt = attempt + 1
                    WHERE id = %s
                    RETURNING *
                    """,
                    (row["id"],),
                )
                updated = cur.fetchone()
        return self._row_to_job(updated) if updated else None

    def update_job(
        self,
        job_id: UUID,
        *,
        status: str,
        stage: str,
        attempt: int | None = None,
        error_message: str | None = None,
        scheduled_at: datetime | None = None,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> None:
        sets = ["status = %s", "stage = %s"]
        params: list[Any] = [status, stage]
        if attempt is not None:
            sets.append("attempt = %s")
            params.append(attempt)
        if error_message is not None:
            sets.append("error_message = %s")
            params.append(error_message)
        if scheduled_at is not None:
            sets.append("scheduled_at = %s")
            params.append(scheduled_at)
        if started_at is not None:
            sets.append("started_at = %s")
            params.append(started_at)
        if finished_at is not None:
            sets.append("finished_at = %s")
            params.append(finished_at)
        params.append(str(job_id))
        sql = f"UPDATE knowledge_ingestion_jobs SET {', '.join(sets)} WHERE id = %s"
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)

    def save_chunks(
        self,
        document_id: UUID,
        tenant_id: UUID,
        company_id: UUID,
        chunks: Sequence[tuple[int, str, str, int, str]],
    ) -> None:
        """Insert chunk rows: (index, chroma_id, text_hash, token_estimate, ...)."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM knowledge_chunks WHERE document_id = %s",
                    (str(document_id),),
                )
                for index, chroma_id, text_hash, token_est, _ in chunks:
                    cur.execute(
                        """
                        INSERT INTO knowledge_chunks (
                          id, document_id, tenant_id, company_id,
                          chunk_index, chroma_id, text_hash, token_estimate
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            str(uuid.uuid4()),
                            str(document_id),
                            str(tenant_id),
                            str(company_id),
                            index,
                            chroma_id,
                            text_hash,
                            token_est,
                        ),
                    )

    def delete_chunks_for_document(self, document_id: UUID) -> None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM knowledge_chunks WHERE document_id = %s",
                    (str(document_id),),
                )

    @staticmethod
    def _row_to_document(row: dict) -> KnowledgeDocument:
        meta = row.get("metadata") or {}
        if isinstance(meta, str):
            meta = json.loads(meta)
        return KnowledgeDocument(
            id=UUID(str(row["id"])),
            tenant_id=UUID(str(row["tenant_id"])),
            company_id=UUID(str(row["company_id"])),
            filename=row["filename"],
            mime_type=row["mime_type"],
            size_bytes=int(row["size_bytes"]),
            r2_original_key=row["r2_original_key"],
            r2_markdown_key=row.get("r2_markdown_key"),
            status=DocumentStatus(row["status"]),
            processing_stage=ProcessingStage(row["processing_stage"]),
            error_message=row.get("error_message"),
            requires_ocr=bool(row.get("requires_ocr")),
            chunk_count=int(row.get("chunk_count") or 0),
            uploaded_by=row.get("uploaded_by"),
            metadata=meta,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    @staticmethod
    def _row_to_job(row: dict) -> IngestionJob:
        return IngestionJob(
            id=UUID(str(row["id"])),
            document_id=UUID(str(row["document_id"])),
            status=JobStatus(row["status"]),
            stage=row["stage"],
            attempt=int(row.get("attempt") or 0),
            max_attempts=int(row.get("max_attempts") or JOB_MAX_ATTEMPTS),
            error_message=row.get("error_message"),
            scheduled_at=row.get("scheduled_at"),
            started_at=row.get("started_at"),
            finished_at=row.get("finished_at"),
            created_at=row.get("created_at"),
        )
