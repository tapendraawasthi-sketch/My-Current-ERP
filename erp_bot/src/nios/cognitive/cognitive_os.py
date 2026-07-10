"""Cognitive OS — uncertainty, retries, decomposition, attention."""

from __future__ import annotations

from dataclasses import dataclass, field

from .attention import AttentionBudget, allocate_attention
from .retry import RetryDecision, decide_retry
from .uncertainty import UncertaintyState, estimate_uncertainty


@dataclass
class MetaDecision:
    action: str
    reason: str
    confidence: float
    uncertainty: float = 0.0
    retry: RetryDecision | None = None
    attention: AttentionBudget | None = None
    sub_problems: list[str] = field(default_factory=list)


class CognitiveOS:
    """Brainstem between kernel and planner — owns retries and attention."""

    def meta_decide(
        self,
        text: str,
        uil_confidence: float,
        capabilities: list[str],
        *,
        attempt: int = 0,
        evidence_coverage: float = 1.0,
        token_budget: int = 4000,
    ) -> MetaDecision:
        uncertainty = estimate_uncertainty(text, uil_confidence, evidence_coverage)
        attention = allocate_attention(token_budget, text, capabilities)
        retry = decide_retry(uncertainty.score, attempt, evidence_coverage)
        sub_problems = self.decompose(text, uil_confidence)

        lower = text.lower()
        import re

        if re.search(r"\b(balance|bakaya|baki|शेष)\b", lower, re.I):
            return MetaDecision(
                "execute_capability", "Ledger balance — deterministic path", 0.95,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        if re.search(r"\b(vat|tds|tax|कर)\b", lower, re.I) and re.search(r"\d", text):
            return MetaDecision(
                "calculate", "Numeric tax — engine required", 0.92,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        if re.search(r"\b(what if|yadi|simulate|optimize|best)\b", lower, re.I):
            return MetaDecision(
                "simulate", "Counterfactual intent", 0.8,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        if retry.should_retry:
            return MetaDecision(
                "retrieve", retry.reason, 0.7,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        if uil_confidence < 0.6 or uncertainty.score > 0.5:
            return MetaDecision(
                "ask_user", "Low confidence — clarify", 0.7,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        if any("knowledge" in c for c in capabilities):
            return MetaDecision(
                "retrieve", "Retrieve before reason", 0.75,
                uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
            )

        return MetaDecision(
            "escalate_model", "No deterministic path", 0.6,
            uncertainty=uncertainty.score, retry=retry, attention=attention, sub_problems=sub_problems,
        )

    def decompose(self, text: str, uil_confidence: float) -> list[str]:
        """Break ambiguous requests into UIL sub-problems."""
        import re

        parts: list[str] = []
        if " and " in text.lower():
            parts = [p.strip() for p in re.split(r"\band\b", text, flags=re.I) if p.strip()]
        elif uil_confidence < 0.65 and len(text.split()) > 8:
            parts = [text[: len(text) // 2], text[len(text) // 2 :]]
        return parts[:3]


cognitive_os = CognitiveOS()
