"""Agent Society — 11 roles with evidence-weighted consensus."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Plan: Manager, Planner, Researcher, Calculator, Accountant, Lawyer,
# Tax Advisor, Investor, Risk Officer, Auditor, Reviewer
AGENT_ROLES = (
    "manager",
    "planner",
    "researcher",
    "calculator",
    "accountant",
    "lawyer",
    "tax_advisor",
    "investor",
    "risk_officer",
    "auditor",
    "reviewer",
)

ROLE_WEIGHTS = {
    "auditor": 1.2,
    "lawyer": 1.15,
    "calculator": 1.2,
    "tax_advisor": 1.1,
    "accountant": 1.05,
    "risk_officer": 1.05,
    "reviewer": 1.0,
    "investor": 0.95,
    "researcher": 0.9,
    "planner": 0.85,
    "manager": 0.8,
}


@dataclass
class AgentOpinion:
    role: str
    statement: str
    confidence: float
    evidence: list[str] = field(default_factory=list)
    weight: float = 1.0


def consensus_merge(opinions: list[AgentOpinion]) -> dict[str, Any]:
    if not opinions:
        return {"statement": "", "confidence": 0.0, "consensus": False, "evidence": [], "roles": []}

    weighted = []
    for op in opinions:
        w = ROLE_WEIGHTS.get(op.role, 1.0) * op.weight * op.confidence
        weighted.append((w, op))
    weighted.sort(key=lambda x: -x[0])
    best = weighted[0][1]

    confidences = [o.confidence for o in opinions]
    spread = max(confidences) - min(confidences) if len(confidences) > 1 else 0.0
    consensus = spread < 0.25

    all_evidence: list[str] = []
    for op in opinions:
        all_evidence.extend(op.evidence)

    return {
        "statement": best.statement,
        "confidence": best.confidence,
        "consensus": consensus,
        "disagreement_spread": spread,
        "roles": [o.role for o in opinions],
        "evidence": list(dict.fromkeys(all_evidence)),
        "primary_role": best.role,
        "auditor_challenge": _auditor_challenge(opinions),
    }


def _auditor_challenge(opinions: list[AgentOpinion]) -> str | None:
    auditor = next((o for o in opinions if o.role == "auditor"), None)
    calc = next((o for o in opinions if o.role == "calculator"), None)
    if auditor and calc and calc.confidence < 1.0:
        return "Auditor: Engine evidence required before filing."
    return auditor.statement[:120] if auditor else None


def build_society_opinions(
    message: str,
    knowledge_text: str,
    engine_result: str | None,
    uil_confidence: float,
    *,
    uil_action: str = "query",
) -> list[AgentOpinion]:
    """Build opinions from all 11 agent roles."""
    opinions: list[AgentOpinion] = []

    opinions.append(AgentOpinion("manager", f"Decomposed goal for: {message[:80]}", 0.8, ["goal_tree"]))
    opinions.append(AgentOpinion("planner", f"Execution graph for action={uil_action}", 0.85, ["capability_registry"]))

    if knowledge_text:
        opinions.append(AgentOpinion("researcher", knowledge_text[:400], 0.82, ["cap.knowledge.nepal.search", "federation.vector"]))
        opinions.append(AgentOpinion("lawyer", knowledge_text[:300], 0.85, ["cap.legal.act_search", "federation.gov"]))

    if engine_result:
        opinions.append(AgentOpinion("calculator", engine_result, 1.0, ["cap.engine.tax", "policy.ai.no_money_without_engine"]))
    else:
        opinions.append(AgentOpinion("calculator", "No engine output — do not state tax amounts.", 0.5, []))

    opinions.append(AgentOpinion("accountant", "Apply NFRS / double-entry validation before post.", 0.9, ["cap.engine.journal"]))
    opinions.append(AgentOpinion("tax_advisor", "Nepal IRD rules apply; cite VAT Act / Income Tax Act.", uil_confidence, ["cap.knowledge.nepal.search"]))

    if "invest" in message.lower() or "nepse" in message.lower():
        opinions.append(AgentOpinion("investor", "Check NEPSE quote and DCF before recommendation.", 0.8, ["cap.investment.nepse_quote"]))

    opinions.append(AgentOpinion("risk_officer", "Flag audit trigger if aggressive tax position.", 0.88, ["policy.accounting.dual_approval"]))
    opinions.append(AgentOpinion("auditor", "Demand provenance chain for all tax/legal facts.", 0.95, ["provenance_graph"]))
    opinions.append(AgentOpinion("reviewer", "Consensus merge with evidence precedence: law > engine > ERP.", 0.9, ["agent.society"]))

    return opinions


def build_tax_opinions(knowledge_text: str, engine_result: str | None, uil_confidence: float) -> list[AgentOpinion]:
    return build_society_opinions("", knowledge_text, engine_result, uil_confidence, uil_action="tax_query")
