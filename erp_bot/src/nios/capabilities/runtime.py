"""Contract-complete capability runtime — binds descriptors to BaseCapability."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from ..contracts.intelligence_contract import (
    BaseCapability,
    CapabilityDescriptor,
    ExecutionPlan,
    ExecutionResult,
    ExplanationEnvelope,
    ObserveContext,
    Observation,
    TruthRecord,
    UILDocument,
    VerificationReport,
    make_observation,
    utc_now,
)
from ..intelligence.evidence_verify import build_evidence_bundle, explanation_with_evidence
from ..representations.uil_parser import parse_to_uil

ExecuteFn = Callable[[dict[str, Any]], dict[str, Any]]


class ContractCapability(BaseCapability):
    """Full 7-stage Intelligence Contract with injected deterministic executor."""

    def __init__(
        self,
        descriptor: CapabilityDescriptor,
        executor: ExecuteFn,
        *,
        default_action: str = "query",
    ) -> None:
        self.descriptor = descriptor
        self._executor = executor
        self._default_action = default_action

    async def observe(self, ctx: ObserveContext) -> Observation:
        raw = ""
        if isinstance(ctx.raw_input, str):
            raw = ctx.raw_input
        elif isinstance(ctx.raw_input, dict):
            raw = str(ctx.raw_input.get("message", ctx.raw_input.get("text", "")))
        return make_observation(ctx, raw or None)

    async def understand(self, obs: Observation) -> UILDocument:
        text = obs.raw_text or ""
        if text.strip():
            return parse_to_uil(text)
        return UILDocument(
            id=obs.id,
            version="1.0",
            action=self._default_action,
            confidence=0.9,
            goals=[self._default_action],
            source_text=text,
            dependencies=[self.descriptor.id],
        )

    async def execute(self, plan: ExecutionPlan, ctx: dict[str, Any]) -> ExecutionResult:
        try:
            outputs = self._executor(ctx)
            ok = bool(outputs.get("ok", True))
            return ExecutionResult(
                plan_id=plan.id,
                capability_id=self.descriptor.id,
                ok=ok,
                outputs=outputs,
                evidence_ids=list(outputs.get("evidence_ids", [])),
                error=outputs.get("error"),
            )
        except Exception as exc:
            return ExecutionResult(
                plan_id=plan.id,
                capability_id=self.descriptor.id,
                ok=False,
                outputs={},
                error=str(exc),
            )

    async def verify(self, result: ExecutionResult) -> VerificationReport:
        from ..knowledge.policy_engine import PolicyContext, evaluate_policies

        checks = [{"name": "execution_ok", "passed": result.ok, "detail": result.error}]
        truth_records: list[TruthRecord] = []
        if result.ok and result.outputs:
            bundle = build_evidence_bundle(
                str(result.outputs.get("summary", result.outputs))[:500],
                [self.descriptor.id],
                session_id=None,
            )
            truth_records = bundle["truth_records"]
            checks.append({"name": "evidence_bundle", "passed": bundle["validation"]["ok"]})

        has_engine = any(
            token in self.descriptor.id
            for token in ("engine", "tax", "payroll", "erp", "accounting", "banking")
        )
        policy_violations = evaluate_policies(
            PolicyContext(
                capability_id=self.descriptor.id,
                has_engine_evidence=has_engine and result.ok,
                has_legal_citation="legal" in self.descriptor.id,
                amount_mentioned=bool(result.outputs.get("amount") or result.outputs.get("vat_amount")),
                amount=float(result.outputs.get("amount", 0) or 0),
                confidence=1.0 if result.ok else 0.0,
            )
        )
        blocking = [v for v in policy_violations if v.get("severity") == "block"]
        checks.append({"name": "policy_dsl", "passed": len(blocking) == 0, "detail": blocking[:2]})

        return VerificationReport(
            ok=result.ok and all(c["passed"] for c in checks),
            capability_id=result.capability_id,
            checks=checks,
            truth_records=truth_records,
        )

    async def explain(self, verified: VerificationReport) -> ExplanationEnvelope:
        summary = "Completed successfully." if verified.ok else "Execution failed."
        if verified.truth_records:
            summary = verified.truth_records[0].statement[:300]
        return explanation_with_evidence(
            summary,
            [verified.capability_id],
            confidence=1.0 if verified.ok else 0.0,
            formula_used=[verified.capability_id],
            extra_truth=verified.truth_records or None,
        )

    async def learn(self, verified: VerificationReport, feedback: dict | None = None) -> Any:
        from ..contracts.intelligence_contract import LearningObservation

        return LearningObservation(
            capability_id=verified.capability_id,
            observation_type="success" if verified.ok else "failure",
            payload={"feedback": feedback or {}, "checks": len(verified.checks)},
            timestamp=utc_now(),
        )

    async def run_contract(self, ctx: ObserveContext, raw_text: str = "") -> tuple[ExplanationEnvelope, dict[str, Any]]:
        if raw_text:
            ctx = ObserveContext(
                session_id=ctx.session_id,
                channel=ctx.channel,
                raw_input={"message": raw_text},
                tenant_id=ctx.tenant_id,
                company_id=ctx.company_id,
                user_id=ctx.user_id,
                metadata=ctx.metadata,
            )
        obs = await self.observe(ctx)
        uil = await self.understand(obs)
        plan = await self.plan(uil)
        exec_ctx = {
            "session_id": ctx.session_id,
            "tenant_id": ctx.tenant_id,
            "company_id": ctx.company_id,
            "balance": ctx.metadata.get("balance"),
            "message": obs.raw_text or raw_text,
            "uil": uil,
            "payload": ctx.metadata.get("payload", {}),
        }
        result = await self.execute(plan, exec_ctx)
        verified = await self.verify(result)
        explanation = await self.explain(verified)
        learning = await self.learn(verified)
        trace = {
            "observation_id": obs.id,
            "uil_id": uil.id,
            "plan_id": plan.id,
            "capability_id": self.descriptor.id,
            "learning_type": learning.observation_type,
            "stages": ["observe", "understand", "plan", "execute", "verify", "explain", "learn"],
        }
        return explanation, trace


class CapabilityRuntime:
    """Registry of contract-complete capability instances."""

    def __init__(self) -> None:
        self._impls: dict[str, ContractCapability] = {}

    def register(self, impl: ContractCapability) -> None:
        self._impls[impl.descriptor.id] = impl

    def get(self, cap_id: str) -> ContractCapability | None:
        return self._impls.get(cap_id)

    def list_ids(self) -> list[str]:
        return list(self._impls.keys())

    async def run(self, cap_id: str, ctx: ObserveContext, message: str = "") -> tuple[ExplanationEnvelope, dict[str, Any]]:
        impl = self.get(cap_id)
        if not impl:
            raise KeyError(f"No contract implementation for {cap_id}")
        return await impl.run_contract(ctx, message)

    def run_sync(self, cap_id: str, ctx: ObserveContext, message: str = "") -> tuple[ExplanationEnvelope, dict[str, Any]]:
        return asyncio.get_event_loop().run_until_complete(self.run(cap_id, ctx, message))


capability_runtime = CapabilityRuntime()
