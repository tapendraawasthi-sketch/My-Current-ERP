"""Continuous Evaluator — evaluate at every pipeline stage."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvalScore:
    stage: str
    score: float
    passed: bool
    details: str = ""


@dataclass
class EvalReport:
    scores: list[EvalScore] = field(default_factory=list)
    should_retry: bool = False
    should_escalate: bool = False
    should_research: bool = False

    @property
    def min_score(self) -> float:
        return min((s.score for s in self.scores), default=1.0)


def evaluate_retrieval(chunks: list[dict], min_chunks: int = 1) -> EvalScore:
    n = len(chunks)
    score = min(1.0, n / max(min_chunks, 1))
    return EvalScore(
        stage="retrieve",
        score=score,
        passed=n >= min_chunks,
        details=f"{n} chunks retrieved",
    )


def evaluate_truth(ok: bool, unsupported_count: int) -> EvalScore:
    score = 1.0 if ok else max(0.0, 1.0 - unsupported_count * 0.3)
    return EvalScore(
        stage="verify",
        score=score,
        passed=ok,
        details=f"unsupported={unsupported_count}",
    )


def evaluate_execution(ok: bool, error: str | None = None) -> EvalScore:
    return EvalScore(
        stage="execute",
        score=1.0 if ok else 0.0,
        passed=ok,
        details=error or "ok",
    )


def evaluate_uil_confidence(confidence: float, threshold: float = 0.6) -> EvalScore:
    return EvalScore(
        stage="understand",
        score=confidence,
        passed=confidence >= threshold,
        details=f"uil_confidence={confidence:.2f}",
    )


def merge_evaluations(*scores: EvalScore) -> EvalReport:
    report = EvalReport(scores=list(scores))
    report.should_retry = any(not s.passed for s in scores if s.stage in ("retrieve", "execute"))
    report.should_escalate = report.min_score < 0.5
    report.should_research = any(
        s.stage == "retrieve" and not s.passed for s in scores
    )
    return report
