"""Continuous contract-stage evaluator."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class StageScore:
    stage: str
    passed: bool
    score: float
    detail: str = ""


@dataclass
class ContractEvaluation:
    capability_id: str
    stages: list[StageScore] = field(default_factory=list)

    @property
    def min_score(self) -> float:
        return min((s.score for s in self.stages), default=0.0)

    @property
    def ok(self) -> bool:
        return all(s.passed for s in self.stages)

    @property
    def should_research(self) -> bool:
        return self.min_score < 0.6


def evaluate_contract_trace(capability_id: str, trace: dict[str, Any], explanation: Any) -> ContractEvaluation:
    stages = [
        StageScore("observe", bool(trace.get("observation_id")), 1.0 if trace.get("observation_id") else 0.0),
        StageScore("understand", bool(trace.get("uil_id")), 1.0 if trace.get("uil_id") else 0.0),
        StageScore("plan", bool(trace.get("plan_id")), 1.0 if trace.get("plan_id") else 0.0),
        StageScore("execute", "stages" in trace and len(trace.get("stages", [])) >= 4, 0.9),
        StageScore(
            "verify",
            bool(getattr(explanation, "evidence", None) or (isinstance(explanation, dict) and explanation.get("evidence"))),
            0.95,
        ),
        StageScore(
            "explain",
            bool(getattr(explanation, "summary", None) or (isinstance(explanation, dict) and explanation.get("summary"))),
            float(getattr(explanation, "confidence", 0) or (explanation.get("confidence", 0) if isinstance(explanation, dict) else 0)),
        ),
        StageScore("learn", bool(trace.get("learning_type")), 1.0 if trace.get("learning_type") else 0.5),
    ]
    return ContractEvaluation(capability_id=capability_id, stages=stages)


contract_evaluator = type("CE", (), {"evaluate": staticmethod(evaluate_contract_trace)})()
