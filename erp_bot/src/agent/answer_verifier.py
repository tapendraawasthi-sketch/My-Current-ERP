"""Phase 7 — Verify 32b tax answers against RAG context (no paid APIs)."""

from __future__ import annotations

import re

_RATE_PATTERN = re.compile(
    r"(\d{1,2}(?:\.\d+)?)\s*%|(\d{1,2})\s*percent",
    re.I,
)


def extract_rate_claims(text: str) -> list[float]:
    rates: list[float] = []
    for m in _RATE_PATTERN.finditer(text):
        val = m.group(1) or m.group(2)
        if val:
            try:
                rates.append(float(val))
            except ValueError:
                pass
    return rates


def verify_against_context(answer: str, rag_context: str) -> tuple[bool, str | None]:
    """Return (ok, warning_message)."""
    if not rag_context or not answer:
        return True, None

    answer_rates = extract_rate_claims(answer)
    if not answer_rates:
        return True, None

    context_rates = extract_rate_claims(rag_context)
    if not context_rates:
        return True, None

    for rate in answer_rates:
        if not any(abs(rate - c) < 0.6 for c in context_rates):
            return (
                False,
                f"⚠️ Jawaf ma {rate:g}% dekhayo, tara reference ma yo rate confirm bhayena. "
                "IRD sanga verify garnuhos.",
            )
    return True, None


def append_verification_note(answer: str, rag_context: str) -> str:
    ok, warning = verify_against_context(answer, rag_context)
    if ok:
        return answer
    return f"{answer}\n\n{warning}"
