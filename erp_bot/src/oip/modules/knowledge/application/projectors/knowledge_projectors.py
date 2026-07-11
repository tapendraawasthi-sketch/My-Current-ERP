"""Knowledge Runtime projectors."""

from __future__ import annotations

from ...domain.entities import (
    EmbeddingGeneration,
    EvidenceBundle,
    KnowledgeDocument,
    KnowledgeSnapshot,
    RetrievalExecution,
)
from ..read_models.knowledge_read_models import (
    EmbeddingGenerationReadModel,
    EvidenceBundleReadModel,
    KnowledgeDocumentReadModel,
    KnowledgeMetricsReadModel,
    RetrievalReadModel,
)


class KnowledgeDocumentProjector:
    def project(self, doc: KnowledgeDocument) -> KnowledgeDocumentReadModel:
        return KnowledgeDocumentReadModel(
            document_id=doc.document_id,
            collection_id=doc.collection_id,
            tenant_id=doc.tenant_id,
            title=doc.title,
            authority_level=doc.authority_level.value,
            jurisdiction=doc.jurisdiction,
            status=doc.status.value,
            effective_from=doc.effective_range.effective_from,
            effective_to=doc.effective_range.effective_to,
            version=doc.version,
            created_at=doc.created_at.isoformat(),
            updated_at=doc.updated_at.isoformat(),
        )


class RetrievalProjector:
    def project(self, retrieval: RetrievalExecution) -> RetrievalReadModel:
        return RetrievalReadModel(
            retrieval_id=retrieval.retrieval_id,
            tenant_id=retrieval.tenant_id,
            request_id=retrieval.request_id,
            query=retrieval.query,
            mode=retrieval.mode.value,
            jurisdiction=retrieval.jurisdiction,
            as_of=retrieval.as_of,
            status=retrieval.status.value,
            snapshot_id=retrieval.snapshot_id,
            bundle_id=retrieval.bundle_id,
            result_count=retrieval.result_count,
            blocked_count=retrieval.blocked_count,
            cache_hit=retrieval.cache_hit,
            created_at=retrieval.created_at.isoformat(),
            completed_at=retrieval.completed_at.isoformat() if retrieval.completed_at else None,
        )


class EvidenceBundleProjector:
    def project(self, bundle: EvidenceBundle) -> EvidenceBundleReadModel:
        return EvidenceBundleReadModel(
            bundle_id=bundle.bundle_id,
            retrieval_id=bundle.retrieval_id,
            tenant_id=bundle.tenant_id,
            query=bundle.query,
            jurisdiction=bundle.jurisdiction,
            document_ids=bundle.document_ids,
            evidence_hash=bundle.evidence_hash.hash_value,
            blocked_document_ids=bundle.blocked_document_ids,
            created_at=bundle.created_at.isoformat(),
        )


class EmbeddingGenerationProjector:
    def project(self, gen: EmbeddingGeneration) -> EmbeddingGenerationReadModel:
        return EmbeddingGenerationReadModel(
            generation_id=gen.generation_id,
            tenant_id=gen.tenant_id,
            embedding_model=gen.embedding_model,
            model_version=gen.embedding_version.model_version,
            chunk_strategy=gen.chunk_strategy,
            status=gen.status.value,
            document_count=gen.document_count,
            chunk_count=gen.chunk_count,
            campaign_name=gen.campaign_name,
            created_at=gen.created_at.isoformat(),
            completed_at=gen.completed_at.isoformat() if gen.completed_at else None,
        )


class KnowledgeMetricsProjector:
    def project(self, metrics: KnowledgeMetricsReadModel) -> KnowledgeMetricsReadModel:
        return metrics
