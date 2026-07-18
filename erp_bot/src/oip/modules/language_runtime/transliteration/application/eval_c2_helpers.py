"""MAI-07C2 helpers: produced views, target scoring hooks, negative controls."""

from __future__ import annotations

from typing import Any

from .eval_candidate_types import contains_devanagari, project_acceptable_target_surfaces
from .eval_scoring import ProducedCandidateView


def produced_views_from_span(sp) -> tuple[list[ProducedCandidateView], str | None]:
    if not sp or not sp.candidates:
        return [], "empty_candidate_list"
    views = [
        ProducedCandidateView(
            surface=c.surface,
            is_identity=bool(c.is_identity),
            kind=c.kind.value if hasattr(c.kind, "value") else str(c.kind),
            script=c.script.value if hasattr(c.script, "value") else str(c.script),
            candidate_id=c.candidate_id,
            rank=int(c.rank),
        )
        for c in sp.candidates
    ]
    err = None
    surfaces = [v.surface for v in views]
    if len(surfaces) != len(set(surfaces)):
        err = "duplicate_candidates_in_ranked_list"
    return views, err


def extract_primary_produced(bundle) -> tuple[list[ProducedCandidateView], str, str | None]:
    """Return (views, source_surface, structural_error)."""
    for sp in bundle.span_results:
        text = sp.raw_span.original_text
        if not text.strip():
            continue
        if not sp.candidates:
            continue
        views, err = produced_views_from_span(sp)
        return views, text, err
    return [], "", "empty_candidate_list"


def extract_challenge_produced(
    bundle,
    *,
    preferred: str | None,
    acceptable: list[str],
) -> tuple[list[ProducedCandidateView], str, str | None]:
    targets: list[str] = []
    if preferred and " " not in preferred.strip():
        targets.append(preferred)
    for a in acceptable:
        if a and " " not in a.strip() and a not in targets:
            targets.append(a)
    for target in targets:
        for sp in bundle.span_results:
            if sp.raw_span.original_text == target and sp.candidates:
                views, err = produced_views_from_span(sp)
                return views, target, err
    return extract_primary_produced(bundle)


def identity_only_produced(source_surface: str) -> list[ProducedCandidateView]:
    return [
        ProducedCandidateView(
            surface=source_surface,
            is_identity=True,
            kind="IDENTITY",
            script="LATIN",
            candidate_id="neg_identity",
            rank=1,
        )
    ]


def empty_produced() -> list[ProducedCandidateView]:
    return []


def wrong_devanagari_produced(source_surface: str) -> list[ProducedCandidateView]:
    # Deterministic wrong Devanagari unrelated to typical gold.
    return [
        ProducedCandidateView(
            surface="कखग",
            is_identity=False,
            kind="GRAPHEME",
            script="DEVANAGARI",
            candidate_id="neg_wrong",
            rank=1,
        ),
        ProducedCandidateView(
            surface=source_surface,
            is_identity=True,
            kind="IDENTITY",
            script="LATIN",
            candidate_id="neg_identity",
            rank=2,
        ),
    ]


def identity_then_target_produced(
    source_surface: str, target_surface: str
) -> list[ProducedCandidateView]:
    return [
        ProducedCandidateView(
            surface=source_surface,
            is_identity=True,
            kind="IDENTITY",
            script="LATIN",
            candidate_id="id",
            rank=1,
        ),
        ProducedCandidateView(
            surface=target_surface,
            is_identity=False,
            kind="LEXICAL",
            script="DEVANAGARI",
            candidate_id="tgt",
            rank=2,
        ),
    ]


def target_then_identity_produced(
    source_surface: str, target_surface: str
) -> list[ProducedCandidateView]:
    return [
        ProducedCandidateView(
            surface=target_surface,
            is_identity=False,
            kind="LEXICAL",
            script="DEVANAGARI",
            candidate_id="tgt",
            rank=1,
        ),
        ProducedCandidateView(
            surface=source_surface,
            is_identity=True,
            kind="IDENTITY",
            script="LATIN",
            candidate_id="id",
            rank=2,
        ),
    ]


def case_targets(case: dict[str, Any]) -> list[str]:
    return project_acceptable_target_surfaces(
        input_text=case.get("input_text", ""),
        acceptable_candidates=list(case.get("acceptable_candidates") or []),
        preferred_candidate=case.get("preferred_candidate"),
    )


def challenge_target_surfaces(case: dict[str, Any]) -> list[str]:
    """Non-identity Devanagari targets for context scoring."""
    raw = case.get("input_text", "")
    acc = list(case.get("acceptable_candidates") or [])
    pref = case.get("preferred_candidate")
    targets = [a for a in acc if a != raw and contains_devanagari(a)]
    if pref and contains_devanagari(pref) and pref not in targets:
        targets.append(pref)
    return targets


__all__ = [
    "produced_views_from_span",
    "extract_primary_produced",
    "extract_challenge_produced",
    "identity_only_produced",
    "empty_produced",
    "wrong_devanagari_produced",
    "identity_then_target_produced",
    "target_then_identity_produced",
    "case_targets",
    "challenge_target_surfaces",
]
