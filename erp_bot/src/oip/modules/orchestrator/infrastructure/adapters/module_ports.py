"""Bounded-context module ports — orchestrator coordinates through these only."""

from __future__ import annotations

from dataclasses import dataclass

from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import FeatureFlags, OipSettings
from .....infrastructure.messaging.outbox_dispatcher import OutboxDispatcher
from ....action_runtime.application.services.action_runtime_service import ActionRuntimeService
from ....conversation.application.services.conversation_service import ConversationService
from ....planner.application.services.planner_service import PlannerService
from ....planner.infrastructure.persistence.plan_sqlite import SqliteExecutionPlanRepositoryAdapter
from ....provider_runtime.application.services.provider_runtime_service import ProviderRuntimeService
from ....quality_gate.application.services.quality_gate_service import QualityGateService
from ....router.application.services.router_service import RouterService
from ....router.infrastructure.persistence.route_sqlite import SqliteRouteDecisionRepositoryAdapter
from ....session.application.services.session_service import SessionService
from ....session.infrastructure.adapters.legacy_session_adapter import LegacySessionContextAdapter
from ....streaming_runtime.application.services.streaming_runtime_service import StreamingRuntimeService
from ....knowledge.application.services.knowledge_runtime_service import KnowledgeRuntimeService
from ....memory.application.services.memory_runtime_service import MemoryRuntimeService


@dataclass(frozen=True)
class ModulePorts:
    conversation: ConversationService | None
    session: SessionService | None
    planner: PlannerService | None
    router: RouterService | None
    knowledge: KnowledgeRuntimeService | None
    memory: MemoryRuntimeService | None
    provider_runtime: ProviderRuntimeService | None
    quality_gate: QualityGateService | None
    action_runtime: ActionRuntimeService | None
    streaming_runtime: StreamingRuntimeService | None
    plan_repository: SqliteExecutionPlanRepositoryAdapter | None
    route_repository: SqliteRouteDecisionRepositoryAdapter | None
    legacy_session: LegacySessionContextAdapter
    outbox_dispatcher: OutboxDispatcher
    audit_service: AuditService
    lineage_service: LineageService
    settings: OipSettings
    feature_flags: FeatureFlags
