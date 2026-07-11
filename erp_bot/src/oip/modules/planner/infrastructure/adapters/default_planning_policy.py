"""Default planning policy adapter."""

from __future__ import annotations

from ...application.ports.planning_policy_port import PlanningPolicyPort
from ...domain.value_objects import (
    ExecutionMode,
    ExecutionPriority,
    PlanningPolicy,
    PlanningPolicyName,
)


class DefaultPlanningPolicyAdapter(PlanningPolicyPort):
    _POLICIES: dict[PlanningPolicyName, PlanningPolicy] = {
        PlanningPolicyName.FAST: PlanningPolicy(
            name=PlanningPolicyName.FAST,
            execution_mode=ExecutionMode.INTERACTIVE,
            priority=ExecutionPriority.NORMAL,
            max_latency_ms=8_000,
            max_tokens=4096,
            quality_gate_required=False,
            stream_enabled=True,
        ),
        PlanningPolicyName.BALANCED: PlanningPolicy(
            name=PlanningPolicyName.BALANCED,
            execution_mode=ExecutionMode.INTERACTIVE,
            priority=ExecutionPriority.NORMAL,
            max_latency_ms=20_000,
            max_tokens=8192,
            quality_gate_required=True,
        ),
        PlanningPolicyName.ACCURATE: PlanningPolicy(
            name=PlanningPolicyName.ACCURATE,
            execution_mode=ExecutionMode.INTERACTIVE,
            priority=ExecutionPriority.HIGH,
            max_latency_ms=45_000,
            max_tokens=12_288,
            quality_gate_required=True,
        ),
        PlanningPolicyName.ACCOUNTING: PlanningPolicy(
            name=PlanningPolicyName.ACCOUNTING,
            execution_mode=ExecutionMode.INTERACTIVE,
            priority=ExecutionPriority.HIGH,
            max_latency_ms=30_000,
            max_tokens=10_240,
            quality_gate_required=True,
        ),
        PlanningPolicyName.GOVERNMENT: PlanningPolicy(
            name=PlanningPolicyName.GOVERNMENT,
            execution_mode=ExecutionMode.BATCH,
            priority=ExecutionPriority.CRITICAL,
            max_latency_ms=60_000,
            max_tokens=8192,
            quality_gate_required=True,
        ),
        PlanningPolicyName.OFFLINE: PlanningPolicy(
            name=PlanningPolicyName.OFFLINE,
            execution_mode=ExecutionMode.OFFLINE,
            priority=ExecutionPriority.NORMAL,
            max_latency_ms=120_000,
            max_tokens=4096,
            offline_only=True,
            quality_gate_required=True,
        ),
        PlanningPolicyName.LOW_COST: PlanningPolicy(
            name=PlanningPolicyName.LOW_COST,
            execution_mode=ExecutionMode.INTERACTIVE,
            priority=ExecutionPriority.LOW,
            max_latency_ms=10_000,
            max_tokens=2048,
            max_cost_micros=1000,
            quality_gate_required=False,
        ),
    }

    def resolve(self, *, policy_name: PlanningPolicyName, module: str) -> PlanningPolicy:
        policy = self._POLICIES.get(policy_name, self._POLICIES[PlanningPolicyName.BALANCED])
        if module == "khata" and policy_name == PlanningPolicyName.BALANCED:
            return policy.model_copy(update={"quality_gate_required": True})
        return policy
