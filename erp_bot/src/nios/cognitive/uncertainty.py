"""Uncertainty estimation for Cognitive OS."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class UncertaintyState:
    score: float
    sources: list[str]


def estimate_uncertainty(text: str, uil_confidence: float, evidence_coverage: float) -> UncertaintyState:
    sources: list[str] = []
    score = 1.0 - uil_confidence

    if evidence_coverage < 0.8:
        score += 0.15
        sources.append("low_evidence_coverage")

    if re.search(r"\b(maybe|perhaps|lagda|maybe|unclear)\b", text, re.I):
        score += 0.1
        sources.append("hedging_language")

    if not re.search(r"\d", text) and re.search(r"\b(tax|vat|salary|balance)\b", text, re.I):
        score += 0.08
        sources.append("missing_amount")

    if len(text.split()) > 25:
        score += 0.05
        sources.append("long_complex_query")

    return UncertaintyState(score=min(1.0, score), sources=sources)
