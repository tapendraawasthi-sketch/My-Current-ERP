"""Routing pipeline stages."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.value_objects import (
    CapabilityKind,
    CapabilityMatch,
    CostEstimate,
    HealthScore,
    LatencyEstimate,
    QualityEstimate,
    RouteReason,
    RoutingScore,
    ToolSelection,
)
from ..ports.routing_ports import (
    EditionCapabilityPort,
    PolicyDecisionPort,
    ProviderHealthPort,
    ProviderRegistryPort,
    RoutingPolicyPort,
    ToolRegistryPort,
)
from .context import RoutingContext


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RoutingStage(Protocol):
    name: str

    async def run(self, context: RoutingContext) -> RoutingContext:
        ...


class CapabilityFilterStage:
    name = "capability_filter"

    async def run(self, context: RoutingContext) -> RoutingContext:
        required: set[str] = {CapabilityKind.CHAT.value, CapabilityKind.STREAMING.value}
        if context.plan.knowledge_required:
            required.add(CapabilityKind.LARGE_CONTEXT.value)
        if context.plan.tool_requirements:
            required.add(CapabilityKind.FUNCTION_CALLING.value)
        if context.plan.constraints and context.plan.constraints.offline_only:
            required.add(CapabilityKind.OFFLINE.value)
        context.required_capabilities = tuple(sorted(required))
        return context


class EditionFilterStage:
    name = "edition_filter"

    def __init__(self, edition_port: EditionCapabilityPort, provider_registry: ProviderRegistryPort) -> None:
        self._edition = edition_port
        self._providers = provider_registry

    async def run(self, context: RoutingContext) -> RoutingContext:
        offline_only = bool(context.plan.constraints and context.plan.constraints.offline_only)
        context.providers = self._providers.list_providers()
        context.filtered_providers = self._edition.filter_providers(
            providers=context.providers,
            edition=context.edition,
            deployment_mode=context.deployment_mode,
            offline_only=offline_only,
        )
        return context


class PolicyFilterStage:
    name = "policy_filter"

    def __init__(self, policy_port: RoutingPolicyPort, decision_port: PolicyDecisionPort) -> None:
        self._policy_port = policy_port
        self._decision_port = decision_port

    async def run(self, context: RoutingContext) -> RoutingContext:
        context.routing_policy = self._policy_port.resolve(policy_name=context.routing_policy_name)
        context.policy_decisions = self._decision_port.evaluate(
            plan=context.plan,
            routing_policy=context.routing_policy_name,
        )
        if context.routing_policy.offline_only:
            context.filtered_providers = tuple(
                p for p in context.filtered_providers if p.supports_offline or p.supports_local_models
            )
        if context.routing_policy_name.value == "accounting":
            context.filtered_providers = tuple(
                p for p in context.filtered_providers if p.accounting_certified or p.provider_id == "ollama"
            )
        if context.routing_policy_name.value == "government":
            context.filtered_providers = tuple(
                p for p in context.filtered_providers if p.government_certified or p.provider_id in {"azure_openai", "vertex_ai", "ollama"}
            )
        return context


class ProviderFilterStage:
    name = "provider_filter"

    def __init__(self, health_port: ProviderHealthPort) -> None:
        self._health = health_port

    async def run(self, context: RoutingContext) -> RoutingContext:
        healthy: list = []
        snapshot: dict[str, HealthScore] = {}
        for provider in context.filtered_providers:
            health = await self._health.get_health(provider_id=provider.provider_id, tenant_id=context.plan.tenant_id)
            snapshot[provider.provider_id] = health
            if health.circuit_state.value != "open" and health.availability >= 0.5:
                healthy.append(provider)
        context.health_snapshot = snapshot
        context.filtered_providers = tuple(healthy) if healthy else context.filtered_providers
        return context


class ToolFilterStage:
    name = "tool_filter"

    def __init__(self, tool_registry: ToolRegistryPort) -> None:
        self._tools = tool_registry

    async def run(self, context: RoutingContext) -> RoutingContext:
        tool_ids = tuple(t.tool_id for t in context.plan.tool_requirements)
        resolved = self._tools.resolve_tools(tool_ids=tool_ids)
        context.selected_tools = tuple(
            ToolSelection(
                tool_id=item["tool_id"],
                category=item["category"],
                required=True,
                routed_to="runtime",
            )
            for item in resolved
        )
        return context


class ScoringStage:
    name = "cost_latency_scoring"

    async def run(self, context: RoutingContext) -> RoutingContext:
        from ...domain.entities import RouteCandidate

        policy = context.routing_policy
        if policy is None:
            return context

        candidates: list[RouteCandidate] = []
        for index, provider in enumerate(context.filtered_providers, start=1):
            matched = tuple(c for c in context.required_capabilities if c in {cap.value for cap in provider.capabilities})
            missing = tuple(c for c in context.required_capabilities if c not in matched)
            cap_score = len(matched) / max(len(context.required_capabilities), 1)
            health = context.health_snapshot.get(provider.provider_id)
            health_score = health.score if isinstance(health, HealthScore) else 1.0
            latency_ms = provider.default_latency_ms
            cost_micros = (context.plan.estimated_tokens // 1000 + 1) * provider.default_cost_micros_per_1k
            quality = provider.quality_score
            latency_norm = max(0.0, 1.0 - (latency_ms / 10_000))
            cost_norm = max(0.0, 1.0 - (cost_micros / 500_000))
            total = (
                cap_score * 0.25
                + latency_norm * policy.prefer_latency
                + cost_norm * policy.prefer_cost
                + quality * policy.prefer_quality
                + health_score * 0.15
            )
            candidates.append(
                RouteCandidate(
                    candidate_id=str(uuid.uuid4()),
                    route_id="pending",
                    tenant_id=context.plan.tenant_id,
                    provider_id=provider.provider_id,
                    rank_order=index,
                    score=RoutingScore(
                        total=round(total, 4),
                        capability=cap_score,
                        latency=latency_norm,
                        cost=cost_norm,
                        quality=quality,
                        health=health_score,
                    ),
                    capability_match=CapabilityMatch(
                        required=context.required_capabilities,
                        matched=matched,
                        missing=missing,
                        score=cap_score,
                    ),
                    latency_estimate=LatencyEstimate(estimated_ms=latency_ms, p95_ms=int(latency_ms * 1.5)),
                    cost_estimate=CostEstimate(estimated_micros=cost_micros),
                    quality_estimate=QualityEstimate(score=quality, confidence=cap_score),
                    health_score=health if isinstance(health, HealthScore) else HealthScore(score=health_score),
                    reason_codes=(RouteReason.BEST_SCORE,) if index == 1 else (RouteReason.FALLBACK,),
                    selected=False,
                    created_at=_utc_now(),
                )
            )
        candidates.sort(key=lambda c: c.score.total, reverse=True)
        for rank, candidate in enumerate(candidates, start=1):
            candidates[rank - 1] = candidate.model_copy(update={"rank_order": rank})
        context.scored_candidates = tuple(candidates)
        return context


class FallbackConstructionStage:
    name = "fallback_construction"

    def __init__(self, preferred_provider_id: str = "") -> None:
        self._preferred_provider_id = preferred_provider_id.strip()

    async def run(self, context: RoutingContext) -> RoutingContext:
        if not context.scored_candidates:
            context.primary_provider_id = self._preferred_provider_id or "ollama"
            context.fallback_providers = ("custom",)
            context.reason_codes = ("fallback", "no_candidates")
            return context
        ordered = list(context.scored_candidates)
        if self._preferred_provider_id:
            preferred = next(
                (candidate for candidate in ordered if candidate.provider_id == self._preferred_provider_id),
                None,
            )
            if preferred is not None:
                ordered = [preferred] + [candidate for candidate in ordered if candidate.provider_id != self._preferred_provider_id]
        context.primary_provider_id = ordered[0].provider_id
        fallbacks = tuple(c.provider_id for c in ordered[1:4])
        if not fallbacks:
            fallbacks = ("ollama",) if context.primary_provider_id != "ollama" else ("custom",)
        context.fallback_providers = fallbacks
        context.reason_codes = tuple({r.value for c in ordered[:1] for r in c.reason_codes})
        return context
