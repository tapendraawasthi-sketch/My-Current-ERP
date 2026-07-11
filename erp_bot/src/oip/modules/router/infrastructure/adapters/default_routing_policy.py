"""Default routing policy adapter."""

from __future__ import annotations

from ...application.ports.routing_ports import RoutingPolicyPort
from ...domain.value_objects import RoutingPolicy, RoutingPolicyName


class DefaultRoutingPolicyAdapter(RoutingPolicyPort):
    _POLICIES: dict[RoutingPolicyName, RoutingPolicy] = {
        RoutingPolicyName.FAST: RoutingPolicy(name=RoutingPolicyName.FAST, prefer_latency=0.6, prefer_cost=0.2, prefer_quality=0.2),
        RoutingPolicyName.BALANCED: RoutingPolicy(name=RoutingPolicyName.BALANCED),
        RoutingPolicyName.QUALITY: RoutingPolicy(name=RoutingPolicyName.QUALITY, prefer_quality=0.6, prefer_latency=0.2, prefer_cost=0.2, min_quality=0.8),
        RoutingPolicyName.OFFLINE: RoutingPolicy(name=RoutingPolicyName.OFFLINE, offline_only=True, prefer_cost=0.5, prefer_latency=0.3, prefer_quality=0.2),
        RoutingPolicyName.ACCOUNTING: RoutingPolicy(name=RoutingPolicyName.ACCOUNTING, prefer_quality=0.5, prefer_latency=0.25, prefer_cost=0.25, min_quality=0.85),
        RoutingPolicyName.GOVERNMENT: RoutingPolicy(name=RoutingPolicyName.GOVERNMENT, prefer_quality=0.55, prefer_latency=0.25, prefer_cost=0.2, min_quality=0.9),
        RoutingPolicyName.LOW_COST: RoutingPolicy(name=RoutingPolicyName.LOW_COST, prefer_cost=0.6, prefer_latency=0.25, prefer_quality=0.15),
        RoutingPolicyName.HYBRID: RoutingPolicy(name=RoutingPolicyName.HYBRID, prefer_latency=0.34, prefer_cost=0.33, prefer_quality=0.33),
    }

    def resolve(self, *, policy_name: RoutingPolicyName) -> RoutingPolicy:
        return self._POLICIES.get(policy_name, self._POLICIES[RoutingPolicyName.BALANCED])
