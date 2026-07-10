"""Append-only audit logging for the knowledge pipeline."""

from __future__ import annotations

import json
import logging
import uuid
from uuid import UUID

from backend.knowledge.repository import KnowledgeRepository

logger = logging.getLogger(__name__)


class KnowledgeAuditLogger:
    """Writes pipeline events to ``knowledge_audit_logs``."""

    def __init__(self, repository: KnowledgeRepository | None = None) -> None:
        self._repo = repository

    def _get_repo(self) -> KnowledgeRepository:
        if self._repo is None:
            self._repo = KnowledgeRepository()
        return self._repo

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
    ) -> str:
        entry_id = str(uuid.uuid4())
        try:
            with self._get_repo()._conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO knowledge_audit_logs (
                          id, tenant_id, company_id, document_id, job_id,
                          action, stage, payload
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            entry_id,
                            str(tenant_id) if tenant_id else None,
                            str(company_id) if company_id else None,
                            str(document_id) if document_id else None,
                            str(job_id) if job_id else None,
                            action,
                            stage,
                            json.dumps(payload or {}),
                        ),
                    )
        except Exception as exc:
            logger.error("Audit log write failed action=%s: %s", action, exc)
        return entry_id
