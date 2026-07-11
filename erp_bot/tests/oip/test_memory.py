"""OIP Phase 2.1 — Memory Runtime module tests."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.memory.application.commands import (
    ArchiveMemoryCommand,
    ConsolidateMemoryCommand,
    MergeMemoryCommand,
    RecallMemoryCommand,
    StoreMemoryCommand,
    UpdateMemoryCommand,
)
from src.oip.modules.memory.application.pipeline.context import RecallPipelineContext, StorePipelineContext
from src.oip.modules.memory.application.pipeline.stages import (
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
from src.oip.modules.memory.application.queries import (
    GetMemoryQuery,
    MemoryMetricsQuery,
    PatternSearchQuery,
    StatisticsQuery,
    TimelineQuery,
)
from src.oip.modules.memory.domain.conflict_resolver_registry import create_default_conflict_resolver_registry
from src.oip.modules.memory.domain.embedding_registry import create_default_embedding_registry
from src.oip.modules.memory.domain.entities import MemoryAggregate
from src.oip.modules.memory.domain.expiration_policy_registry import create_default_expiration_policy_registry
from src.oip.modules.memory.domain.importance_registry import create_default_importance_registry
from src.oip.modules.memory.domain.memory_type_registry import create_default_memory_type_registry
from src.oip.modules.memory.domain.merge_strategy_registry import create_default_merge_strategy_registry
from src.oip.modules.memory.domain.promotion_policy_registry import create_default_promotion_policy_registry
from src.oip.modules.memory.domain.recall_strategy_registry import create_default_recall_strategy_registry
from src.oip.modules.memory.domain.retention_registry import create_default_retention_registry
from src.oip.modules.memory.domain.value_objects import (
    Freshness,
    Importance,
    MemoryCategory,
    MemoryHash,
    MemoryStatus,
    MemoryType,
    RecallMode,
    RetentionPolicy,
)
from src.oip.modules.memory.infrastructure.adapters.cache_adapter import MemoryCacheAdapter
from src.oip.modules.memory.infrastructure.adapters.compression_adapter import WhitespaceCompressionAdapter
from src.oip.modules.memory.infrastructure.adapters.embedding_adapter import (
    HashEmbeddingAdapter,
    cosine_similarity,
    hash_embed,
)
from src.oip.modules.memory.infrastructure.adapters.hybrid_recall_adapter import HybridRecallAdapter
from src.oip.modules.memory.infrastructure.adapters.lexical_recall_adapter import LexicalRecallAdapter
from src.oip.modules.memory.infrastructure.adapters.retention_adapter import RetentionAdapter
from src.oip.modules.memory.infrastructure.adapters.semantic_recall_adapter import SemanticRecallAdapter
from src.oip.modules.memory.infrastructure.adapters.snapshot_adapter import MemorySnapshotAdapter
from src.oip.modules.memory.infrastructure.factory import build_memory_store_pipeline, build_recall_strategy_registry
from src.oip.modules.memory.infrastructure.persistence.memory_sqlite import TENANT_A, SqliteMemoryRepositoryAdapter
from src.oip.modules.orchestrator.domain.stage_registry import create_default_stage_registry
from src.oip.modules.orchestrator.domain.value_objects import WorkflowStageName
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_memory_test.db"
    settings = OipSettings(
        enabled=True,
        memory_enabled=True,
        knowledge_enabled=True,
        orchestrator_enabled=True,
        memory_recall_mode="Hybrid",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _store_cmd(**kwargs) -> StoreMemoryCommand:
    return StoreMemoryCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", TENANT_A)),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        summary=kwargs.get("summary", "User asked about VAT registration threshold"),
        content=kwargs.get("content", "Nepal VAT registration applies above NPR 50 lakh turnover."),
        memory_type=kwargs.get("memory_type", "ConversationMemory"),
        conversation_id=kwargs.get("conversation_id", "conv-mem-1"),
        workflow_id=kwargs.get("workflow_id", "wf-mem-1"),
        company_id=kwargs.get("company_id"),
    )


def _recall_cmd(query: str, **kwargs) -> RecallMemoryCommand:
    return RecallMemoryCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", TENANT_A)),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        query=query,
        mode=kwargs.get("mode", "Hybrid"),
        conversation_id=kwargs.get("conversation_id"),
        limit=kwargs.get("limit", 10),
    )


def _sample_memory(**kwargs) -> MemoryAggregate:
    now = datetime.now(timezone.utc)
    return MemoryAggregate(
        memory_id=kwargs.get("memory_id", str(uuid.uuid4())),
        tenant_id=kwargs.get("tenant_id", TENANT_A),
        request_id=str(new_request_id()),
        memory_type=MemoryType.CONVERSATION,
        category=MemoryCategory.CONVERSATION,
        summary=kwargs.get("summary", "Test memory"),
        content=kwargs.get("content", "Test content about VAT"),
        importance=Importance.MEDIUM,
        freshness=Freshness.HOT,
        retention_policy=RetentionPolicy.CONVERSATION,
        memory_hash=MemoryHash(hash_value="abc123"),
        status=MemoryStatus.ACTIVE,
        created_at=now,
        updated_at=now,
    )


# --- Registries ---


def test_memory_type_registry_all_types():
    registry = create_default_memory_type_registry()
    types = registry.all_types()
    assert len(types) == 9
    assert registry.resolve_category(MemoryType.FAILURE) == MemoryCategory.FAILURE


def test_memory_type_registry_retention():
    registry = create_default_memory_type_registry()
    assert registry.resolve_retention(MemoryType.ERP_CONTEXT) == RetentionPolicy.SEVEN_YEARS


def test_importance_registry_rank():
    registry = create_default_importance_registry()
    assert registry.rank(Importance.CRITICAL) > registry.rank(Importance.LOW)


def test_importance_registry_promote_demote():
    registry = create_default_importance_registry()
    assert registry.promote(Importance.MEDIUM) == Importance.HIGH
    assert registry.demote(Importance.HIGH) == Importance.MEDIUM


def test_retention_registry_forever_no_expiry():
    registry = create_default_retention_registry()
    now = datetime.now(timezone.utc)
    assert registry.compute_expiry(RetentionPolicy.FOREVER, now) is None


def test_retention_registry_session_ttl():
    registry = create_default_retention_registry()
    now = datetime.now(timezone.utc)
    expiry = registry.compute_expiry(RetentionPolicy.SESSION, now)
    assert expiry is not None
    assert (expiry - now).days == 7


def test_recall_strategy_registry_modes():
    registry = create_default_recall_strategy_registry()
    assert registry.resolve_strategy_name(RecallMode.HYBRID) == "hybrid"
    assert registry.resolve_strategy_name(RecallMode.TIMELINE) == "timeline"


def test_merge_strategy_registry_union():
    registry = create_default_merge_strategy_registry()
    strategy = registry.get("union")
    assert strategy is not None
    primary = _sample_memory(summary="Primary", content="A")
    secondary = _sample_memory(summary="Secondary", content="B")
    merged = strategy.merge(primary, secondary, merged_summary="P | S", merged_hash=MemoryHash(hash_value="x"))
    assert merged["summary"] == "P | S"
    assert "A" in merged["content"]
    assert "B" in merged["content"]


def test_conflict_resolver_prefers_higher_importance():
    registry = create_default_conflict_resolver_registry()
    resolver = registry.get(registry.default_name())
    assert resolver is not None
    low = _sample_memory().model_copy(update={"importance": Importance.LOW})
    high = _sample_memory().model_copy(update={"importance": Importance.HIGH})
    result = resolver.resolve(low, high)
    assert result.importance == Importance.HIGH


def test_promotion_policy_registry():
    importance = create_default_importance_registry()
    registry = create_default_promotion_policy_registry(importance)
    handler = registry.get_handler("confidence_access")
    policy = registry.get_policy("confidence_access")
    assert handler is not None and policy is not None
    assert handler.should_promote(confidence=0.9, access_count=5, definition=policy)


def test_expiration_policy_registry_freshness():
    retention = create_default_retention_registry()
    registry = create_default_expiration_policy_registry(retention)
    handler = registry.get_handler("retention_based")
    assert handler is not None
    assert handler.freshness_for_age_days(0.5) == Freshness.HOT
    assert handler.freshness_for_age_days(30) == Freshness.COLD


def test_embedding_registry_default():
    registry = create_default_embedding_registry()
    assert registry.default_model() == "hash-v1"
    assert registry.get("hash-v1").dimensions == 64


# --- Adapters ---


def test_hash_embed_deterministic():
    a = hash_embed("Nepal VAT thirteen percent")
    b = hash_embed("Nepal VAT thirteen percent")
    assert a == b
    assert len(a) == 64


def test_cosine_similarity_identical():
    v = hash_embed("test query")
    assert cosine_similarity(v, v) == pytest.approx(1.0, abs=1e-6)


def test_compression_adapter():
    adapter = WhitespaceCompressionAdapter()
    compressed, ratio = adapter.compress("hello   world\n\ttest")
    assert compressed == "hello world test"
    assert ratio < 1.0


def test_snapshot_adapter_pointer():
    adapter = MemorySnapshotAdapter()
    pointer = adapter.create_pointer(memory_id="mem-1", sequence=2, payload_hash="abc" * 8)
    assert pointer.startswith("memory://mem-1/v2/")


@pytest.mark.asyncio
async def test_memory_cache_adapter():
    cache = MemoryCacheAdapter()
    memory = _sample_memory()
    await cache.set("key1", (memory,))
    result = await cache.get("key1")
    assert result is not None
    assert result[0].memory_id == memory.memory_id


# --- Pipeline stages ---


@pytest.mark.asyncio
async def test_normalize_stage():
    stage = NormalizeStage()
    ctx = StorePipelineContext(
        tenant_id=TENANT_A,
        request_id="r1",
        correlation_id="c1",
        summary="  Multiple   spaces  ",
        content="  content  ",
    )
    result = await stage.run(ctx)
    assert result.normalized_summary == "Multiple spaces"


@pytest.mark.asyncio
async def test_classify_stage_sets_retention(oip_container):
    repo = oip_container.memory_repository
    stage = ClassifyStage(create_default_memory_type_registry())
    ctx = StorePipelineContext(
        tenant_id=TENANT_A,
        request_id="r1",
        correlation_id="c1",
        memory_type=MemoryType.FAILURE,
        summary="Failure occurred",
    )
    result = await stage.run(ctx)
    assert result.retention_policy == RetentionPolicy.SEVEN_YEARS


@pytest.mark.asyncio
async def test_importance_stage_boosts_confidence():
    stage = ImportanceStage(create_default_importance_registry())
    ctx = StorePipelineContext(
        tenant_id=TENANT_A,
        request_id="r1",
        correlation_id="c1",
        importance=Importance.CRITICAL,
        confidence=0.5,
        summary="Critical failure",
    )
    result = await stage.run(ctx)
    assert result.confidence > 0.5


@pytest.mark.asyncio
async def test_deduplicate_stage_finds_duplicate(oip_container):
    repo = oip_container.memory_repository
    memory = await oip_container.memory_runtime_service.store(
        tenant_id=TENANT_A,
        request_id=str(new_request_id()),
        correlation_id=str(new_correlation_id()),
        summary="Duplicate test summary",
        content="Duplicate test content",
        memory_type="ConversationMemory",
    )
    stage = DeduplicateStage(repo)
    ctx = StorePipelineContext(
        tenant_id=TENANT_A,
        request_id="r2",
        correlation_id="c2",
        memory_type=MemoryType.CONVERSATION,
        summary="Duplicate test summary",
        content="Duplicate test content",
    )
    ctx = NormalizeStage()
    ctx = await ctx.run(
        StorePipelineContext(
            tenant_id=TENANT_A,
            request_id="r2",
            correlation_id="c2",
            memory_type=MemoryType.CONVERSATION,
            summary="Duplicate test summary",
            content="Duplicate test content",
        )
    )
    result = await stage.run(ctx)
    assert result.duplicate_memory_id == memory.memory_id


@pytest.mark.asyncio
async def test_store_pipeline_stage_names(oip_container):
    pipeline = build_memory_store_pipeline(
        repository=oip_container.memory_repository,
        conn=oip_container.connection,
        settings=oip_container.settings,
    )
    names = pipeline.stage_names
    assert names == (
        "normalize",
        "deduplicate",
        "classify",
        "importance",
        "embedding",
        "link",
        "retention",
        "persist",
        "publish",
    )


# --- Service: store / recall ---


@pytest.mark.asyncio
async def test_store_memory(oip_container):
    result = await oip_container.command_bus.dispatch(_store_cmd())
    assert result["memory_id"]
    assert result["memory_type"] == "ConversationMemory"
    assert result["summary"]


@pytest.mark.asyncio
async def test_store_memory_disabled(tmp_path):
    db_path = tmp_path / "mem_disabled.db"
    settings = OipSettings(enabled=True, memory_enabled=False, database_url=f"sqlite+aiosqlite:///{db_path}")
    container = await build_container(settings)
    with pytest.raises(ValueError, match="disabled"):
        await container.memory_runtime_service.store(
            tenant_id=TENANT_A,
            request_id=str(new_request_id()),
            correlation_id=str(new_correlation_id()),
            summary="test",
        )
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_get_memory(oip_container):
    stored = await oip_container.command_bus.dispatch(_store_cmd(summary="Retrieve by id test"))
    result = await oip_container.query_bus.dispatch(
        GetMemoryQuery(tenant_id=TenantId(TENANT_A), memory_id=stored["memory_id"])
    )
    assert result is not None
    assert result["summary"] == "Retrieve by id test"


@pytest.mark.asyncio
async def test_recall_hybrid(oip_container):
    await oip_container.command_bus.dispatch(
        _store_cmd(summary="VAT registration threshold NPR 50 lakh", content="Nepal VAT Act turnover limit")
    )
    result = await oip_container.command_bus.dispatch(_recall_cmd("VAT registration threshold"))
    assert len(result["memories"]) >= 1


@pytest.mark.asyncio
async def test_recall_timeline_mode(oip_container):
    await oip_container.command_bus.dispatch(_store_cmd(conversation_id="conv-tl-1"))
    result = await oip_container.command_bus.dispatch(
        _recall_cmd("anything", mode="Timeline", conversation_id="conv-tl-1")
    )
    assert "memories" in result


@pytest.mark.asyncio
async def test_recall_cache_hit(oip_container):
    await oip_container.command_bus.dispatch(_store_cmd(summary="Cache test memory unique phrase"))
    q = _recall_cmd("Cache test memory unique phrase")
    first = await oip_container.command_bus.dispatch(q)
    second = await oip_container.command_bus.dispatch(
        RecallMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            request_id=RequestId(str(new_request_id())),
            query="Cache test memory unique phrase",
            mode="Hybrid",
        )
    )
    assert len(first["memories"]) == len(second["memories"])


@pytest.mark.asyncio
async def test_update_memory(oip_container):
    stored = await oip_container.command_bus.dispatch(_store_cmd())
    updated = await oip_container.command_bus.dispatch(
        UpdateMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            memory_id=stored["memory_id"],
            summary="Updated summary",
            importance="High",
        )
    )
    assert updated["summary"] == "Updated summary"
    assert updated["importance"] == "High"


@pytest.mark.asyncio
async def test_merge_memory(oip_container):
    a = await oip_container.command_bus.dispatch(_store_cmd(summary="Merge primary", content="Primary content"))
    b = await oip_container.command_bus.dispatch(_store_cmd(summary="Merge secondary", content="Secondary content"))
    merged = await oip_container.command_bus.dispatch(
        MergeMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            primary_memory_id=a["memory_id"],
            secondary_memory_id=b["memory_id"],
        )
    )
    assert "Merge primary" in merged["summary"]
    assert "Merge secondary" in merged["summary"]


@pytest.mark.asyncio
async def test_archive_memory(oip_container):
    stored = await oip_container.command_bus.dispatch(_store_cmd())
    archived = await oip_container.command_bus.dispatch(
        ArchiveMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            memory_id=stored["memory_id"],
        )
    )
    assert archived["archived"] is True


@pytest.mark.asyncio
async def test_timeline_query(oip_container):
    await oip_container.command_bus.dispatch(_store_cmd(conversation_id="conv-timeline-1"))
    result = await oip_container.query_bus.dispatch(
        TimelineQuery(tenant_id=TenantId(TENANT_A), conversation_id="conv-timeline-1")
    )
    assert len(result["memories"]) >= 1


@pytest.mark.asyncio
async def test_consolidate_memory(oip_container):
    await oip_container.command_bus.dispatch(
        _store_cmd(conversation_id="conv-cons-1", workflow_id="wf-cons-1")
    )
    await oip_container.command_bus.dispatch(
        _store_cmd(conversation_id="conv-cons-1", workflow_id="wf-cons-1", summary="Second memory")
    )
    result = await oip_container.command_bus.dispatch(
        ConsolidateMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            conversation_id="conv-cons-1",
            workflow_id="wf-cons-1",
        )
    )
    assert len(result["memories"]) >= 1


@pytest.mark.asyncio
async def test_memory_metrics(oip_container):
    await oip_container.command_bus.dispatch(_store_cmd())
    metrics = await oip_container.query_bus.dispatch(MemoryMetricsQuery(tenant_id=TenantId(TENANT_A)))
    assert metrics["total_memories"] >= 1


@pytest.mark.asyncio
async def test_memory_statistics(oip_container):
    await oip_container.command_bus.dispatch(_store_cmd())
    stats = await oip_container.query_bus.dispatch(StatisticsQuery(tenant_id=TenantId(TENANT_A)))
    assert stats["total_memories"] >= 1
    assert "ConversationMemory" in stats["by_type"]


@pytest.mark.asyncio
async def test_pattern_search_query(oip_container):
    await oip_container.command_bus.dispatch(
        _store_cmd(memory_type="PatternMemory", summary="Successful journal entry pattern")
    )
    result = await oip_container.query_bus.dispatch(
        PatternSearchQuery(tenant_id=TenantId(TENANT_A), pattern_type="success")
    )
    assert "patterns" in result


@pytest.mark.asyncio
async def test_audit_chain_after_store(oip_container):
    cmd = _store_cmd()
    await oip_container.command_bus.dispatch(cmd)
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId(TENANT_A), request_id=cmd.request_id)
    )
    event_names = [e["event_name"] for e in chain]
    assert any("memory" in name for name in event_names)


@pytest.mark.asyncio
async def test_lineage_after_store(oip_container):
    cmd = _store_cmd()
    await oip_container.command_bus.dispatch(cmd)
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId(TENANT_A), request_id=cmd.request_id)
    )
    node_types = [n["node_type"] for n in trace]
    assert "Memory" in node_types


# --- Lexical / semantic / hybrid adapters ---


@pytest.mark.asyncio
async def test_lexical_recall_adapter(oip_container):
    repo = oip_container.memory_repository
    await oip_container.command_bus.dispatch(
        _store_cmd(summary="TDS withholding salary Nepal", content="TDS on salary per IRD slab rates")
    )
    adapter = LexicalRecallAdapter(repo)
    hits = await adapter.search(tenant_id=TENANT_A, query="TDS withholding", limit=5)
    assert len(hits) >= 1


@pytest.mark.asyncio
async def test_semantic_recall_adapter(oip_container):
    repo = oip_container.memory_repository
    await oip_container.command_bus.dispatch(
        _store_cmd(summary="Input tax credit invoices", content="Valid tax invoices for ITC claim")
    )
    adapter = SemanticRecallAdapter(repo)
    hits = await adapter.search(tenant_id=TENANT_A, query="input tax credit", limit=5)
    assert isinstance(hits, tuple)


@pytest.mark.asyncio
async def test_hybrid_recall_adapter(oip_container):
    repo = oip_container.memory_repository
    importance = create_default_importance_registry()
    await oip_container.command_bus.dispatch(
        _store_cmd(summary="IFRS revenue recognition five step model", content="IFRS 15 control transfer")
    )
    hybrid = HybridRecallAdapter(LexicalRecallAdapter(repo), SemanticRecallAdapter(repo), importance)
    hits = await hybrid.search(tenant_id=TENANT_A, query="IFRS revenue recognition", limit=5)
    assert isinstance(hits, tuple)


# --- Orchestrator integration ---


def test_orchestrator_stage_registry_includes_memory_stages():
    registry = create_default_stage_registry()
    names = registry.stage_names()
    assert "knowledge" in names
    assert "memory_store" in names
    assert "memory_update" in names
    assert "memory_consolidation" in names
    knowledge_idx = names.index("knowledge")
    memory_store_idx = names.index("memory_store")
    execution_idx = names.index("execution")
    memory_update_idx = names.index("memory_update")
    consolidation_idx = names.index("memory_consolidation")
    streaming_idx = names.index("streaming")
    assert knowledge_idx < memory_store_idx < execution_idx < memory_update_idx
    assert consolidation_idx < streaming_idx


def test_orchestrator_knowledge_stage_definition():
    registry = create_default_stage_registry()
    knowledge = registry.get(WorkflowStageName.KNOWLEDGE)
    memory_store = registry.get(WorkflowStageName.MEMORY_STORE)
    assert knowledge is not None
    assert memory_store is not None
    assert knowledge.order == 55
    assert memory_store.order == 57


@pytest.mark.asyncio
async def test_recall_strategy_registry_with_repository(oip_container):
    registry = build_recall_strategy_registry(repository=oip_container.memory_repository)
    strategy = registry.get_strategy(RecallMode.HYBRID)
    assert strategy is not None
    ctx = RecallPipelineContext(
        tenant_id=TENANT_A,
        request_id="r1",
        correlation_id="c1",
        query="test",
        normalized_query="test",
    )
    result = await strategy.recall(ctx)
    assert result.memories is not None


@pytest.mark.asyncio
async def test_duplicate_store_returns_same_memory(oip_container):
    cmd = _store_cmd(summary="Exact duplicate content test", content="Same payload")
    first = await oip_container.command_bus.dispatch(cmd)
    second = await oip_container.command_bus.dispatch(
        StoreMemoryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            request_id=RequestId(str(new_request_id())),
            summary="Exact duplicate content test",
            content="Same payload",
        )
    )
    assert first["memory_id"] == second["memory_id"]


@pytest.mark.asyncio
async def test_retention_adapter(oip_container):
    adapter = RetentionAdapter(create_default_retention_registry())
    now = datetime.now(timezone.utc)
    expiry = adapter.compute_expiry("Conversation", now)
    assert expiry is not None


@pytest.mark.asyncio
async def test_embedding_stage(oip_container):
    embedding = HashEmbeddingAdapter(oip_container.connection)
    stage = EmbeddingStage(embedding)
    ctx = StorePipelineContext(
        tenant_id=TENANT_A,
        request_id="r1",
        correlation_id="c1",
        summary="Embedding test",
        content="Content for embedding vector generation",
    )
    ctx = await NormalizeStage().run(ctx)
    result = await stage.run(ctx)
    assert result.embedding_id is not None
    assert result.embedding_vector is not None
