"""MAI-07R3C typed candidate-role projection (independent of ranking)."""

from __future__ import annotations

import re
from typing import Literal

from .eval_candidate_types import contains_devanagari

CandidateRole = Literal[
    "IDENTITY",
    "DEVANAGARI_TARGET",
    "OTHER_LATIN_REWRITE",
    "OTHER_SCRIPT",
    "INVALID_OR_UNSUPPORTED",
]

_LATIN = re.compile(r"[A-Za-z]")


def classify_candidate_role(surface: str, source_surface: str) -> CandidateRole:
    """Typed role from surface vs source — never uses ranker config."""
    if not surface:
        return "INVALID_OR_UNSUPPORTED"
    if surface == source_surface:
        return "IDENTITY"
    if contains_devanagari(surface):
        return "DEVANAGARI_TARGET"
    if _LATIN.search(surface):
        return "OTHER_LATIN_REWRITE"
    # Non-empty, non-Latin, non-Devanagari (e.g. other scripts / symbols)
    if any(ord(ch) > 127 for ch in surface):
        return "OTHER_SCRIPT"
    return "INVALID_OR_UNSUPPORTED"


def is_target_hit(
    *,
    surface: str,
    is_identity: bool,
    kind: str,
    source_surface: str,
    acceptable_targets: set[str] | frozenset[str],
) -> bool:
    """Non-vacuous Devanagari target hit against a policy-compatible acceptable set."""
    if is_identity or kind in {"IDENTITY", "ABSTENTION"}:
        return False
    if surface == source_surface:
        return False
    if not contains_devanagari(surface):
        return False
    if classify_candidate_role(surface, source_surface) != "DEVANAGARI_TARGET":
        return False
    return surface in acceptable_targets
