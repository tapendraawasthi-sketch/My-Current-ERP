"""Policy decision adapter."""

from __future__ import annotations

from ...application.ports.routing_ports import PolicyDecisionPort
from ...domain.value_objects import RoutingPolicyName
from ....planner.domain.entities import ExecutionPlan


class DefaultPolicyDecisionAdapter(PolicyDecisionPort):
    def evaluate(
        self,
        *,
        plan: ExecutionPlan,
        routing_policy: RoutingPolicyName,
    ) -> dict:
        decisions = {
            "routing_policy": routing_policy.value,
            "module": plan.module,
            "intent": plan.intent,
            "quality_gate_required": plan.policy_name.value in {"accurate", "accounting", "government"},
        }
        if plan.constraints:
            decisions["offline_only"] = plan.constraints.offline_only
            decisions["max_latency_ms"] = plan.constraints.max_latency_ms
            decisions["fiscal_restrictions"] = plan.constraints.fiscal_restrictions
        if routing_policy == RoutingPolicyName.ACCOUNTING:
            decisions["accounting_policy"] = True
        if routing_policy == RoutingPolicyName.GOVERNMENT:
            decisions["government_policy"] = True
        return decisions
