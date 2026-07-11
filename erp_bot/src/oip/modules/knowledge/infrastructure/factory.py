"""Build knowledge retrieval pipeline with all stages."""

from __future__ import annotations

from ....config.settings import OipSettings
from ..application.pipeline.pipeline import KnowledgeRetrievalPipeline
from ..application.pipeline.stages import (
    AuthorityFilterStage,
    EvidenceAssemblyStage,
    HybridRankStage,
    JurisdictionFilterStage,
    LexicalSearchStage,
    NormalizeStage,
    PoisonDetectionStage,
    SemanticSearchStage,
    TemporalFilterStage,
)
from ..application.ports.knowledge_ports import (
    AuthorityRegistryPort,
    HybridRankingPort,
    JurisdictionRegistryPort,
    KnowledgeRepositoryPort,
    LexicalSearchPort,
    SemanticSearchPort,
)


def build_knowledge_pipeline(
    *,
    repository: KnowledgeRepositoryPort,
    lexical: LexicalSearchPort,
    semantic: SemanticSearchPort,
    ranking: HybridRankingPort,
    authority: AuthorityRegistryPort,
    jurisdiction: JurisdictionRegistryPort,
    settings: OipSettings,
) -> KnowledgeRetrievalPipeline:
    stages = (
        NormalizeStage(),
        AuthorityFilterStage(authority, enforce=settings.authority_enforcement),
        JurisdictionFilterStage(jurisdiction),
        TemporalFilterStage(repository),
        LexicalSearchStage(lexical, enabled=True),
        SemanticSearchStage(semantic, enabled=settings.knowledge_embedding_enabled),
        HybridRankStage(ranking, authority, hybrid_enabled=settings.hybrid_retrieval),
        PoisonDetectionStage(repository, enabled=settings.poison_detection),
        EvidenceAssemblyStage(),
    )
    return KnowledgeRetrievalPipeline(stages=stages)
