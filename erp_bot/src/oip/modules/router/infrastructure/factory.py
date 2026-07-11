"""Build routing pipeline."""

from __future__ import annotations

from ..application.pipeline.pipeline import RoutingPipeline
from ..application.pipeline.stages import (
    CapabilityFilterStage,
    EditionFilterStage,
    FallbackConstructionStage,
    PolicyFilterStage,
    ProviderFilterStage,
    ScoringStage,
    ToolFilterStage,
)
from ..application.ports.routing_ports import (
    EditionCapabilityPort,
    PolicyDecisionPort,
    ProviderHealthPort,
    ProviderRegistryPort,
    RoutingPolicyPort,
    ToolRegistryPort,
)


def build_routing_pipeline(
    *,
    policy_port: RoutingPolicyPort,
    provider_registry: ProviderRegistryPort,
    tool_registry: ToolRegistryPort,
    health_port: ProviderHealthPort,
    edition_port: EditionCapabilityPort,
    decision_port: PolicyDecisionPort,
    preferred_provider_id: str = "",
) -> RoutingPipeline:
    stages = (
        CapabilityFilterStage(),
        EditionFilterStage(edition_port, provider_registry),
        PolicyFilterStage(policy_port, decision_port),
        ProviderFilterStage(health_port),
        ToolFilterStage(tool_registry),
        ScoringStage(),
        FallbackConstructionStage(preferred_provider_id=preferred_provider_id),
    )
    return RoutingPipeline(stages=stages)
