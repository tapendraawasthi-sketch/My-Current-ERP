"""Knowledge Runtime CQRS handlers."""

from __future__ import annotations

from typing import Any

from ..commands import IndexKnowledgeCommand, ReembedKnowledgeCommand, RetrieveKnowledgeCommand
from ..projectors.knowledge_projectors import (
    EmbeddingGenerationProjector,
    EvidenceBundleProjector,
    KnowledgeDocumentProjector,
    KnowledgeMetricsProjector,
    RetrievalProjector,
)
from ..queries import GetEvidenceBundleQuery, GetKnowledgeDocumentQuery, GetRetrievalQuery, KnowledgeMetricsQuery
from ..services.knowledge_runtime_service import KnowledgeRuntimeService
from ...domain.entities import KnowledgeDocument
from ...domain.value_objects import AuthorityLevel, DocumentStatus, EffectiveDateRange, KnowledgeHash, RetrievalMode
from datetime import datetime, timezone
import hashlib
import uuid


class RetrieveKnowledgeHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service

    async def __call__(self, command: RetrieveKnowledgeCommand) -> dict[str, Any]:
        mode = RetrievalMode(command.mode) if command.mode else None
        snapshot, bundle = await self._service.retrieve(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            query=command.query,
            jurisdiction=command.jurisdiction,
            as_of=command.as_of,
            mode=mode,
            company_id=command.company_id,
        )
        return {
            "snapshot": snapshot.model_dump(mode="json"),
            "bundle": bundle.model_dump(mode="json"),
        }


class IndexKnowledgeHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service
        self._projector = KnowledgeDocumentProjector()

    async def __call__(self, command: IndexKnowledgeCommand) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        doc_id = str(uuid.uuid4())
        content_hash = hashlib.sha256(command.content.encode()).hexdigest()
        document = KnowledgeDocument(
            document_id=doc_id,
            collection_id=command.collection_id,
            tenant_id=str(command.tenant_id),
            company_id=command.company_id,
            title=command.title,
            content=command.content,
            authority_level=AuthorityLevel(command.authority_level),
            authority_id=f"auth-{command.authority_level}",
            jurisdiction=command.jurisdiction,
            effective_range=EffectiveDateRange(
                effective_from=command.effective_from,
                effective_to=command.effective_to,
            ),
            knowledge_hash=KnowledgeHash(hash_value=content_hash, content_version="1.0"),
            status=DocumentStatus.ACTIVE,
            tags=command.tags,
            metadata=command.metadata,
            created_at=now,
            updated_at=now,
        )
        indexed = await self._service.index_document(tenant_id=str(command.tenant_id), document=document)
        return self._projector.project(indexed).model_dump(mode="json")


class ReembedKnowledgeHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service
        self._projector = EmbeddingGenerationProjector()

    async def __call__(self, command: ReembedKnowledgeCommand) -> dict[str, Any]:
        gen = await self._service.reembed(
            tenant_id=str(command.tenant_id),
            collection_id=command.collection_id,
            campaign_name=command.campaign_name,
        )
        return self._projector.project(gen).model_dump(mode="json")


class GetKnowledgeDocumentHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: GetKnowledgeDocumentQuery) -> dict[str, Any] | None:
        rm = await self._service.get_document_read_model(
            tenant_id=str(query.tenant_id), document_id=query.document_id
        )
        return rm.model_dump(mode="json") if rm else None


class GetEvidenceBundleHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service
        self._projector = EvidenceBundleProjector()

    async def __call__(self, query: GetEvidenceBundleQuery) -> dict[str, Any] | None:
        bundle = await self._service._repository.get_bundle(  # noqa: SLF001
            tenant_id=str(query.tenant_id), bundle_id=query.bundle_id
        )
        return self._projector.project(bundle).model_dump(mode="json") if bundle else None


class GetRetrievalHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service
        self._projector = RetrievalProjector()

    async def __call__(self, query: GetRetrievalQuery) -> dict[str, Any] | None:
        retrieval = await self._service._repository.get_retrieval(  # noqa: SLF001
            tenant_id=str(query.tenant_id), retrieval_id=query.retrieval_id
        )
        return self._projector.project(retrieval).model_dump(mode="json") if retrieval else None


class KnowledgeMetricsHandler:
    def __init__(self, service: KnowledgeRuntimeService) -> None:
        self._service = service
        self._projector = KnowledgeMetricsProjector()

    async def __call__(self, query: KnowledgeMetricsQuery) -> dict[str, Any]:
        metrics = await self._service.get_metrics(tenant_id=str(query.tenant_id))
        return self._projector.project(metrics).model_dump(mode="json")
