"""Build orchestrator stage registry and engine."""

from __future__ import annotations

from ....application.services.audit_service import AuditService
from ....application.services.lineage_service import LineageService
from ....config.settings import FeatureFlags, OipSettings
from ....infrastructure.messaging.outbox_dispatcher import OutboxDispatcher
from ...action_runtime.application.services.action_runtime_service import ActionRuntimeService
from ...conversation.application.services.conversation_service import ConversationService
from ...planner.application.services.planner_service import PlannerService
from ...planner.infrastructure.persistence.plan_sqlite import SqliteExecutionPlanRepositoryAdapter
from ...provider_runtime.application.services.provider_runtime_service import ProviderRuntimeService
from ...quality_gate.application.services.quality_gate_service import QualityGateService
from ...router.application.services.router_service import RouterService
from ...router.infrastructure.persistence.route_sqlite import SqliteRouteDecisionRepositoryAdapter
from ...session.application.services.session_service import SessionService
from ...session.infrastructure.adapters.legacy_session_adapter import LegacySessionContextAdapter
from ...streaming_runtime.application.services.streaming_runtime_service import StreamingRuntimeService
from ...knowledge.application.services.knowledge_runtime_service import KnowledgeRuntimeService
from ...memory.application.services.memory_runtime_service import MemoryRuntimeService
from ..application.ports.workflow_engine_port import WorkflowEnginePort
from ..application.ports.workflow_repository_port import WorkflowRepositoryPort
from ..domain.stage_registry import create_default_stage_registry
from .adapters.module_ports import ModulePorts
from .adapters.sequential_workflow_engine import SequentialWorkflowEngine
from .adapters.stage_port_registry import StagePortRegistry
from .adapters.stages.module_stages import (
    ActionStageAdapter,
    ConversationStageAdapter,
    ExecutionStageAdapter,
    FinalizeStageAdapter,
    KnowledgeStageAdapter,
    MemoryConsolidationStageAdapter,
    MemoryStoreStageAdapter,
    MemoryUpdateStageAdapter,
    PersistenceStageAdapter,
    PlanningStageAdapter,
    PublicationStageAdapter,
    QualityStageAdapter,
    RoutingStageAdapter,
    SessionStageAdapter,
    StreamingStageAdapter,
    ValidationStageAdapter,
)


def build_module_ports(
    *,
    conversation: ConversationService | None,
    session: SessionService | None,
    planner: PlannerService | None,
    router: RouterService | None,
    knowledge: KnowledgeRuntimeService | None,
    memory: MemoryRuntimeService | None,
    provider_runtime: ProviderRuntimeService | None,
    quality_gate: QualityGateService | None,
    action_runtime: ActionRuntimeService | None,
    streaming_runtime: StreamingRuntimeService | None,
    plan_repository: SqliteExecutionPlanRepositoryAdapter | None,
    route_repository: SqliteRouteDecisionRepositoryAdapter | None,
    legacy_session: LegacySessionContextAdapter,
    outbox_dispatcher: OutboxDispatcher,
    audit_service: AuditService,
    lineage_service: LineageService,
    settings: OipSettings,
    feature_flags: FeatureFlags,
) -> ModulePorts:
    return ModulePorts(
        conversation=conversation,
        session=session,
        planner=planner,
        router=router,
        knowledge=knowledge,
        memory=memory,
        provider_runtime=provider_runtime,
        quality_gate=quality_gate,
        action_runtime=action_runtime,
        streaming_runtime=streaming_runtime,
        plan_repository=plan_repository,
        route_repository=route_repository,
        legacy_session=legacy_session,
        outbox_dispatcher=outbox_dispatcher,
        audit_service=audit_service,
        lineage_service=lineage_service,
        settings=settings,
        feature_flags=feature_flags,
    )


def build_stage_port_registry(
    ports: ModulePorts,
    repository: WorkflowRepositoryPort,
) -> StagePortRegistry:
    registry = StagePortRegistry()
    registry.register(ValidationStageAdapter(ports))
    registry.register(ConversationStageAdapter(ports))
    registry.register(SessionStageAdapter(ports))
    registry.register(PlanningStageAdapter(ports))
    registry.register(RoutingStageAdapter(ports))
    registry.register(KnowledgeStageAdapter(ports))
    registry.register(MemoryStoreStageAdapter(ports))
    registry.register(ExecutionStageAdapter(ports))
    registry.register(MemoryUpdateStageAdapter(ports))
    registry.register(QualityStageAdapter(ports))
    registry.register(ActionStageAdapter(ports))
    registry.register(MemoryConsolidationStageAdapter(ports))
    registry.register(StreamingStageAdapter(ports))
    registry.register(FinalizeStageAdapter(ports))
    registry.register(PersistenceStageAdapter(ports, repository))
    registry.register(PublicationStageAdapter(ports))
    return registry


def build_workflow_engine(
    *,
    stage_ports: StagePortRegistry,
    repository: WorkflowRepositoryPort,
    settings: OipSettings,
) -> WorkflowEnginePort:
    return SequentialWorkflowEngine(
        stage_ports=stage_ports,
        stage_registry=create_default_stage_registry(),
        repository=repository,
        max_retries=settings.max_retries,
        retry_backoff=settings.retry_backoff,
    )
