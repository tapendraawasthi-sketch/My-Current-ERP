"""Explanation Engine — full auditable answer envelope."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from ..contracts.intelligence_contract import ExplanationEnvelope, TruthRecord, utc_now


def build_explanation(
    summary: str,
    *,
    truth_records: list[TruthRecord] | None = None,
    reasoning_chain: list[str] | None = None,
    law_references: list[str] | None = None,
    formula_used: list[str] | None = None,
    confidence: float = 1.0,
    alternatives: list[str] | None = None,
    impact: dict[str, Any] | None = None,
    risks: list[str] | None = None,
    next_steps: list[str] | None = None,
) -> ExplanationEnvelope:
    return ExplanationEnvelope(
        summary=summary,
        evidence=truth_records or [],
        confidence=confidence,
        reasoning_chain=reasoning_chain or [],
        next_steps=next_steps or [],
        formula_used=formula_used or [],
        alternatives=alternatives or [],
        impact=impact,
        risks=risks or [],
    )


def explanation_from_simulation(sim: Any) -> ExplanationEnvelope:
    records = [
        TruthRecord(
            statement=imp,
            evidence=[sim.simulation_id],
            source="cap.engine.simulation",
            confidence=1.0,
            timestamp=utc_now(),
            verification_status="verified_deterministic",
            jurisdiction="NP",
        )
        for imp in (sim.impacts or [])[:5]
    ]
    return build_explanation(
        summary="\n".join(sim.impacts) if sim.impacts else sim.scenario,
        truth_records=records,
        reasoning_chain=[
            f"Baseline net pay: Rs. {sim.baseline.get('net_pay', 0):,.2f}",
            f"Projected net pay: Rs. {sim.projected.get('net_pay', 0):,.2f}",
        ],
        formula_used=["cap.engine.payroll", "compute_nepal_annual_tax"],
        confidence=sim.confidence,
        impact={"deltas": sim.deltas},
        risks=["Actual payroll may differ if allowances/EPF flags change"],
        next_steps=["Confirm with HR", "Update payroll master if approved"],
    )


def explanation_from_scenario(comparison: Any) -> ExplanationEnvelope:
    return build_explanation(
        summary=comparison.recommendation,
        reasoning_chain=comparison.tradeoffs,
        confidence=0.95,
        alternatives=[b.name for b in comparison.branches[1:3]],
        next_steps=["Review assumptions", "Run detailed cashflow projection"],
    )


def envelope_to_dict(env: ExplanationEnvelope) -> dict:
    return {
        "summary": env.summary,
        "confidence": env.confidence,
        "reasoning_chain": env.reasoning_chain,
        "formula_used": env.formula_used,
        "evidence": [asdict(e) for e in env.evidence],
        "alternatives": env.alternatives,
        "impact": env.impact,
        "risks": env.risks,
        "next_steps": env.next_steps,
    }
