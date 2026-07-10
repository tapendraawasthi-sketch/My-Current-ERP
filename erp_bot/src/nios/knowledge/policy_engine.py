"""Policy Engine v1 — PolicyDSL in verify() stage."""

from __future__ import annotations

from dataclasses import dataclass

from .policy_dsl import BOOTSTRAP_POLICIES, evaluate_policy_rules


@dataclass
class PolicyContext:
    capability_id: str
    has_engine_evidence: bool = False
    has_legal_citation: bool = False
    amount_mentioned: bool = False
    amount: float = 0.0
    confidence: float = 1.0
    jurisdiction: str = "NP"
    log_output: bool = False


def evaluate_policies(ctx: PolicyContext) -> list[dict[str, str]]:
    dsl_ctx = {
        "capability_id": ctx.capability_id,
        "has_engine_evidence": ctx.has_engine_evidence,
        "has_legal_citation": ctx.has_legal_citation,
        "amount_mentioned": ctx.amount_mentioned,
        "amount": ctx.amount,
        "confidence": ctx.confidence,
        "jurisdiction": ctx.jurisdiction,
        "log_output": ctx.log_output,
    }
    return evaluate_policy_rules(BOOTSTRAP_POLICIES, dsl_ctx)


def policies_pass(ctx: PolicyContext) -> bool:
    return not any(v["severity"] == "block" for v in evaluate_policies(ctx))
