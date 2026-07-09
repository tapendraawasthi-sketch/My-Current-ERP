"""Verifier — deterministic grounding gates + optional LLM critic.

Deterministic checks (citations, ledger balance) run first and can hard-fail
regardless of what the LLM critic thinks. The LLM critic then scores residual
grounding for prose claims.
"""

from __future__ import annotations

import re
from typing import Any

from ..llm.ollama_client import OllamaClient
from ..prompts import VERIFIER_PROMPT
from ..schemas import EvidenceRef, ToolCallRecord, VerificationResult

# Paths / shortcuts / component names that must appear in evidence if claimed.
_PATH_RE = re.compile(r"\b(?:src/[\w./-]+\.\w+|[\w-]+\.tsx?|[\w-]+\.py)\b")
_SHORTCUT_RE = re.compile(r"\b(?:F\d{1,2}|Ctrl\+\w+|Alt\+\w+|Shift\+\w+)\b")


def verify_citations_exist(answer: str, evidence: list[EvidenceRef]) -> list[str]:
    """Return file-path/shortcut claims in the answer not backed by evidence."""
    evidence_blob = " ".join(
        f"{e.uri} {e.snippet or ''} {e.title or ''}" for e in evidence
    )
    errors: list[str] = []

    for path in set(_PATH_RE.findall(answer)):
        # Ignore generic mentions like "package.json" only if truly absent.
        if path not in evidence_blob:
            errors.append(f"file path not in evidence: {path}")

    for sc in set(_SHORTCUT_RE.findall(answer)):
        if sc not in evidence_blob:
            errors.append(f"shortcut not in evidence: {sc}")

    return errors


def verify_ledger_math(lines: list[dict]) -> list[str]:
    if not lines:
        return []
    errors: list[str] = []
    debit = round(sum(float(l.get("debit", 0) or 0) for l in lines), 2)
    credit = round(sum(float(l.get("credit", 0) or 0) for l in lines), 2)
    if abs(debit - credit) >= 0.01:
        errors.append(f"ledger unbalanced: DR {debit} != CR {credit}")
    for l in lines:
        if float(l.get("debit", 0) or 0) < 0 or float(l.get("credit", 0) or 0) < 0:
            errors.append(f"negative amount on {l.get('account')}")
    return errors


async def verify_answer(
    verifier_llm: OllamaClient,
    answer: str,
    evidence: list[EvidenceRef],
    tool_trace: list[ToolCallRecord],
    intent: str,
    ledger_lines: list[dict] | None = None,
    use_llm_critic: bool = True,
) -> VerificationResult:
    citation_errors = verify_citations_exist(answer, evidence)
    math_errors = verify_ledger_math(ledger_lines or [])

    # Hard deterministic failure short-circuits — no need to burn an LLM call.
    if citation_errors or math_errors:
        return VerificationResult(
            passed=False,
            score=0.2,
            citation_errors=citation_errors,
            math_errors=math_errors,
            required_fix="Remove or correct claims/amounts not supported by evidence.",
        )

    if not use_llm_critic or not evidence:
        # No evidence + no forbidden claims: allow, but low-to-mid confidence.
        score = 0.7 if evidence else 0.5
        return VerificationResult(passed=True, score=score)

    evidence_text = "\n".join(
        f"[{e.id}] ({e.source_type}) {e.uri}: {(e.snippet or '')[:300]}" for e in evidence
    )
    messages = [
        {"role": "system", "content": VERIFIER_PROMPT},
        {
            "role": "user",
            "content": (
                f"Intent: {intent}\n\nEvidence:\n{evidence_text}\n\n"
                f"Candidate answer:\n{answer}"
            ),
        },
    ]
    try:
        parsed = await verifier_llm.chat_json(messages, temperature=0.0)
    except Exception:
        parsed = None

    if not isinstance(parsed, dict):
        # Critic unavailable — trust deterministic gates that already passed.
        return VerificationResult(passed=True, score=0.65, warnings=["verifier LLM unavailable"])

    return VerificationResult(
        passed=bool(parsed.get("passed", True)),
        score=float(parsed.get("score", 0.6) or 0.6),
        unsupported_claims=list(parsed.get("unsupported_claims", []) or []),
        math_errors=list(parsed.get("math_errors", []) or []),
        citation_errors=list(parsed.get("citation_errors", []) or []),
        required_fix=parsed.get("required_fix"),
    )
