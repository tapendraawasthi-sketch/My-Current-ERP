"""Retry policy — Cognitive OS owns retries, not planners."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RetryDecision:
    should_retry: bool
    reason: str
    max_attempts: int = 3


def decide_retry(uncertainty: float, attempt: int, evidence_coverage: float) -> RetryDecision:
    if attempt >= 3:
        return RetryDecision(False, "Max attempts reached", max_attempts=3)

    if uncertainty > 0.55 and evidence_coverage < 0.7:
        return RetryDecision(True, f"Re-retrieve (attempt {attempt + 1})", max_attempts=3)

    if uncertainty > 0.7 and attempt < 2:
        return RetryDecision(True, f"Re-reason with decomposition (attempt {attempt + 1})", max_attempts=3)

    return RetryDecision(False, "Confidence sufficient", max_attempts=3)
