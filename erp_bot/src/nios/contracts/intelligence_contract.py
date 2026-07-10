"""NIOS Intelligence Contract — Python types and base class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

CONTRACT_VERSION = "1.0"
MarketplaceTier = Literal["capability", "skill", "workflow"]


@dataclass
class CapabilityDescriptor:
    id: str
    version: str
    contract_version: str
    tier: MarketplaceTier
    inputs: list[dict[str, Any]]
    outputs: list[dict[str, Any]]
    provides: list[str]
    requires: list[str]
    latency_p50_ms: int
    cost_tier: int
    confidence_floor: float
    description: str = ""


@dataclass
class ObserveContext:
    session_id: str
    channel: str
    raw_input: Any
    tenant_id: str | None = None
    company_id: str | None = None
    user_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Observation:
    id: str
    observed_at: str
    channel: str
    session_id: str
    raw_text: str | None = None
    raw_payload: dict[str, Any] | None = None
    tenant_id: str | None = None
    company_id: str | None = None


@dataclass
class UILDocument:
    id: str
    version: str
    action: str
    confidence: float
    goals: list[str]
    source_text: str | None = None
    dependencies: list[str] = field(default_factory=list)
    evidence_needed: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExecutionPlan:
    id: str
    goal: dict[str, Any]
    steps: list[dict[str, Any]]
    required_capabilities: list[str]
    confidence: float


@dataclass
class ExecutionResult:
    plan_id: str
    capability_id: str
    ok: bool
    outputs: dict[str, Any]
    evidence_ids: list[str] = field(default_factory=list)
    error: str | None = None


@dataclass
class TruthRecord:
    statement: str
    evidence: list[str]
    source: str
    confidence: float
    timestamp: str
    verification_status: str
    jurisdiction: str | None = None
    knowledge_version: str | None = None


@dataclass
class VerificationReport:
    ok: bool
    capability_id: str
    checks: list[dict[str, Any]]
    truth_records: list[TruthRecord] = field(default_factory=list)


@dataclass
class ExplanationEnvelope:
    summary: str
    evidence: list[TruthRecord]
    confidence: float
    reasoning_chain: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)
    formula_used: list[str] = field(default_factory=list)
    alternatives: list[str] = field(default_factory=list)
    impact: dict[str, Any] | None = None
    risks: list[str] = field(default_factory=list)


@dataclass
class LearningObservation:
    capability_id: str
    observation_type: str
    payload: dict[str, Any]
    timestamp: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_observation(ctx: ObserveContext, raw_text: str | None = None) -> Observation:
    payload = ctx.raw_input if isinstance(ctx.raw_input, dict) else None
    return Observation(
        id=str(uuid4()),
        observed_at=utc_now(),
        channel=ctx.channel,
        session_id=ctx.session_id,
        raw_text=raw_text,
        raw_payload=payload,
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
    )


def make_uil(text: str, action: str = "query", confidence: float = 0.5) -> UILDocument:
    return UILDocument(
        id=str(uuid4()),
        version=CONTRACT_VERSION,
        action=action,
        confidence=confidence,
        goals=[action],
        source_text=text,
    )


class BaseCapability(ABC):
    descriptor: CapabilityDescriptor

    @abstractmethod
    async def observe(self, ctx: ObserveContext) -> Observation: ...

    @abstractmethod
    async def understand(self, obs: Observation) -> UILDocument: ...

    @abstractmethod
    async def execute(self, plan: ExecutionPlan, ctx: dict[str, Any]) -> ExecutionResult: ...

    async def plan(self, uil: UILDocument, goal: str | None = None) -> ExecutionPlan:
        return ExecutionPlan(
            id=f"plan-{uil.id}",
            goal={"goal": goal or (uil.goals[0] if uil.goals else uil.action)},
            steps=[
                {
                    "id": "step-1",
                    "capabilityId": self.descriptor.id,
                    "action": uil.action,
                    "deps": [],
                }
            ],
            required_capabilities=[self.descriptor.id],
            confidence=uil.confidence,
        )

    async def verify(self, result: ExecutionResult) -> VerificationReport:
        return VerificationReport(
            ok=result.ok,
            capability_id=result.capability_id,
            checks=[{"name": "execution_ok", "passed": result.ok, "detail": result.error}],
        )

    async def explain(self, verified: VerificationReport) -> ExplanationEnvelope:
        return ExplanationEnvelope(
            summary="Completed successfully." if verified.ok else "Execution failed.",
            evidence=verified.truth_records,
            confidence=1.0 if verified.ok else 0.0,
        )

    async def learn(self, verified: VerificationReport, feedback: dict | None = None) -> LearningObservation:
        return LearningObservation(
            capability_id=verified.capability_id,
            observation_type="success" if verified.ok else "failure",
            payload=feedback or {},
            timestamp=utc_now(),
        )

    async def run_contract(self, ctx: ObserveContext, raw_text: str) -> tuple[ExplanationEnvelope, dict[str, Any]]:
        """Full 7-step lifecycle for Phase 0."""
        obs = await self.observe(ctx, raw_text) if False else await self.observe(ctx)
        obs.raw_text = raw_text
        uil = await self.understand(obs)
        plan = await self.plan(uil)
        result = await self.execute(plan, {"session_id": ctx.session_id})
        verified = await self.verify(result)
        explanation = await self.explain(verified)
        await self.learn(verified)
        trace = {
            "observation_id": obs.id,
            "uil_id": uil.id,
            "plan_id": plan.id,
            "capability_id": self.descriptor.id,
        }
        return explanation, trace
