"""Default execution policy adapter."""

from __future__ import annotations

from ...application.ports.execution_ports import ExecutionPolicyPort
from ...domain.value_objects import ExecutionPolicy, ExecutionPolicyName

_POLICIES: dict[ExecutionPolicyName, ExecutionPolicy] = {
    ExecutionPolicyName.FAST: ExecutionPolicy(
        name=ExecutionPolicyName.FAST,
        max_latency_ms=10_000,
        max_cost_micros=200_000,
        max_tokens=8_000,
        streaming_enabled=True,
    ),
    ExecutionPolicyName.BALANCED: ExecutionPolicy(
        name=ExecutionPolicyName.BALANCED,
        max_latency_ms=30_000,
        max_cost_micros=500_000,
        max_tokens=16_000,
        streaming_enabled=True,
    ),
    ExecutionPolicyName.QUALITY: ExecutionPolicy(
        name=ExecutionPolicyName.QUALITY,
        max_latency_ms=60_000,
        max_cost_micros=1_000_000,
        max_tokens=32_000,
        streaming_enabled=True,
    ),
    ExecutionPolicyName.ACCOUNTING: ExecutionPolicy(
        name=ExecutionPolicyName.ACCOUNTING,
        max_latency_ms=45_000,
        max_cost_micros=750_000,
        max_tokens=16_000,
        streaming_enabled=False,
        require_capability_token=True,
    ),
    ExecutionPolicyName.GOVERNMENT: ExecutionPolicy(
        name=ExecutionPolicyName.GOVERNMENT,
        max_latency_ms=60_000,
        max_cost_micros=500_000,
        max_tokens=16_000,
        streaming_enabled=False,
        require_capability_token=True,
    ),
    ExecutionPolicyName.OFFLINE: ExecutionPolicy(
        name=ExecutionPolicyName.OFFLINE,
        max_latency_ms=120_000,
        max_cost_micros=0,
        max_tokens=8_000,
        streaming_enabled=False,
        offline_only=True,
    ),
    ExecutionPolicyName.LOW_COST: ExecutionPolicy(
        name=ExecutionPolicyName.LOW_COST,
        max_latency_ms=45_000,
        max_cost_micros=100_000,
        max_tokens=8_000,
        streaming_enabled=True,
    ),
    ExecutionPolicyName.HYBRID: ExecutionPolicy(
        name=ExecutionPolicyName.HYBRID,
        max_latency_ms=30_000,
        max_cost_micros=400_000,
        max_tokens=16_000,
        streaming_enabled=True,
    ),
}


class DefaultExecutionPolicyAdapter(ExecutionPolicyPort):
    def resolve(self, *, policy_name: ExecutionPolicyName) -> ExecutionPolicy:
        return _POLICIES.get(policy_name, _POLICIES[ExecutionPolicyName.BALANCED])
