"""Deterministic projection of transliteration-target candidates from frozen surfaces."""

from __future__ import annotations

from typing import Any, Iterable, Sequence

from .....contracts.transliteration import CandidateKind, CandidateScript

_DEVANAGARI_START = 0x0900
_DEVANAGARI_END = 0x097F


def contains_devanagari(text: str) -> bool:
    """True if any code point is in the Devanagari block (allows mixed digits/punct)."""
    return any(_DEVANAGARI_START <= ord(ch) <= _DEVANAGARI_END for ch in text)


def project_acceptable_target_surfaces(
    *,
    input_text: str,
    acceptable_candidates: Sequence[str],
    preferred_candidate: str | None = None,
) -> list[str]:
    """
    Deterministic gold projection when frozen cases lack typed candidate kinds.

    A surface is an acceptable *transliteration target* iff:
    - it is listed in frozen acceptable_candidates (or equals preferred when Dev),
    - it is not exact identity with the full input_text,
    - it contains Devanagari (transliterated content; mixed spans allowed).

    Latin rewrites and identity surfaces are excluded.
    """
    seen: set[str] = set()
    out: list[str] = []
    for surface in list(acceptable_candidates) + (
        [preferred_candidate] if preferred_candidate else []
    ):
        if not surface or surface in seen:
            continue
        if surface == input_text:
            continue
        if not contains_devanagari(surface):
            continue
        seen.add(surface)
        out.append(surface)
    return out


def produced_is_target_hit(
    *,
    surface: str,
    is_identity: bool,
    kind: str | CandidateKind | None,
    script: str | CandidateScript | None,
    source_surface: str,
    acceptable_targets: Iterable[str],
) -> bool:
    """
    Produced candidate is a transliteration-quality hit.

    Requires: not identity, not identity-kind, not equal to source surface,
    contains Devanagari, and membership in acceptable target set.
    Script alone or Latin non-identity rewrite is insufficient.
    """
    targets = frozenset(acceptable_targets)
    if is_identity:
        return False
    kind_val = kind.value if isinstance(kind, CandidateKind) else (kind or "")
    if kind_val == CandidateKind.IDENTITY.value or kind_val == "IDENTITY":
        return False
    if kind_val == CandidateKind.ABSTENTION.value or kind_val == "ABSTENTION":
        return False
    if surface == source_surface:
        return False
    if not contains_devanagari(surface):
        return False
    if surface not in targets:
        return False
    # Prefer typed script when present; MIXED/DEVANAGARI both ok if Devanagari content exists.
    if script is not None:
        script_val = script.value if isinstance(script, CandidateScript) else str(script)
        if script_val == CandidateScript.LATIN.value:
            return False
    return True


def case_decision_category(case: dict[str, Any]) -> str:
    """Coarse source-decision category from frozen fields (not tuned post-hoc)."""
    if case.get("abstention_expected"):
        return "ABSTENTION"
    if case.get("context_challenge") or case.get("suite_id") == "context_challenge_v1":
        return "CONTEXT_CHALLENGE"
    suite = case.get("suite_id", "")
    if suite in {"english_identity_v1", "devanagari_identity_v1", "protected_spans_v1"}:
        return "IDENTITY_REQUIRED"
    if suite == "names_entities_v1":
        return "NAME_ENTITY_REVIEW"
    if suite == "ambiguous_latin_v1":
        return "AMBIGUOUS_LATIN"
    targets = project_acceptable_target_surfaces(
        input_text=case.get("input_text", ""),
        acceptable_candidates=list(case.get("acceptable_candidates") or []),
        preferred_candidate=case.get("preferred_candidate"),
    )
    if targets:
        return "TRANSLITERATION_GENERATION"
    return "IDENTITY_OR_OPTIONAL"


__all__ = [
    "contains_devanagari",
    "project_acceptable_target_surfaces",
    "produced_is_target_hit",
    "case_decision_category",
]
