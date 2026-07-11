"""Dependency injection container — wires OIP Phase 0 components."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import aiosqlite

from ...application.bus.command_bus import CommandBus
from ...application.bus.event_bus import EventBus
from ...application.bus.query_bus import QueryBus
from ...application.handlers.phase0_handlers import (
    AppendLineageNodeHandler,
    GetAuditChainHandler,
    GetLineageTraceHandler,
    RecordShadowAuditHandler,
    SubmitIntelligenceRequestHandler,
)
from ...application.services.audit_service import AuditService
from ...application.services.lineage_service import LineageService
from ...config.settings import FeatureFlags, OipSettings, get_oip_settings
from ...kernel.facade import IntelligenceKernelFacade
from ...kernel.secured_facade import SecuredIntelligenceKernelFacade
from ...integration.acl.rbac_permission_adapter import RbacPermissionAdapter
from ...application.services.security_audit_service import SecurityAuditService
from ...infrastructure.persistence.security_sqlite import SqliteSecurityRepository
from ...infrastructure.security.api_key_service import ApiKeyService
from ...infrastructure.security.credential_vault import CredentialVault
from ...infrastructure.security.jwt_service import JwtService
from ...infrastructure.security.permission_registry import create_default_permission_registry
from ...infrastructure.security.rate_limiter import RateLimiter
from ...infrastructure.security.secret_provider import get_secret_provider
from ...infrastructure.security.security_event_service import SecurityEventService
from ..messaging.event_publisher import InProcessEventPublisher
from ..messaging.inbox_event_bus import InboxAwareEventBus
from ..messaging.outbox_poller import OutboxPoller
from ..observability.alerting_service import AlertingService
from ..observability.bus_instrumentation import InstrumentedCommandBus, InstrumentedQueryBus
from ..observability.metrics import get_metrics_registry
from ..observability.readiness_service import ReadinessService
from ..observability.stage_instrumentation import instrument_stage_registry
from ..persistence.inbox_sqlite import SqliteInboxAdapter
from ..messaging.outbox_dispatcher import OutboxDispatcher
from ..persistence.audit_sqlite import SqliteAuditSinkAdapter
from ..persistence.database import migrate_oip_schema, open_oip_database
from ..persistence.inbox_sqlite import SqliteInboxAdapter
from ..persistence.lineage_sqlite import SqliteLineageRepositoryAdapter
from ..persistence.outbox_sqlite import SqliteOutboxAdapter
from ...modules.conversation.application.handlers.conversation_handlers import (
    CloseConversationHandler,
    EnsureConversationHandler,
    GetConversationBySessionHandler,
    GetConversationHistoryHandler,
    GetConversationHandler,
    RecordAssistantMessageHandler,
    RecordUserMessageHandler,
)
from ...modules.conversation.application.services.conversation_service import ConversationService
from ...modules.conversation.infrastructure.persistence.conversation_sqlite import (
    SqliteConversationRepositoryAdapter,
)
from ...modules.session.application.handlers.session_handlers import (
    BindSessionContextHandler,
    CloseSessionHandler,
    GetSessionHandler,
    OpenSessionHandler,
)
from ...modules.session.application.services.session_service import SessionService
from ...modules.session.infrastructure.adapters.legacy_session_adapter import (
    LegacySessionContextAdapter,
)
from ...modules.session.infrastructure.persistence.session_sqlite import SqliteSessionRepositoryAdapter
from ...modules.planner.application.handlers.planner_handlers import (
    ArchiveExecutionPlanHandler,
    CancelExecutionPlanHandler,
    CreateExecutionPlanHandler,
    ExpireExecutionPlanHandler,
    GetExecutionPlanHandler,
    GetExecutionStatusHandler,
    GetExecutionStepsHandler,
    GetPlannerMetricsHandler,
    SearchExecutionPlansHandler,
    ValidateExecutionPlanHandler,
)
from ...modules.planner.application.services.planner_service import PlannerService
from ...modules.planner.infrastructure.adapters.default_capability_registry import (
    DefaultCapabilityRegistryAdapter,
)
from ...modules.planner.infrastructure.adapters.default_execution_budget import (
    DefaultExecutionBudgetAdapter,
)
from ...modules.planner.infrastructure.adapters.default_planning_policy import (
    DefaultPlanningPolicyAdapter,
)
from ...modules.planner.infrastructure.adapters.default_skill_registry import (
    DefaultSkillRegistryAdapter,
)
from ...modules.planner.infrastructure.adapters.default_tool_registry import (
    DefaultToolRegistryAdapter,
)
from ...modules.planner.infrastructure.factory import build_planning_pipeline
from ...modules.planner.infrastructure.persistence.plan_sqlite import (
    SqliteExecutionPlanRepositoryAdapter,
)
from ...modules.router.application.handlers.router_handlers import (
    ApproveRouteHandler,
    ArchiveRouteHandler,
    CreateRouteDecisionHandler,
    ExpireRouteHandler,
    GetProviderHealthHandler,
    GetRouteDecisionHandler,
    GetRoutesHandler,
    GetRoutingMetricsHandler,
    RejectRouteHandler,
    SearchRoutesHandler,
)
from ...modules.router.application.services.router_service import RouterService
from ...modules.router.infrastructure.adapters.default_routing_policy import DefaultRoutingPolicyAdapter
from ...modules.router.infrastructure.adapters.edition_capability_adapter import DefaultEditionCapabilityAdapter
from ...modules.router.infrastructure.adapters.execution_tool_registry import create_default_execution_tool_registry
from ...modules.router.infrastructure.adapters.policy_decision_adapter import DefaultPolicyDecisionAdapter
from ...modules.router.infrastructure.adapters.provider_health_adapter import SqliteProviderHealthAdapter
from ...modules.router.infrastructure.adapters.provider_registry import create_default_provider_registry
from ...modules.router.infrastructure.adapters.provider_registry_adapter import ProviderRegistryAdapter
from ...modules.router.infrastructure.adapters.tool_registry_adapter import ExecutionToolRegistryAdapter
from ...modules.router.infrastructure.factory import build_routing_pipeline
from ...modules.router.infrastructure.persistence.route_sqlite import SqliteRouteDecisionRepositoryAdapter
from ...modules.provider_runtime.application.handlers.provider_runtime_handlers import (
    ArchiveExecutionHandler,
    CancelExecutionHandler,
    CheckpointExecutionHandler,
    ExecutionMetricsHandler,
    GetExecutionArtifactsHandler,
    GetExecutionHandler,
    GetExecutionStatusHandler,
    GetExecutionUsageHandler,
    RetryExecutionHandler,
    SearchExecutionsHandler,
    StartExecutionHandler,
    TimeoutExecutionHandler,
)
from ...modules.provider_runtime.application.services.provider_runtime_service import ProviderRuntimeService
from ...modules.provider_runtime.infrastructure.adapters.artifact_store_adapter import LocalArtifactStoreAdapter
from ...modules.provider_runtime.infrastructure.adapters.capability_token_adapter import SqliteCapabilityTokenAdapter
from ...modules.provider_runtime.infrastructure.adapters.default_execution_policy import DefaultExecutionPolicyAdapter
from ...modules.provider_runtime.infrastructure.adapters.execution_budget_adapter import (
    DefaultExecutionBudgetAdapter as ProviderRuntimeBudgetAdapter,
)
from ...modules.provider_runtime.infrastructure.adapters.execution_health_adapter import DefaultExecutionHealthAdapter
from ...modules.provider_runtime.infrastructure.adapters.provider_adapter_registry import ProviderAdapterRegistry
from ...modules.provider_runtime.infrastructure.adapters.providers.http_base import ProviderRuntimeConfig
from ...modules.provider_runtime.infrastructure.adapters.streaming_adapter import DefaultStreamingAdapter
from ...modules.provider_runtime.infrastructure.adapters.tool_sandbox_adapter import DefaultToolSandboxAdapter
from ...modules.provider_runtime.infrastructure.adapters.usage_collector_adapter import DefaultUsageCollectorAdapter
from ...modules.provider_runtime.infrastructure.factory import build_execution_pipeline
from ...modules.provider_runtime.infrastructure.persistence.execution_sqlite import SqliteExecutionRepositoryAdapter
from ...modules.quality_gate.application.handlers.quality_gate_handlers import (
    ApproveEvaluationHandler,
    ArchiveEvaluationHandler,
    GetDecisionHandler,
    GetEvaluationHandler,
    GetFindingsHandler,
    QualityMetricsHandler,
    RejectEvaluationHandler,
    SearchEvaluationsHandler,
    StartEvaluationHandler,
)
from ...modules.quality_gate.application.services.quality_gate_service import QualityGateService
from ...modules.quality_gate.infrastructure.adapters.default_accounting_validation import (
    DefaultAccountingValidationAdapter,
)
from ...modules.quality_gate.infrastructure.adapters.default_ai_quality_validation import (
    DefaultAIQualityValidationAdapter,
)
from ...modules.quality_gate.infrastructure.adapters.default_business_rules import DefaultBusinessRuleAdapter
from ...modules.quality_gate.infrastructure.adapters.default_erp_validation import DefaultERPValidationAdapter
from ...modules.quality_gate.infrastructure.adapters.default_evidence_validation import (
    DefaultEvidenceValidationAdapter,
)
from ...modules.quality_gate.infrastructure.adapters.default_jurisdiction_rules import (
    DefaultJurisdictionRuleAdapter,
)
from ...modules.quality_gate.infrastructure.adapters.default_knowledge_authority import (
    DefaultKnowledgeAuthorityAdapter,
)
from ...modules.quality_gate.infrastructure.adapters.default_risk_scoring import DefaultRiskScoringAdapter
from ...modules.quality_gate.infrastructure.factory import build_quality_gate_pipeline
from ...modules.quality_gate.infrastructure.persistence.quality_gate_sqlite import SqliteQualityRepositoryAdapter
from ...modules.action_runtime.application.handlers.action_runtime_handlers import (
    ActionMetricsHandler,
    ApproveActionHandler,
    CancelActionHandler,
    GetActionHandler,
    ProposeActionHandler,
    RejectActionHandler,
    SearchActionsHandler,
)
from ...modules.action_runtime.application.services.action_runtime_service import ActionRuntimeService
from ...modules.action_runtime.domain.action_registry import create_default_action_registry
from ...modules.action_runtime.infrastructure.adapters.default_action_policy import DefaultActionPolicyAdapter
from ...modules.action_runtime.infrastructure.adapters.default_approval import DefaultApprovalAdapter
from ...modules.action_runtime.infrastructure.adapters.default_capability import DefaultActionCapabilityAdapter
from ...modules.action_runtime.infrastructure.adapters.default_compensation import DefaultCompensationAdapter
from ...modules.action_runtime.infrastructure.adapters.default_snapshot import DefaultSnapshotAdapter
from ...modules.action_runtime.infrastructure.adapters.erp_command_adapter import ErpCommandAdapter
from ...modules.action_runtime.infrastructure.adapters.erp_query_adapter import ErpQueryAdapter
from ...modules.action_runtime.infrastructure.factory import build_action_runtime_pipeline
from ...modules.action_runtime.infrastructure.persistence.action_sqlite import SqliteActionRepositoryAdapter
from ...modules.streaming_runtime.application.handlers.streaming_runtime_handlers import (
    CloseStreamHandler,
    GetStreamHandler,
    IngestWorkflowEventHandler,
    ListStreamsHandler,
    OpenStreamHandler,
    ReconnectStreamHandler,
    ReplayStreamHandler,
    StreamingMetricsHandler,
)
from ...modules.streaming_runtime.application.handlers.workflow_event_subscriber import WorkflowEventSubscriber
from ...modules.streaming_runtime.application.services.streaming_runtime_service import StreamingRuntimeService
from ...modules.streaming_runtime.infrastructure.adapters.composite_replay_buffer import CompositeReplayBufferAdapter
from ...modules.streaming_runtime.infrastructure.adapters.memory_replay_buffer import MemoryReplayBufferAdapter
from ...modules.streaming_runtime.infrastructure.adapters.persistent_replay_buffer import PersistentReplayBufferAdapter
from ...modules.streaming_runtime.infrastructure.adapters.registry_transport_port import (
    RegistryStreamingTransportPort,
    create_default_transport_registry,
)
from ...modules.streaming_runtime.infrastructure.adapters.sse_transport import SSETransportAdapter
from ...modules.streaming_runtime.infrastructure.factory import build_streaming_pipeline
from ...modules.streaming_runtime.infrastructure.persistence.streaming_sqlite import SqliteStreamRepositoryAdapter
from ...modules.orchestrator.application.handlers.orchestrator_handlers import (
    ArchiveWorkflowHandler,
    CancelWorkflowHandler,
    GetWorkflowHandler,
    GetWorkflowTimelineHandler,
    ListWorkflowsHandler,
    RecoverWorkflowsHandler,
    StartWorkflowHandler,
    WorkflowMetricsHandler,
)
from ...modules.orchestrator.application.services.orchestrator_service import OrchestratorService
from ...modules.orchestrator.infrastructure.factory import (
    build_module_ports,
    build_stage_port_registry,
    build_workflow_engine,
)
from ...modules.orchestrator.infrastructure.persistence.orchestrator_sqlite import SqliteWorkflowRepositoryAdapter
from ...modules.knowledge.application.handlers.knowledge_handlers import (
    GetEvidenceBundleHandler,
    GetKnowledgeDocumentHandler,
    GetRetrievalHandler,
    IndexKnowledgeHandler,
    KnowledgeMetricsHandler,
    ReembedKnowledgeHandler,
    RetrieveKnowledgeHandler,
)
from ...modules.knowledge.application.services.knowledge_runtime_service import KnowledgeRuntimeService
from ...modules.knowledge.infrastructure.adapters.authority_registry_adapter import AuthorityRegistryAdapter
from ...modules.knowledge.infrastructure.adapters.embedding_provider_adapter import HashEmbeddingProviderAdapter
from ...modules.knowledge.infrastructure.adapters.hybrid_ranking_adapter import HybridRankingAdapter
from ...modules.knowledge.infrastructure.adapters.jurisdiction_registry_adapter import JurisdictionRegistryAdapter
from ...modules.knowledge.infrastructure.adapters.lexical_search_adapter import LexicalSearchAdapter
from ...modules.knowledge.infrastructure.adapters.semantic_search_adapter import SemanticSearchAdapter
from ...modules.knowledge.infrastructure.adapters.snapshot_adapter import KnowledgeSnapshotAdapter
from ...modules.knowledge.infrastructure.factory import build_knowledge_pipeline
from ...modules.knowledge.infrastructure.persistence.knowledge_sqlite import SqliteKnowledgeRepositoryAdapter
from ...modules.memory.application.handlers.memory_handlers import (
    ArchiveMemoryHandler,
    CollectionsHandler,
    ConsolidateMemoryHandler,
    DeleteMemoryHandler,
    DemoteMemoryHandler,
    ExpireMemoryHandler,
    GetMemoryHandler,
    MemoryMetricsHandler,
    MergeMemoryHandler,
    PatternSearchHandler,
    PromoteMemoryHandler,
    RecallMemoryHandler,
    RelatedMemoryHandler,
    SearchMemoryHandler,
    StatisticsHandler,
    StoreMemoryHandler,
    TimelineHandler,
    UpdateMemoryHandler,
)
from ...modules.memory.application.services.memory_runtime_service import MemoryRuntimeService
from ...modules.memory.infrastructure.adapters.cache_adapter import MemoryCacheAdapter
from ...modules.memory.infrastructure.factory import build_memory_store_pipeline, build_recall_strategy_registry
from ...modules.memory.infrastructure.persistence.memory_sqlite import SqliteMemoryRepositoryAdapter
from ...modules.oec_runtime.application.handlers.oec_handlers import (
    ArchiveConnectorHandler,
    CancelExecutionHandler as OecCancelExecutionHandler,
    ConnectorCapabilitiesHandler,
    ConnectorHealthHandler,
    ConnectorMetricsHandler,
    ExecuteERPCommandHandler,
    ExecuteERPQueryHandler,
    ExecutionHistoryHandler,
    GetConnectorHandler,
    RegisterConnectorHandler,
    RetryExecutionHandler as OecRetryExecutionHandler,
    SearchConnectorsHandler,
    UnregisterConnectorHandler,
)
from ...modules.oec_runtime.application.services.oec_runtime_service import OecRuntimeService
from ...modules.oec_runtime.infrastructure.factory import build_connector_registry, build_oec_pipeline
from ...modules.oec_runtime.infrastructure.persistence.oec_sqlite import SqliteOecRepositoryAdapter


@dataclass
class OipContainer:
    settings: OipSettings
    feature_flags: FeatureFlags
    connection: aiosqlite.Connection
    command_bus: CommandBus
    query_bus: QueryBus
    event_bus: EventBus
    kernel: IntelligenceKernelFacade
    outbox_dispatcher: OutboxDispatcher
    conversation_service: ConversationService
    session_service: SessionService
    planner_service: PlannerService
    plan_repository: SqliteExecutionPlanRepositoryAdapter
    router_service: RouterService
    route_repository: SqliteRouteDecisionRepositoryAdapter
    provider_runtime_service: ProviderRuntimeService
    execution_repository: SqliteExecutionRepositoryAdapter
    quality_gate_service: QualityGateService
    quality_repository: SqliteQualityRepositoryAdapter
    action_runtime_service: ActionRuntimeService
    action_repository: SqliteActionRepositoryAdapter
    erp_command_port: ErpCommandAdapter
    streaming_runtime_service: StreamingRuntimeService
    stream_repository: SqliteStreamRepositoryAdapter
    streaming_transport: RegistryStreamingTransportPort
    sse_transport: SSETransportAdapter
    orchestrator_service: OrchestratorService
    workflow_repository: SqliteWorkflowRepositoryAdapter
    knowledge_runtime_service: KnowledgeRuntimeService
    knowledge_repository: SqliteKnowledgeRepositoryAdapter
    memory_runtime_service: MemoryRuntimeService
    memory_repository: SqliteMemoryRepositoryAdapter
    oec_runtime_service: OecRuntimeService
    oec_repository: SqliteOecRepositoryAdapter
    jwt_service: JwtService
    api_key_service: ApiKeyService
    permission_registry: object
    security_event_service: SecurityEventService
    rate_limiter: RateLimiter
    credential_vault: CredentialVault
    security_repository: SqliteSecurityRepository
    outbox: SqliteOutboxAdapter
    inbox: SqliteInboxAdapter
    outbox_poller: OutboxPoller | None
    readiness_service: ReadinessService
    alerting_service: AlertingService
    metrics_registry: object

    async def close(self) -> None:
        if self.outbox_poller is not None:
            await self.outbox_poller.stop()
        await self.connection.close()


_container: Optional[OipContainer] = None


async def build_container(settings: OipSettings | None = None) -> OipContainer:
    settings = settings or get_oip_settings()
    flags = FeatureFlags(settings)

    conn = await open_oip_database(settings.database_url)
    await migrate_oip_schema(conn)

    outbox = SqliteOutboxAdapter(conn)
    inbox = SqliteInboxAdapter(conn)
    audit_sink = SqliteAuditSinkAdapter(conn)
    lineage_repo = SqliteLineageRepositoryAdapter(conn)
    security_repository = SqliteSecurityRepository(conn)
    secret_provider = get_secret_provider()
    permission_registry = create_default_permission_registry()
    credential_vault = CredentialVault(secret_provider)
    jwt_service = JwtService(settings, security_repository, permission_registry, secret_provider)
    api_key_service = ApiKeyService(settings, security_repository, permission_registry, secret_provider)
    security_event_service = SecurityEventService(security_repository)
    rate_limiter = RateLimiter(
        max_requests=settings.rate_limit_max_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )

    audit_service_base = AuditService(audit_sink)
    audit_service = SecurityAuditService(audit_service_base, credential_vault)
    lineage_service = LineageService(lineage_repo)
    conversation_repo = SqliteConversationRepositoryAdapter(conn)
    conversation_service = ConversationService(conversation_repo, outbox)
    session_repo = SqliteSessionRepositoryAdapter(conn)
    session_service = SessionService(session_repo)
    legacy_session_adapter = LegacySessionContextAdapter()

    policy_port = DefaultPlanningPolicyAdapter()
    tool_registry = DefaultToolRegistryAdapter()
    skill_registry = DefaultSkillRegistryAdapter()
    capability_registry = DefaultCapabilityRegistryAdapter()
    budget_port = DefaultExecutionBudgetAdapter()
    pipeline = build_planning_pipeline(
        policy_port=policy_port,
        tool_registry=tool_registry,
        skill_registry=skill_registry,
        capability_registry=capability_registry,
        budget_port=budget_port,
    )
    plan_repository = SqliteExecutionPlanRepositoryAdapter(conn)
    planner_service = PlannerService(
        pipeline=pipeline,
        repository=plan_repository,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
    )

    route_repository = SqliteRouteDecisionRepositoryAdapter(conn)
    provider_catalog = create_default_provider_registry()
    provider_registry = ProviderRegistryAdapter(provider_catalog)
    tool_catalog = create_default_execution_tool_registry()
    tool_registry_router = ExecutionToolRegistryAdapter(tool_catalog)
    routing_policy_port = DefaultRoutingPolicyAdapter()
    edition_port = DefaultEditionCapabilityAdapter()
    decision_port = DefaultPolicyDecisionAdapter()
    health_port = SqliteProviderHealthAdapter(route_repository, provider_catalog)
    routing_pipeline = build_routing_pipeline(
        policy_port=routing_policy_port,
        provider_registry=provider_registry,
        tool_registry=tool_registry_router,
        health_port=health_port,
        edition_port=edition_port,
        decision_port=decision_port,
        preferred_provider_id=settings.default_provider,
    )
    router_service = RouterService(
        pipeline=routing_pipeline,
        repository=route_repository,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        plan_loader=plan_repository,
    )

    execution_repository = SqliteExecutionRepositoryAdapter(conn)
    execution_policy_port = DefaultExecutionPolicyAdapter()
    execution_health_port = DefaultExecutionHealthAdapter()
    capability_token_port = SqliteCapabilityTokenAdapter(execution_repository)
    tool_sandbox_port = DefaultToolSandboxAdapter(capability_token_port)
    execution_budget_port = ProviderRuntimeBudgetAdapter()
    provider_adapter_registry = ProviderAdapterRegistry(
        config=ProviderRuntimeConfig(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key,
            google_api_key=settings.google_api_key,
            groq_api_key=settings.groq_api_key,
            ollama_base_url=settings.ollama_base_url,
            provider_timeout_seconds=settings.provider_timeout_seconds,
            max_retries=settings.max_retries,
            retry_backoff_seconds=settings.retry_backoff,
            offline_mode=settings.provider_offline_mode,
            force_stub_providers=settings.force_stub_providers,
            default_provider=settings.default_provider,
            default_model=settings.default_model,
        )
    )
    streaming_port = DefaultStreamingAdapter()
    usage_collector_port = DefaultUsageCollectorAdapter()
    artifact_store_port = LocalArtifactStoreAdapter()
    execution_pipeline = build_execution_pipeline(
        policy_port=execution_policy_port,
        health_port=execution_health_port,
        token_port=capability_token_port,
        sandbox_port=tool_sandbox_port,
        budget_port=execution_budget_port,
        adapter_registry=provider_adapter_registry,
        streaming_port=streaming_port,
        usage_port=usage_collector_port,
        artifact_port=artifact_store_port,
    )
    provider_runtime_service = ProviderRuntimeService(
        pipeline=execution_pipeline,
        repository=execution_repository,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        route_loader=route_repository,
    )

    quality_repository = SqliteQualityRepositoryAdapter(conn)
    erp_validation_port = DefaultERPValidationAdapter()
    accounting_validation_port = DefaultAccountingValidationAdapter()
    business_rule_port = DefaultBusinessRuleAdapter()
    jurisdiction_rule_port = DefaultJurisdictionRuleAdapter()
    evidence_validation_port = DefaultEvidenceValidationAdapter()
    knowledge_authority_port = DefaultKnowledgeAuthorityAdapter()
    risk_scoring_port = DefaultRiskScoringAdapter()
    ai_quality_port = DefaultAIQualityValidationAdapter()
    quality_pipeline = build_quality_gate_pipeline(
        erp_port=erp_validation_port,
        accounting_port=accounting_validation_port,
        business_port=business_rule_port,
        jurisdiction_port=jurisdiction_rule_port,
        evidence_port=evidence_validation_port,
        authority_port=knowledge_authority_port,
        risk_port=risk_scoring_port,
        ai_port=ai_quality_port,
        rule_repo=quality_repository,
    )
    quality_gate_service = QualityGateService(
        pipeline=quality_pipeline,
        repository=quality_repository,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        execution_loader=execution_repository,
    )

    oec_repository = SqliteOecRepositoryAdapter(conn)
    await oec_repository.ensure_seeded()
    oec_connector_registry = build_connector_registry(conn=conn, repository=oec_repository)
    oec_pipeline = build_oec_pipeline(
        repository=oec_repository,
        connector_registry=oec_connector_registry,
        audit_service=audit_service,
        lineage_service=lineage_service,
        outbox=outbox,
        settings=settings,
    )
    oec_runtime_service = OecRuntimeService(
        pipeline=oec_pipeline,
        repository=oec_repository,
        connector_registry=oec_connector_registry,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
    )

    action_repository = SqliteActionRepositoryAdapter(conn)
    action_registry = create_default_action_registry()
    erp_query_port = ErpQueryAdapter(oec_runtime_service)
    erp_command_port = ErpCommandAdapter(oec_runtime_service)
    action_policy_port = DefaultActionPolicyAdapter()
    approval_port = DefaultApprovalAdapter()
    snapshot_port = DefaultSnapshotAdapter(erp_query_port)
    permission_port = RbacPermissionAdapter(permission_registry)
    capability_port = DefaultActionCapabilityAdapter()
    compensation_port = DefaultCompensationAdapter()
    action_pipeline = build_action_runtime_pipeline(
        registry=action_registry,
        policy_port=action_policy_port,
        approval_port=approval_port,
        snapshot_port=snapshot_port,
        erp_query=erp_query_port,
        permission_port=permission_port,
        capability_port=capability_port,
        erp_command=erp_command_port,
        compensation_port=compensation_port,
        repository=action_repository,
    )
    action_runtime_service = ActionRuntimeService(
        pipeline=action_pipeline,
        repository=action_repository,
        registry=action_registry,
        approval_port=approval_port,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        execution_loader=execution_repository,
        evaluation_loader=quality_repository,
    )

    stream_repository = SqliteStreamRepositoryAdapter(conn)
    memory_replay = MemoryReplayBufferAdapter()
    persistent_replay = PersistentReplayBufferAdapter(conn)
    replay_buffer = CompositeReplayBufferAdapter(memory_replay, persistent_replay)
    transport_registry = create_default_transport_registry()
    sse_transport = SSETransportAdapter()
    streaming_transport = RegistryStreamingTransportPort(
        transport_registry,
        default_protocol=settings.stream_transport,
    )
    shadow_streaming = flags.shadow_streaming_runtime_writes
    streaming_pipeline = build_streaming_pipeline(
        repository=stream_repository,
        replay_buffer=replay_buffer,
        transport=streaming_transport,
        shadow_mode=shadow_streaming,
        replay_buffer_size=settings.stream_replay_buffer,
    )
    streaming_runtime_service = StreamingRuntimeService(
        pipeline=streaming_pipeline,
        repository=stream_repository,
        replay_buffer=replay_buffer,
        transport=streaming_transport,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
    )

    event_bus = InboxAwareEventBus(inbox)
    publisher = InProcessEventPublisher(event_bus)
    outbox_dispatcher = OutboxDispatcher(
        outbox,
        event_bus,
        max_attempts=settings.outbox_max_attempts,
    )
    outbox_poller = OutboxPoller(
        outbox_dispatcher,
        interval_seconds=settings.outbox_poller_interval_seconds,
    )
    readiness_service = ReadinessService(
        conn=conn,
        outbox=outbox,
        settings=settings,
        secret_provider=secret_provider,
    )
    alerting_service = AlertingService(
        readiness=readiness_service,
        outbox=outbox,
        security_events=security_event_service,
    )
    metrics_registry = get_metrics_registry()

    workflow_repository = SqliteWorkflowRepositoryAdapter(conn)

    knowledge_repository = SqliteKnowledgeRepositoryAdapter(
        conn,
        embedding_version=settings.knowledge_embedding_version,
    )
    await knowledge_repository.ensure_seeded()
    authority_registry = AuthorityRegistryAdapter()
    jurisdiction_registry = JurisdictionRegistryAdapter()
    lexical_search = LexicalSearchAdapter(knowledge_repository)
    semantic_search = SemanticSearchAdapter(knowledge_repository)
    hybrid_ranking = HybridRankingAdapter()
    embedding_provider = HashEmbeddingProviderAdapter(conn)
    knowledge_snapshot = KnowledgeSnapshotAdapter()
    knowledge_pipeline = build_knowledge_pipeline(
        repository=knowledge_repository,
        lexical=lexical_search,
        semantic=semantic_search,
        ranking=hybrid_ranking,
        authority=authority_registry,
        jurisdiction=jurisdiction_registry,
        settings=settings,
    )
    knowledge_runtime_service = KnowledgeRuntimeService(
        pipeline=knowledge_pipeline,
        repository=knowledge_repository,
        snapshot_port=knowledge_snapshot,
        embedding_port=embedding_provider,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
    )

    memory_repository = SqliteMemoryRepositoryAdapter(conn)
    memory_store_pipeline = build_memory_store_pipeline(
        repository=memory_repository,
        conn=conn,
        settings=settings,
    )
    recall_registry = build_recall_strategy_registry(repository=memory_repository)
    memory_cache = MemoryCacheAdapter()
    memory_runtime_service = MemoryRuntimeService(
        store_pipeline=memory_store_pipeline,
        repository=memory_repository,
        recall_registry=recall_registry,
        cache=memory_cache,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
    )

    module_ports = build_module_ports(
        conversation=conversation_service,
        session=session_service,
        planner=planner_service,
        router=router_service,
        knowledge=knowledge_runtime_service,
        memory=memory_runtime_service,
        provider_runtime=provider_runtime_service,
        quality_gate=quality_gate_service,
        action_runtime=action_runtime_service,
        streaming_runtime=streaming_runtime_service,
        plan_repository=plan_repository,
        route_repository=route_repository,
        legacy_session=legacy_session_adapter,
        outbox_dispatcher=outbox_dispatcher,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        feature_flags=flags,
    )
    stage_port_registry = instrument_stage_registry(
        build_stage_port_registry(module_ports, workflow_repository)
    )
    workflow_engine = build_workflow_engine(
        stage_ports=stage_port_registry,
        repository=workflow_repository,
        settings=settings,
    )
    orchestrator_service = OrchestratorService(
        engine=workflow_engine,
        repository=workflow_repository,
        outbox=outbox,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
    )

    command_bus = CommandBus()
    query_bus = QueryBus()

    command_bus.register(
        "oip.command.intelligence.submit_request.v1",
        SubmitIntelligenceRequestHandler(outbox),
    )
    command_bus.register(
        "oip.command.audit.record_shadow.v1",
        RecordShadowAuditHandler(audit_service),
    )
    command_bus.register(
        "oip.command.lineage.append_node.v1",
        AppendLineageNodeHandler(lineage_service),
    )

    query_bus.register(
        "oip.query.lineage.get_trace.v1",
        GetLineageTraceHandler(lineage_service),
    )
    query_bus.register(
        "oip.query.audit.get_chain.v1",
        GetAuditChainHandler(audit_service),
    )

    command_bus.register(
        "oip.command.conversation.ensure.v1",
        EnsureConversationHandler(conversation_service),
    )
    command_bus.register(
        "oip.command.conversation.record_user_message.v1",
        RecordUserMessageHandler(conversation_service),
    )
    command_bus.register(
        "oip.command.conversation.record_assistant_message.v1",
        RecordAssistantMessageHandler(conversation_service),
    )
    command_bus.register(
        "oip.command.conversation.close.v1",
        CloseConversationHandler(conversation_service),
    )

    query_bus.register(
        "oip.query.conversation.get.v1",
        GetConversationHandler(conversation_service),
    )
    query_bus.register(
        "oip.query.conversation.get_by_session.v1",
        GetConversationBySessionHandler(conversation_service),
    )
    query_bus.register(
        "oip.query.conversation.get_history.v1",
        GetConversationHistoryHandler(conversation_service),
    )

    command_bus.register(
        "oip.command.session.open.v1",
        OpenSessionHandler(session_service),
    )
    command_bus.register(
        "oip.command.session.bind_context.v1",
        BindSessionContextHandler(session_service),
    )
    command_bus.register(
        "oip.command.session.close.v1",
        CloseSessionHandler(session_service),
    )
    query_bus.register(
        "oip.query.session.get.v1",
        GetSessionHandler(session_service),
    )

    command_bus.register(
        "oip.command.planner.create_plan.v1",
        CreateExecutionPlanHandler(planner_service),
    )
    command_bus.register(
        "oip.command.planner.validate_plan.v1",
        ValidateExecutionPlanHandler(planner_service),
    )
    command_bus.register(
        "oip.command.planner.cancel_plan.v1",
        CancelExecutionPlanHandler(planner_service),
    )
    command_bus.register(
        "oip.command.planner.expire_plan.v1",
        ExpireExecutionPlanHandler(planner_service),
    )
    command_bus.register(
        "oip.command.planner.archive_plan.v1",
        ArchiveExecutionPlanHandler(planner_service),
    )
    query_bus.register(
        "oip.query.planner.get_plan.v1",
        GetExecutionPlanHandler(planner_service),
    )
    query_bus.register(
        "oip.query.planner.get_steps.v1",
        GetExecutionStepsHandler(planner_service),
    )
    query_bus.register(
        "oip.query.planner.get_status.v1",
        GetExecutionStatusHandler(planner_service),
    )
    query_bus.register(
        "oip.query.planner.search_plans.v1",
        SearchExecutionPlansHandler(plan_repository),
    )
    query_bus.register(
        "oip.query.planner.get_metrics.v1",
        GetPlannerMetricsHandler(planner_service),
    )

    command_bus.register(
        "oip.command.router.create_route.v1",
        CreateRouteDecisionHandler(router_service),
    )
    command_bus.register(
        "oip.command.router.approve_route.v1",
        ApproveRouteHandler(router_service),
    )
    command_bus.register(
        "oip.command.router.reject_route.v1",
        RejectRouteHandler(router_service),
    )
    command_bus.register(
        "oip.command.router.expire_route.v1",
        ExpireRouteHandler(router_service),
    )
    command_bus.register(
        "oip.command.router.archive_route.v1",
        ArchiveRouteHandler(router_service),
    )
    query_bus.register(
        "oip.query.router.get_route.v1",
        GetRouteDecisionHandler(router_service),
    )
    query_bus.register(
        "oip.query.router.get_routes.v1",
        GetRoutesHandler(route_repository),
    )
    query_bus.register(
        "oip.query.router.get_provider_health.v1",
        GetProviderHealthHandler(health_port, route_repository),
    )
    query_bus.register(
        "oip.query.router.get_metrics.v1",
        GetRoutingMetricsHandler(route_repository),
    )
    query_bus.register(
        "oip.query.router.search_routes.v1",
        SearchRoutesHandler(route_repository),
    )

    command_bus.register(
        "oip.command.provider_runtime.start_execution.v1",
        StartExecutionHandler(provider_runtime_service),
    )
    command_bus.register(
        "oip.command.provider_runtime.cancel_execution.v1",
        CancelExecutionHandler(provider_runtime_service),
    )
    command_bus.register(
        "oip.command.provider_runtime.retry_execution.v1",
        RetryExecutionHandler(provider_runtime_service),
    )
    command_bus.register(
        "oip.command.provider_runtime.timeout_execution.v1",
        TimeoutExecutionHandler(provider_runtime_service),
    )
    command_bus.register(
        "oip.command.provider_runtime.checkpoint_execution.v1",
        CheckpointExecutionHandler(provider_runtime_service),
    )
    command_bus.register(
        "oip.command.provider_runtime.archive_execution.v1",
        ArchiveExecutionHandler(provider_runtime_service),
    )
    query_bus.register(
        "oip.query.provider_runtime.get_execution.v1",
        GetExecutionHandler(provider_runtime_service),
    )
    query_bus.register(
        "oip.query.provider_runtime.get_status.v1",
        GetExecutionStatusHandler(provider_runtime_service),
    )
    query_bus.register(
        "oip.query.provider_runtime.get_usage.v1",
        GetExecutionUsageHandler(execution_repository),
    )
    query_bus.register(
        "oip.query.provider_runtime.get_artifacts.v1",
        GetExecutionArtifactsHandler(execution_repository),
    )
    query_bus.register(
        "oip.query.provider_runtime.get_metrics.v1",
        ExecutionMetricsHandler(execution_repository),
    )
    query_bus.register(
        "oip.query.provider_runtime.search_executions.v1",
        SearchExecutionsHandler(execution_repository),
    )

    command_bus.register(
        "oip.command.quality_gate.start_evaluation.v1",
        StartEvaluationHandler(quality_gate_service),
    )
    command_bus.register(
        "oip.command.quality_gate.approve_evaluation.v1",
        ApproveEvaluationHandler(quality_gate_service),
    )
    command_bus.register(
        "oip.command.quality_gate.reject_evaluation.v1",
        RejectEvaluationHandler(quality_gate_service),
    )
    command_bus.register(
        "oip.command.quality_gate.archive_evaluation.v1",
        ArchiveEvaluationHandler(quality_gate_service),
    )
    query_bus.register(
        "oip.query.quality_gate.get_evaluation.v1",
        GetEvaluationHandler(quality_gate_service),
    )
    query_bus.register(
        "oip.query.quality_gate.get_decision.v1",
        GetDecisionHandler(quality_gate_service),
    )
    query_bus.register(
        "oip.query.quality_gate.get_findings.v1",
        GetFindingsHandler(quality_gate_service),
    )
    query_bus.register(
        "oip.query.quality_gate.get_metrics.v1",
        QualityMetricsHandler(quality_repository),
    )
    query_bus.register(
        "oip.query.quality_gate.search_evaluations.v1",
        SearchEvaluationsHandler(quality_repository),
    )

    command_bus.register(
        "oip.command.action_runtime.propose_action.v1",
        ProposeActionHandler(action_runtime_service),
    )
    command_bus.register(
        "oip.command.action_runtime.approve_action.v1",
        ApproveActionHandler(action_runtime_service),
    )
    command_bus.register(
        "oip.command.action_runtime.reject_action.v1",
        RejectActionHandler(action_runtime_service),
    )
    command_bus.register(
        "oip.command.action_runtime.cancel_action.v1",
        CancelActionHandler(action_runtime_service),
    )
    query_bus.register(
        "oip.query.action_runtime.get_action.v1",
        GetActionHandler(action_runtime_service),
    )
    query_bus.register(
        "oip.query.action_runtime.get_metrics.v1",
        ActionMetricsHandler(action_repository),
    )
    query_bus.register(
        "oip.query.action_runtime.search_actions.v1",
        SearchActionsHandler(action_repository),
    )

    command_bus.register(
        "oip.command.streaming_runtime.open_stream.v1",
        OpenStreamHandler(streaming_runtime_service),
    )
    command_bus.register(
        "oip.command.streaming_runtime.close_stream.v1",
        CloseStreamHandler(streaming_runtime_service),
    )
    command_bus.register(
        "oip.command.streaming_runtime.ingest_workflow_event.v1",
        IngestWorkflowEventHandler(streaming_runtime_service),
    )
    command_bus.register(
        "oip.command.streaming_runtime.reconnect_stream.v1",
        ReconnectStreamHandler(streaming_runtime_service),
    )
    query_bus.register(
        "oip.query.streaming_runtime.get_stream.v1",
        GetStreamHandler(streaming_runtime_service),
    )
    query_bus.register(
        "oip.query.streaming_runtime.replay_stream.v1",
        ReplayStreamHandler(streaming_runtime_service),
    )
    query_bus.register(
        "oip.query.streaming_runtime.get_metrics.v1",
        StreamingMetricsHandler(streaming_runtime_service),
    )
    query_bus.register(
        "oip.query.streaming_runtime.list_streams.v1",
        ListStreamsHandler(stream_repository),
    )

    workflow_subscriber = WorkflowEventSubscriber(streaming_runtime_service)
    for event_type in (
        "oip.provider_runtime.execution.started.v1",
        "oip.provider_runtime.execution.chunk_produced.v1",
        "oip.provider_runtime.execution.completed.v1",
        "oip.provider_runtime.execution.failed.v1",
        "oip.quality_gate.quality_evaluation.started.v1",
        "oip.quality_gate.quality_gate.passed.v1",
        "oip.quality_gate.quality_gate.failed.v1",
        "oip.action_runtime.action.proposed.v1",
        "oip.action_runtime.action.approved.v1",
        "oip.action_runtime.action.executed.v1",
        "oip.action_runtime.action.rejected.v1",
    ):
        event_bus.subscribe(event_type, workflow_subscriber)

    command_bus.register(
        "oip.command.orchestrator.start_workflow.v1",
        StartWorkflowHandler(orchestrator_service),
    )
    command_bus.register(
        "oip.command.orchestrator.cancel_workflow.v1",
        CancelWorkflowHandler(orchestrator_service),
    )
    command_bus.register(
        "oip.command.orchestrator.archive_workflow.v1",
        ArchiveWorkflowHandler(orchestrator_service),
    )
    command_bus.register(
        "oip.command.orchestrator.recover_workflows.v1",
        RecoverWorkflowsHandler(orchestrator_service),
    )
    query_bus.register(
        "oip.query.orchestrator.get_workflow.v1",
        GetWorkflowHandler(orchestrator_service),
    )
    query_bus.register(
        "oip.query.orchestrator.list_workflows.v1",
        ListWorkflowsHandler(workflow_repository),
    )
    query_bus.register(
        "oip.query.orchestrator.get_timeline.v1",
        GetWorkflowTimelineHandler(orchestrator_service),
    )
    query_bus.register(
        "oip.query.orchestrator.get_metrics.v1",
        WorkflowMetricsHandler(orchestrator_service),
    )

    command_bus.register(
        "oip.command.knowledge.retrieve.v1",
        RetrieveKnowledgeHandler(knowledge_runtime_service),
    )
    command_bus.register(
        "oip.command.knowledge.index_document.v1",
        IndexKnowledgeHandler(knowledge_runtime_service),
    )
    command_bus.register(
        "oip.command.knowledge.reembed.v1",
        ReembedKnowledgeHandler(knowledge_runtime_service),
    )
    query_bus.register(
        "oip.query.knowledge.get_document.v1",
        GetKnowledgeDocumentHandler(knowledge_runtime_service),
    )
    query_bus.register(
        "oip.query.knowledge.get_bundle.v1",
        GetEvidenceBundleHandler(knowledge_runtime_service),
    )
    query_bus.register(
        "oip.query.knowledge.get_retrieval.v1",
        GetRetrievalHandler(knowledge_runtime_service),
    )
    query_bus.register(
        "oip.query.knowledge.get_metrics.v1",
        KnowledgeMetricsHandler(knowledge_runtime_service),
    )

    command_bus.register(
        "oip.command.memory.store.v1",
        StoreMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.update.v1",
        UpdateMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.merge.v1",
        MergeMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.archive.v1",
        ArchiveMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.delete.v1",
        DeleteMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.expire.v1",
        ExpireMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.promote.v1",
        PromoteMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.demote.v1",
        DemoteMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.consolidate.v1",
        ConsolidateMemoryHandler(memory_runtime_service),
    )
    command_bus.register(
        "oip.command.memory.recall.v1",
        RecallMemoryHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.get.v1",
        GetMemoryHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.timeline.v1",
        TimelineHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.search.v1",
        SearchMemoryHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.pattern_search.v1",
        PatternSearchHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.related.v1",
        RelatedMemoryHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.metrics.v1",
        MemoryMetricsHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.collections.v1",
        CollectionsHandler(memory_runtime_service),
    )
    query_bus.register(
        "oip.query.memory.statistics.v1",
        StatisticsHandler(memory_runtime_service),
    )

    command_bus.register(
        "oip.command.oec.register_connector.v1",
        RegisterConnectorHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.execute_command.v1",
        ExecuteERPCommandHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.execute_query.v1",
        ExecuteERPQueryHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.retry_execution.v1",
        OecRetryExecutionHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.cancel_execution.v1",
        OecCancelExecutionHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.archive_connector.v1",
        ArchiveConnectorHandler(oec_runtime_service),
    )
    command_bus.register(
        "oip.command.oec.unregister_connector.v1",
        UnregisterConnectorHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.get_connector.v1",
        GetConnectorHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.search_connectors.v1",
        SearchConnectorsHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.health.v1",
        ConnectorHealthHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.metrics.v1",
        ConnectorMetricsHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.capabilities.v1",
        ConnectorCapabilitiesHandler(oec_runtime_service),
    )
    query_bus.register(
        "oip.query.oec.execution_history.v1",
        ExecutionHistoryHandler(oec_runtime_service),
    )

    kernel_inner = IntelligenceKernelFacade(
        command_bus=command_bus,
        outbox_dispatcher=outbox_dispatcher,
        audit_service=audit_service_base,
        lineage_service=lineage_service,
        conversation_service=conversation_service,
        session_service=session_service,
        planner_service=planner_service,
        router_service=router_service,
        provider_runtime_service=provider_runtime_service,
        quality_gate_service=quality_gate_service,
        action_runtime_service=action_runtime_service,
        legacy_session_adapter=legacy_session_adapter,
        orchestrator_service=orchestrator_service,
        feature_flags=flags,
    )
    kernel = SecuredIntelligenceKernelFacade(
        inner=kernel_inner,
        settings=settings,
        permission_registry=permission_registry,
    )

    _ = publisher

    command_bus = InstrumentedCommandBus(command_bus)
    query_bus = InstrumentedQueryBus(query_bus)

    if settings.outbox_poller_enabled:
        await outbox_poller.start()

    return OipContainer(
        settings=settings,
        feature_flags=flags,
        connection=conn,
        command_bus=command_bus,
        query_bus=query_bus,
        event_bus=event_bus,
        kernel=kernel,
        outbox_dispatcher=outbox_dispatcher,
        conversation_service=conversation_service,
        session_service=session_service,
        planner_service=planner_service,
        plan_repository=plan_repository,
        router_service=router_service,
        route_repository=route_repository,
        provider_runtime_service=provider_runtime_service,
        execution_repository=execution_repository,
        quality_gate_service=quality_gate_service,
        quality_repository=quality_repository,
        action_runtime_service=action_runtime_service,
        action_repository=action_repository,
        erp_command_port=erp_command_port,
        streaming_runtime_service=streaming_runtime_service,
        stream_repository=stream_repository,
        streaming_transport=streaming_transport,
        sse_transport=sse_transport,
        orchestrator_service=orchestrator_service,
        workflow_repository=workflow_repository,
        knowledge_runtime_service=knowledge_runtime_service,
        knowledge_repository=knowledge_repository,
        memory_runtime_service=memory_runtime_service,
        memory_repository=memory_repository,
        oec_runtime_service=oec_runtime_service,
        oec_repository=oec_repository,
        jwt_service=jwt_service,
        api_key_service=api_key_service,
        permission_registry=permission_registry,
        security_event_service=security_event_service,
        rate_limiter=rate_limiter,
        credential_vault=credential_vault,
        security_repository=security_repository,
        outbox=outbox,
        inbox=inbox,
        outbox_poller=outbox_poller,
        readiness_service=readiness_service,
        alerting_service=alerting_service,
        metrics_registry=metrics_registry,
    )


async def get_container() -> OipContainer:
    global _container
    if _container is None:
        _container = await build_container()
    return _container


async def shutdown_container() -> None:
    global _container
    if _container is not None:
        await _container.close()
        _container = None
