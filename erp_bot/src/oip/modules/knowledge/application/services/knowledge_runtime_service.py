"""Knowledge Runtime application service — retrieval only, never reasons."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from ...domain.entities import (
    EmbeddingGeneration,
    EvidenceBundle,
    KnowledgeCollection,
    KnowledgeDocument,
    KnowledgeSnapshot,
    RetrievalExecution,
)
from ...domain.events import (
    EvidenceBundleAssembledEvent,
    KnowledgeAuthorityConflictEvent,
    KnowledgeIndexedEvent,
    KnowledgePoisonDetectedEvent,
    KnowledgeReembeddedEvent,
    KnowledgeRetrievalCompletedEvent,
    KnowledgeRetrievalStartedEvent,
    KnowledgeSnapshotCreatedEvent,
    build_knowledge_event,
)
from ...domain.value_objects import (
    AuthorityLevel,
    DocumentStatus,
    EffectiveDateRange,
    EmbeddingGenerationStatus,
    EmbeddingVersion,
    EvidenceHash,
    KnowledgeHash,
    RetrievalMode,
    RetrievalStatus,
)
from ..pipeline.context import RetrievalPipelineContext
from ..pipeline.pipeline import KnowledgeRetrievalPipeline
from ..ports.knowledge_ports import (
    EmbeddingProviderPort,
    KnowledgeRepositoryPort,
    KnowledgeRuntimePort,
    KnowledgeSnapshotPort,
)
from ..projectors.knowledge_projectors import KnowledgeDocumentProjector


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_query(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode()).hexdigest()


class KnowledgeRuntimeService(KnowledgeRuntimePort):
    def __init__(
        self,
        *,
        pipeline: KnowledgeRetrievalPipeline,
        repository: KnowledgeRepositoryPort,
        snapshot_port: KnowledgeSnapshotPort,
        embedding_port: EmbeddingProviderPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._snapshot_port = snapshot_port
        self._embedding = embedding_port
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._doc_projector = KnowledgeDocumentProjector()

    async def retrieve(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        query: str,
        jurisdiction: str = "nepal",
        as_of: str | None = None,
        mode: RetrievalMode | None = None,
        company_id: str | None = None,
    ) -> tuple[KnowledgeSnapshot, EvidenceBundle]:
        if not self._settings.knowledge_enabled:
            raise ValueError("Knowledge runtime module is disabled")

        as_of_ts = as_of or _utc_now().isoformat()
        retrieval_mode = mode or RetrievalMode(self._settings.knowledge_retrieval_mode)
        query_hash = _hash_query(query)

        cached = await self._repository.get_cached_retrieval(
            tenant_id=tenant_id, query_hash=query_hash, jurisdiction=jurisdiction, as_of=as_of_ts
        )
        if cached and cached.snapshot_id and cached.bundle_id:
            snapshot = await self._repository.get_snapshot(tenant_id=tenant_id, snapshot_id=cached.snapshot_id)
            bundle = await self._repository.get_bundle(tenant_id=tenant_id, bundle_id=cached.bundle_id)
            if snapshot and bundle:
                await self._repository.increment_metrics(tenant_id=tenant_id, metric="cache_hits")
                return snapshot, bundle

        now = _utc_now()
        retrieval_id = str(uuid.uuid4())
        retrieval = RetrievalExecution(
            retrieval_id=retrieval_id,
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            query=query,
            query_hash=query_hash,
            mode=retrieval_mode,
            jurisdiction=jurisdiction,
            as_of=as_of_ts,
            status=RetrievalStatus.RUNNING,
            created_at=now,
        )
        await self._repository.save_retrieval(retrieval)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="retrievals_started")
        await self._emit(KnowledgeRetrievalStartedEvent, retrieval, company_id, {"query_hash": query_hash})
        await self._audit_mutation(retrieval, "knowledge.retrieval.started")
        await self._lineage.append_node(
            tenant_id=tenant_id, request_id=request_id, node_type="Query", payload={"query_hash": query_hash}
        )

        ctx = RetrievalPipelineContext(
            retrieval=retrieval,
            query=query,
            mode=retrieval_mode,
            jurisdiction=jurisdiction,
            as_of=as_of_ts,
            tenant_id=tenant_id,
            company_id=company_id,
        )
        result = await self._pipeline.execute(ctx)

        if result.blocked_documents:
            await self._repository.increment_metrics(tenant_id=tenant_id, metric="poison_blocked")
            await self._emit(
                KnowledgePoisonDetectedEvent,
                retrieval,
                company_id,
                {"blocked_count": len(result.blocked_documents)},
            )

        doc_ids = tuple(r.get("document_id", "") for r in result.ranked_results if r.get("document_id"))
        raw = "|".join(sorted(doc_ids)) + "|" + result.normalized_query
        evidence_hash = EvidenceHash(hash_value=hashlib.sha256(raw.encode()).hexdigest(), document_ids=doc_ids)
        snippets = [
            {
                "document_id": r.get("document_id"),
                "title": r.get("title"),
                "snippet": r.get("snippet"),
                "score": r.get("score"),
            }
            for r in (result.ranked_results or [])[:5]
            if r.get("snippet") or r.get("document_id")
        ]
        bundle = EvidenceBundle(
            bundle_id=str(uuid.uuid4()),
            retrieval_id=retrieval_id,
            tenant_id=tenant_id,
            request_id=request_id,
            query=query,
            jurisdiction=jurisdiction,
            authority_summary={"levels": list(result.allowed_authorities)},
            document_ids=doc_ids,
            evidence_hash=evidence_hash,
            scores=tuple(result.scores),
            blocked_document_ids=tuple(b.get("document_id", "") for b in result.blocked_documents),
            metadata={"snippets": snippets},
            created_at=_utc_now(),
        )
        await self._repository.save_bundle(bundle)
        await self._emit(EvidenceBundleAssembledEvent, retrieval, company_id, {"bundle_id": bundle.bundle_id})

        snapshot = await self._snapshot_port.create_from_bundle(retrieval=retrieval, bundle=bundle)
        await self._repository.save_snapshot(snapshot)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="snapshots_created")

        completed = retrieval.model_copy(
            update={
                "status": RetrievalStatus.COMPLETED,
                "snapshot_id": snapshot.snapshot_id,
                "bundle_id": bundle.bundle_id,
                "result_count": len(doc_ids),
                "blocked_count": len(result.blocked_documents),
                "completed_at": _utc_now(),
            }
        )
        await self._repository.save_retrieval(completed)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="retrievals_completed")
        await self._emit(
            KnowledgeRetrievalCompletedEvent,
            completed,
            company_id,
            {"result_count": len(doc_ids), "snapshot_id": snapshot.snapshot_id},
        )
        await self._emit(
            KnowledgeSnapshotCreatedEvent,
            completed,
            company_id,
            {"snapshot_id": snapshot.snapshot_id},
        )
        await self._audit_mutation(completed, "knowledge.retrieval.completed")
        await self._lineage.append_node(
            tenant_id=tenant_id,
            request_id=request_id,
            node_type="KnowledgeSnapshot",
            payload={"snapshot_id": snapshot.snapshot_id, "bundle_id": bundle.bundle_id},
        )
        await self._lineage.append_node(
            tenant_id=tenant_id,
            request_id=request_id,
            node_type="Retrieval",
            payload={"retrieval_id": retrieval_id, "mode": retrieval_mode.value},
        )
        return snapshot, bundle

    async def index_document(self, *, tenant_id: str, document: KnowledgeDocument) -> KnowledgeDocument:
        if not self._settings.knowledge_enabled:
            raise ValueError("Knowledge runtime module is disabled")
        await self._repository.save_document(document)
        content_hash = hashlib.sha256(document.content.encode()).hexdigest()
        chunks = self._chunk_content(document.content)
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{document.document_id}-chunk-{idx}"
            await self._repository.store_chunk(
                tenant_id=tenant_id,
                document_id=document.document_id,
                chunk_id=chunk_id,
                content=chunk,
                metadata={"index": idx},
            )
            if self._settings.knowledge_embedding_enabled:
                vectors = await self._embedding.embed(texts=(chunk,), model=self._settings.knowledge_embedding_version)
                if vectors:
                    await self._embedding.store_vectors(
                        tenant_id=tenant_id,
                        document_id=document.document_id,
                        chunk_id=chunk_id,
                        vector=vectors[0],
                        version=self._settings.knowledge_embedding_version,
                    )
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="documents_indexed")
        await self._emit(
            KnowledgeIndexedEvent,
            RetrievalExecution(
                retrieval_id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                request_id=document.document_id,
                correlation_id=document.document_id,
                query=document.title,
                query_hash=content_hash,
                mode=RetrievalMode.LEXICAL,
                jurisdiction=document.jurisdiction,
                as_of=_utc_now().isoformat(),
                status=RetrievalStatus.COMPLETED,
                created_at=_utc_now(),
            ),
            document.company_id,
            {"document_id": document.document_id},
        )
        await self._audit_mutation_index(document)
        return document

    async def reembed(
        self, *, tenant_id: str, collection_id: str | None, campaign_name: str
    ) -> EmbeddingGeneration:
        if not self._settings.knowledge_enabled:
            raise ValueError("Knowledge runtime module is disabled")
        now = _utc_now()
        generation = EmbeddingGeneration(
            generation_id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            collection_id=collection_id,
            embedding_model=self._settings.knowledge_embedding_version,
            embedding_version=EmbeddingVersion(
                embedding_version_id=str(uuid.uuid4()),
                model_name=self._settings.knowledge_embedding_version,
                model_version="1.0",
                chunk_strategy="fixed-512",
                created_at=now.isoformat(),
            ),
            chunk_strategy="fixed-512",
            status=EmbeddingGenerationStatus.RUNNING,
            campaign_name=campaign_name,
            created_at=now,
        )
        await self._repository.save_embedding_generation(generation)
        docs = await self._repository.list_documents_by_jurisdiction(
            tenant_id=tenant_id, jurisdiction="nepal", as_of=now.isoformat()
        )
        chunk_count = 0
        for doc in docs:
            if collection_id and doc.collection_id != collection_id:
                continue
            for idx, chunk in enumerate(self._chunk_content(doc.content)):
                chunk_id = f"{doc.document_id}-chunk-{idx}"
                vectors = await self._embedding.embed(texts=(chunk,), model=self._settings.knowledge_embedding_version)
                if vectors:
                    await self._embedding.store_vectors(
                        tenant_id=tenant_id,
                        document_id=doc.document_id,
                        chunk_id=chunk_id,
                        vector=vectors[0],
                        version=f"{self._settings.knowledge_embedding_version}-{generation.generation_id[:8]}",
                    )
                    chunk_count += 1
        completed = generation.model_copy(
            update={
                "status": EmbeddingGenerationStatus.COMPLETED,
                "document_count": len(docs),
                "chunk_count": chunk_count,
                "completed_at": _utc_now(),
            }
        )
        await self._repository.save_embedding_generation(completed)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="reembed_campaigns")
        await self._emit(
            KnowledgeReembeddedEvent,
            RetrievalExecution(
                retrieval_id=generation.generation_id,
                tenant_id=tenant_id,
                request_id=generation.generation_id,
                correlation_id=generation.generation_id,
                query=campaign_name,
                query_hash=campaign_name,
                mode=RetrievalMode.SEMANTIC,
                jurisdiction="nepal",
                as_of=now.isoformat(),
                status=RetrievalStatus.COMPLETED,
                created_at=now,
            ),
            None,
            {"generation_id": generation.generation_id, "chunk_count": chunk_count},
        )
        return completed

    async def get_document_read_model(self, *, tenant_id: str, document_id: str):
        doc = await self._repository.get_document(tenant_id=tenant_id, document_id=document_id)
        return self._doc_projector.project(doc) if doc else None

    async def get_metrics(self, *, tenant_id: str):
        return await self._repository.get_metrics(tenant_id=tenant_id)

    @staticmethod
    def _chunk_content(content: str, size: int = 512) -> list[str]:
        words = content.split()
        chunks: list[str] = []
        current: list[str] = []
        length = 0
        for word in words:
            if length + len(word) > size and current:
                chunks.append(" ".join(current))
                current = [word]
                length = len(word)
            else:
                current.append(word)
                length += len(word) + 1
        if current:
            chunks.append(" ".join(current))
        return chunks or [content]

    async def _emit(self, event_cls, retrieval: RetrievalExecution, company_id: str | None, payload: dict) -> None:
        event = build_knowledge_event(
            event_cls,
            tenant_id=retrieval.tenant_id,
            correlation_id=retrieval.correlation_id,
            company_id=company_id,
            retrieval_id=retrieval.retrieval_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _audit_mutation(self, retrieval: RetrievalExecution, event_name: str) -> None:
        await self._audit.record(
            tenant_id=retrieval.tenant_id,
            request_id=retrieval.request_id,
            correlation_id=retrieval.correlation_id,
            event_name=event_name,
            payload_redacted={"retrieval_id": retrieval.retrieval_id, "mode": retrieval.mode.value},
        )

    async def _audit_mutation_index(self, document: KnowledgeDocument) -> None:
        await self._audit.record(
            tenant_id=document.tenant_id,
            request_id=document.document_id,
            correlation_id=document.document_id,
            event_name="knowledge.document.indexed",
            payload_redacted={"document_id": document.document_id, "authority": document.authority_level.value},
        )
