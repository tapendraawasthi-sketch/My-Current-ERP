"""Constraint resolution stage — registry-based evaluators."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable, Protocol

from ...domain.entities import ExecutionConstraint
from ..ports.planning_policy_port import PlanningPolicyPort
from .context import PlanningContext


class ConstraintEvaluator(Protocol):
    name: str

    def evaluate(self, context: PlanningContext) -> dict:
        """Return constraint fragment."""


ConstraintEvaluatorFn = Callable[[PlanningContext], dict]


class ConstraintEvaluatorRegistry:
    def __init__(self) -> None:
        self._evaluators: dict[str, ConstraintEvaluatorFn] = {}

    def register(self, name: str, evaluator: ConstraintEvaluatorFn) -> None:
        self._evaluators[name] = evaluator

    def evaluate_all(self, context: PlanningContext) -> dict:
        merged: dict = {}
        for evaluator in self._evaluators.values():
            merged.update(evaluator(context))
        return merged


def create_default_constraint_registry() -> ConstraintEvaluatorRegistry:
    registry = ConstraintEvaluatorRegistry()

    def policy_constraints(context: PlanningContext) -> dict:
        policy = context.policy
        if policy is None:
            return {}
        return {
            "max_latency_ms": policy.max_latency_ms,
            "max_tokens": policy.max_tokens,
            "max_cost_micros": policy.max_cost_micros,
            "offline_only": policy.offline_only,
        }

    def fiscal_constraints(context: PlanningContext) -> dict:
        if context.intent in {"journal_entry", "report_generation"}:
            return {
                "fiscal_restrictions": {
                    "period_guard_required": True,
                    "approval_required": context.intent == "journal_entry",
                }
            }
        return {"fiscal_restrictions": {}}

    def module_restrictions(context: PlanningContext) -> dict:
        restrictions: dict = {"provider_restrictions": (), "tool_restrictions": ()}
        if context.request.module == "nios":
            restrictions["provider_restrictions"] = ("cloud_only",)
        if context.policy and context.policy.offline_only:
            restrictions["provider_restrictions"] = ("local_only",)
        return restrictions

    registry.register("policy", policy_constraints)
    registry.register("fiscal", fiscal_constraints)
    registry.register("module", module_restrictions)
    return registry


class ConstraintResolutionStage:
    name = "constraint_resolution"

    def __init__(
        self,
        policy_port: PlanningPolicyPort,
        evaluator_registry: ConstraintEvaluatorRegistry,
    ) -> None:
        self._policy_port = policy_port
        self._evaluators = evaluator_registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        context.policy = self._policy_port.resolve(
            policy_name=context.request.policy_name,
            module=context.request.module,
        )
        resolved = self._evaluators.evaluate_all(context)
        now = datetime.now(timezone.utc)
        context.constraints = ExecutionConstraint(
            constraint_id=str(uuid.uuid4()),
            plan_id="pending",
            tenant_id=context.request.tenant_id,
            max_latency_ms=resolved.get("max_latency_ms"),
            max_tokens=resolved.get("max_tokens"),
            max_cost_micros=resolved.get("max_cost_micros"),
            offline_only=bool(resolved.get("offline_only", False)),
            provider_restrictions=tuple(resolved.get("provider_restrictions", ())),
            tool_restrictions=tuple(resolved.get("tool_restrictions", ())),
            knowledge_restrictions=tuple(resolved.get("knowledge_restrictions", ())),
            fiscal_restrictions=dict(resolved.get("fiscal_restrictions", {})),
            created_at=now,
        )
        context.stop_conditions = (
            "max_latency_exceeded",
            "quality_gate_failed",
            "user_cancelled",
        )
        return context
