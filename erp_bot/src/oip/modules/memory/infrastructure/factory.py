"""Build memory store pipeline and recall registry."""

from __future__ import annotations

import aiosqlite

from ....config.settings import OipSettings
from ..application.pipeline.pipeline import MemoryStorePipeline
from ..application.pipeline.stages import (
    ClassifyStage,
    DeduplicateStage,
    EmbeddingStage,
    ImportanceStage,
    LinkStage,
    NormalizeStage,
    PersistStage,
    PublishStage,
    RetentionStage,
)
from ..application.ports.memory_ports import MemoryRepositoryPort
from ..domain.conflict_resolver_registry import create_default_conflict_resolver_registry
from ..domain.importance_registry import create_default_importance_registry
from ..domain.memory_type_registry import create_default_memory_type_registry
from ..domain.recall_strategy_registry import create_default_recall_strategy_registry
from ..domain.retention_registry import create_default_retention_registry
from .adapters.compression_adapter import WhitespaceCompressionAdapter
from .adapters.embedding_adapter import HashEmbeddingAdapter
from .adapters.hybrid_recall_adapter import HybridRecallAdapter
from .adapters.lexical_recall_adapter import LexicalRecallAdapter
from .adapters.recall_strategies import register_recall_strategies
from .adapters.retention_adapter import RetentionAdapter
from .adapters.semantic_recall_adapter import SemanticRecallAdapter
from .adapters.snapshot_adapter import MemorySnapshotAdapter
from .adapters.timeline_recall_adapter import TimelineRecallAdapter


def build_memory_store_pipeline(
    *,
    repository: MemoryRepositoryPort,
    conn: aiosqlite.Connection,
    settings: OipSettings,
) -> MemoryStorePipeline:
    type_registry = create_default_memory_type_registry()
    importance_registry = create_default_importance_registry()
    retention_registry = create_default_retention_registry()
    conflict_registry = create_default_conflict_resolver_registry()
    embedding = HashEmbeddingAdapter(conn)
    retention = RetentionAdapter(retention_registry)
    compression = WhitespaceCompressionAdapter()
    snapshot = MemorySnapshotAdapter()
    stages = (
        NormalizeStage(),
        DeduplicateStage(repository),
        ClassifyStage(type_registry),
        ImportanceStage(importance_registry),
        EmbeddingStage(embedding),
        LinkStage(repository),
        RetentionStage(retention),
        PersistStage(repository, type_registry, compression, snapshot, conflict_registry),
        PublishStage(),
    )
    return MemoryStorePipeline(stages=stages)


def build_recall_strategy_registry(*, repository: MemoryRepositoryPort) -> object:
    registry = create_default_recall_strategy_registry()
    importance_registry = create_default_importance_registry()
    lexical = LexicalRecallAdapter(repository)
    semantic = SemanticRecallAdapter(repository)
    hybrid = HybridRecallAdapter(lexical, semantic, importance_registry)
    timeline = TimelineRecallAdapter(repository)
    register_recall_strategies(
        registry,
        repository=repository,
        lexical=lexical,
        semantic=semantic,
        hybrid=hybrid,
        timeline=timeline,
    )
    return registry
