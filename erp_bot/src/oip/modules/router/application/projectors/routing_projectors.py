"""Routing projectors — replay-safe, idempotent."""

from __future__ import annotations

from datetime import datetime, timezone

from ...domain.entities import RouteDecision
from ..read_models.routing_read_models import (
    ProviderHealthReadModel,
    RouteDecisionReadModel,
    RoutingMetricsReadModel,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RouteDecisionProjector:
    def project(self, decision: RouteDecision | None) -> RouteDecisionReadModel | None:
        if decision is None:
            return None
        return RouteDecisionReadModel(
            route_id=decision.route_id,
            plan_id=decision.plan_id,
            request_id=decision.request_id,
            tenant_id=decision.tenant_id,
            company_id=decision.company_id,
            conversation_id=decision.conversation_id,
            correlation_id=decision.correlation_id,
            status=decision.status.value,
            routing_policy=decision.routing_policy.value,
            edition=decision.edition,
            deployment_mode=decision.deployment_mode,
            primary_provider_id=decision.primary_provider.provider_id,
            fallback_providers=decision.fallback_chain.providers,
            selected_tools=[t.model_dump(mode="json") for t in decision.selected_tools],
            estimated_cost_micros=decision.estimated_cost_micros,
            estimated_latency_ms=decision.estimated_latency_ms,
            estimated_tokens=decision.estimated_tokens,
            expected_quality=decision.expected_quality,
            reason_codes=tuple(r.value for r in decision.reason_codes),
            candidate_count=len(decision.candidates),
            created_at=decision.created_at,
            updated_at=decision.updated_at,
        )


class ProviderHealthProjector:
    def project(self, record: ProviderHealthReadModel) -> ProviderHealthReadModel:
        return record.model_copy(update={"updated_at": _utc_now()})


class RoutingMetricsProjector:
    def project(self, metrics: RoutingMetricsReadModel) -> RoutingMetricsReadModel:
        return metrics
