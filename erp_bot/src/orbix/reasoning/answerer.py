"""Answer composer — writes the final grounded answer from observations only."""

from __future__ import annotations

from ..llm.ollama_client import OllamaClient
from ..prompts import ANSWER_PROMPT
from ..schemas import EvidenceRef, OrbixChatRequest


def _format_observations(observations: list[dict]) -> str:
    parts = []
    for i, obs in enumerate(observations, 1):
        summary = obs.get("summary", "")
        data = obs.get("data", {})
        parts.append(f"Observation {i} ({obs.get('tool','?')}): {summary}")
        if data:
            snippet = str(data)[:500]
            parts.append(f"  data: {snippet}")
    return "\n".join(parts) or "(no tool observations)"


def _format_evidence(evidence: list[EvidenceRef]) -> str:
    return "\n".join(
        f"[{e.id}] ({e.source_type}) {e.uri}"
        + (f":{e.line_start}-{e.line_end}" if e.line_start else "")
        + (f" — {(e.snippet or '')[:200]}" if e.snippet else "")
        for e in evidence
    ) or "(no evidence)"


async def compose_answer(
    llm: OllamaClient,
    request: OrbixChatRequest,
    intent: str,
    observations: list[dict],
    evidence: list[EvidenceRef],
) -> str:
    messages = [
        {"role": "system", "content": ANSWER_PROMPT},
        {
            "role": "user",
            "content": (
                f"User asked: {request.message}\n"
                f"Intent: {intent}\n\n"
                f"Observations:\n{_format_observations(observations)}\n\n"
                f"Evidence:\n{_format_evidence(evidence)}\n\n"
                "Write the final answer now."
            ),
        },
    ]
    try:
        msg = await llm.chat(messages, temperature=0.2)
        return (msg.get("content") or "").strip()
    except Exception as exc:
        return f"(answer composition failed: {exc})"


async def compose_limited_answer(
    llm: OllamaClient,
    request: OrbixChatRequest,
    intent: str,
    observations: list[dict],
    evidence: list[EvidenceRef],
) -> str:
    """Best-effort answer when the loop hit max steps without full verification."""
    base = await compose_answer(llm, request, intent, observations, evidence)
    if not evidence:
        return (
            base
            + "\n\n(Note: I could not fully verify this against source evidence — "
            "treat it as tentative.)"
        )
    return base
