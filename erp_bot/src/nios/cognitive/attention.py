"""Attention allocation across memory, evidence, and laws."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AttentionBudget:
    total_tokens: int
    memory_tokens: int
    evidence_tokens: int
    law_tokens: int
    scratch_tokens: int


def allocate_attention(total: int, text: str, capabilities: list[str]) -> AttentionBudget:
    law_heavy = any("legal" in c or "tax" in c for c in capabilities)
    memory_ratio = 0.25
    evidence_ratio = 0.35 if law_heavy else 0.25
    law_ratio = 0.25 if law_heavy else 0.15
    scratch_ratio = 1.0 - memory_ratio - evidence_ratio - law_ratio

    return AttentionBudget(
        total_tokens=total,
        memory_tokens=int(total * memory_ratio),
        evidence_tokens=int(total * evidence_ratio),
        law_tokens=int(total * law_ratio),
        scratch_tokens=int(total * scratch_ratio),
    )
