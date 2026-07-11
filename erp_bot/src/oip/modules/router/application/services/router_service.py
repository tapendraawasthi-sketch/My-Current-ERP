"""Router application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from ....planner.domain.entities import ExecutionPlan
from ...domain.entities import RouteDecision, RouteCandidate
from ...domain.events import (
    RouteApprovedEvent,
    RouteArchivedEvent,
    RouteDecisionCreatedEvent,
    RouteExpiredEvent,
    RouteRejectedEvent,
    build_route_event,
)
from ...domain.value_objects import (
    FallbackChain,
    ProviderSelection,
    RouteReason,
    RouteStatus,
    RoutingPolicyName,
    RoutingScore,
)
from ..pipeline.pipeline import RoutingPipeline
from ..ports.route_repository_port import RouteDecisionRepositoryPort
from ..ports.routing_ports import RoutingPort
from ..projectors.routing_projectors import RouteDecisionProjector
from ..read_models.routing_read_models import RouteDecisionReadModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RouterService(RoutingPort):
    def __init__(
        self,
        *,
        pipeline: RoutingPipeline,
        repository: RouteDecisionRepositoryPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
        plan_loader,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._plan_loader = plan_loader
        self._projector = RouteDecisionProjector()

    async def create_route_decision(
        self,
        *,
        plan: ExecutionPlan | None = None,
        plan_id: str | None = None,
        tenant_id: str | None = None,
        routing_policy: RoutingPolicyName | None = None,
    ) -> RouteDecision:
        if plan is None:
            if plan_id is None or tenant_id is None:
                raise ValueError("plan or (plan_id, tenant_id) required")
            plan = await self._plan_loader.get_by_id(tenant_id=tenant_id, plan_id=plan_id)
            if plan is None:
                raise ValueError(f"Execution plan not found: {plan_id}")

        policy_name = routing_policy or self._resolve_policy_name()

        context = await self._pipeline.execute(
            plan=plan,
            routing_policy=policy_name,
            edition=self._settings.edition.value,
            deployment_mode=self._settings.deployment_mode.value,
        )

        route_id = str(uuid.uuid4())
        now = _utc_now()
        primary_meta = next(
            (p for p in context.filtered_providers if p.provider_id == context.primary_provider_id),
            None,
        )
        primary_score = next(
            (c.score for c in context.scored_candidates if c.provider_id == context.primary_provider_id),
            RoutingScore(total=0.5),
        )

        candidates = tuple(
            candidate.model_copy(update={"route_id": route_id, "selected": candidate.provider_id == context.primary_provider_id})
            for candidate in context.scored_candidates
        )

        estimated_latency = primary_meta.default_latency_ms if primary_meta else plan.estimated_latency_ms
        estimated_cost = plan.estimated_cost_micros
        if primary_meta:
            estimated_cost = (plan.estimated_tokens // 1000 + 1) * primary_meta.default_cost_micros_per_1k

        goal_meta = plan.goal.metadata if plan.goal else {}
        execution_intent_type = (
            plan.execution_intent.intent_type if plan.execution_intent else plan.intent
        )
        policy_decisions = {
            **context.policy_decisions,
            "intent_type": plan.intent,
            "execution_intent_type": execution_intent_type,
            "user_message": goal_meta.get("user_message", ""),
        }

        decision = RouteDecision(
            route_id=route_id,
            plan_id=plan.plan_id,
            request_id=plan.request_id,
            tenant_id=plan.tenant_id,
            company_id=plan.company_id,
            conversation_id=plan.conversation_id,
            correlation_id=plan.correlation_id,
            status=RouteStatus.DRAFT,
            routing_policy=policy_name,
            edition=self._settings.edition.value,
            deployment_mode=self._settings.deployment_mode.value,
            primary_provider=ProviderSelection(
                provider_id=context.primary_provider_id,
                model_hint=None,
                capabilities=context.required_capabilities,
                score=primary_score,
            ),
            fallback_chain=FallbackChain(providers=context.fallback_providers),
            selected_tools=context.selected_tools,
            candidates=candidates,
            estimated_cost_micros=estimated_cost,
            estimated_latency_ms=estimated_latency,
            estimated_tokens=plan.estimated_tokens,
            expected_quality=primary_meta.quality_score if primary_meta else 0.7,
            policy_decisions=policy_decisions,
            reason_codes=tuple(RouteReason(code) for code in context.reason_codes if code in RouteReason._value2member_map_),
            health_snapshot=context.health_snapshot,
            created_at=now,
            updated_at=now,
        )

        await self._repository.save(decision)
        await self._emit(RouteDecisionCreatedEvent, decision, {"plan_id": plan.plan_id, "provider": decision.primary_provider.provider_id})
        await self._repository.increment_metrics(tenant_id=decision.tenant_id, metric="routes_created", estimated_latency_ms=decision.estimated_latency_ms, estimated_cost_micros=decision.estimated_cost_micros)
        await self._record_lineage(decision, plan)
        await self._audit_mutation(decision, "router.route.created")
        return decision

    async def approve_route(self, *, tenant_id: str, route_id: str) -> RouteDecision:
        decision = await self._require_route(tenant_id, route_id)
        if decision.status == RouteStatus.APPROVED:
            return decision
        now = _utc_now()
        approved = decision.model_copy(update={"status": RouteStatus.APPROVED, "approved_at": now, "updated_at": now})
        await self._repository.save(approved)
        await self._emit(RouteApprovedEvent, approved, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="routes_approved")
        await self._audit_mutation(approved, "router.route.approved")
        return approved

    async def reject_route(self, *, tenant_id: str, route_id: str, reason: str = "") -> RouteDecision:
        decision = await self._require_route(tenant_id, route_id)
        if decision.status == RouteStatus.REJECTED:
            return decision
        now = _utc_now()
        rejected = decision.model_copy(update={"status": RouteStatus.REJECTED, "rejected_at": now, "updated_at": now})
        await self._repository.save(rejected)
        await self._emit(RouteRejectedEvent, rejected, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="routes_rejected")
        await self._audit_mutation(rejected, "router.route.rejected", {"reason": reason})
        return rejected

    async def expire_route(self, *, tenant_id: str, route_id: str) -> RouteDecision:
        decision = await self._require_route(tenant_id, route_id)
        if decision.status == RouteStatus.EXPIRED:
            return decision
        now = _utc_now()
        expired = decision.model_copy(update={"status": RouteStatus.EXPIRED, "expired_at": now, "updated_at": now})
        await self._repository.save(expired)
        await self._emit(RouteExpiredEvent, expired, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="routes_expired")
        await self._audit_mutation(expired, "router.route.expired")
        return expired

    async def archive_route(self, *, tenant_id: str, route_id: str) -> RouteDecision:
        decision = await self._require_route(tenant_id, route_id)
        if decision.status == RouteStatus.ARCHIVED:
            return decision
        now = _utc_now()
        archived = decision.model_copy(update={"status": RouteStatus.ARCHIVED, "archived_at": now, "updated_at": now})
        await self._repository.save(archived)
        await self._emit(RouteArchivedEvent, archived, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="routes_archived")
        await self._audit_mutation(archived, "router.route.archived")
        return archived

    async def get_read_model(self, *, tenant_id: str, route_id: str) -> RouteDecisionReadModel | None:
        decision = await self._repository.get_by_id(tenant_id=tenant_id, route_id=route_id)
        return self._projector.project(decision) if decision else None

    async def _require_route(self, tenant_id: str, route_id: str) -> RouteDecision:
        decision = await self._repository.get_by_id(tenant_id=tenant_id, route_id=route_id)
        if decision is None:
            raise ValueError(f"Route decision not found: {route_id}")
        return decision

    async def _emit(self, event_cls, decision: RouteDecision, payload: dict) -> None:
        event = build_route_event(
            event_cls,
            tenant_id=decision.tenant_id,
            correlation_id=decision.correlation_id,
            company_id=decision.company_id,
            route_id=decision.route_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _audit_mutation(self, decision: RouteDecision, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=decision.tenant_id,
            request_id=decision.request_id,
            correlation_id=decision.correlation_id,
            event_name=event_name,
            payload_redacted={"route_id": decision.route_id, "provider": decision.primary_provider.provider_id, **(extra or {})},
        )

    async def _record_lineage(self, decision: RouteDecision, plan: ExecutionPlan) -> None:
        route_node = await self._lineage.append_node(
            tenant_id=decision.tenant_id,
            request_id=decision.request_id,
            node_type="RouteDecision",
            payload={"route_id": decision.route_id, "plan_id": plan.plan_id},
        )
        for candidate in decision.candidates:
            await self._lineage.append_node(
                tenant_id=decision.tenant_id,
                request_id=decision.request_id,
                node_type="ProviderCandidateEvaluation",
                parent_node_id=route_node.node_id,
                payload={
                    "route_id": decision.route_id,
                    "provider_id": candidate.provider_id,
                    "score": candidate.score.total,
                    "rank": candidate.rank_order,
                },
            )
        await self._lineage.append_node(
            tenant_id=decision.tenant_id,
            request_id=decision.request_id,
            node_type="PrimarySelection",
            parent_node_id=route_node.node_id,
            payload={"provider_id": decision.primary_provider.provider_id},
        )
        await self._lineage.append_node(
            tenant_id=decision.tenant_id,
            request_id=decision.request_id,
            node_type="FallbackChain",
            parent_node_id=route_node.node_id,
            payload={"providers": list(decision.fallback_chain.providers)},
        )

    def _resolve_policy_name(self) -> RoutingPolicyName:
        try:
            return RoutingPolicyName(self._settings.router_policy)
        except ValueError:
            return RoutingPolicyName.BALANCED
