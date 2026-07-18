"""MAI-07R3N3 candidate finalization — reserved exact identity invariant.

Authoritative R3N3-only finalization. Active R3F / R3N2 paths continue to use
``transliteration_service._finalize_candidates`` unchanged.

Root cause addressed (source analysis only; no R3N2 failure-case inspection):
the legacy finalizer can backfill identity at the end of the cap window and then
evict it when reserving a Devanagari target slot. R3N3 reserves identity first,
then target Devanagari, then fills remaining slots by stable rank.
"""

from __future__ import annotations

import hashlib
from typing import Any, Callable

from .....contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    TransliterationCandidateV1,
    UncertaintyClass,
)
from ..domain.alignment import identity_alignment
from .. import MAX_CANDIDATES_PER_SPAN

FINALIZER_VERSION = "mai-07-r3n3.finalizer.1.0.0"
POLICY_VERSION = "mai-07-r3n3.1.0.0"


def _cid(*parts: str) -> str:
    return "xls_" + hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def _has_devanagari(surface: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in surface)


def construct_exact_identity(raw_surface: str) -> TransliterationCandidateV1:
    """Authoritative identity: surface equals raw code-point slice exactly."""
    script = CandidateScript.LATIN if any(ord(c) < 128 for c in raw_surface) else CandidateScript.OTHER
    return TransliterationCandidateV1(
        candidate_id=_cid("id", raw_surface),
        surface=raw_surface,
        script=script,
        kind=CandidateKind.IDENTITY,
        rank=1,
        ranking_score=1.0,
        uncertainty_class=UncertaintyClass.HIGH_EVIDENCE,
        calibration_status=CalibrationStatus.UNCALIBRATED,
        is_identity=True,
        requires_review=False,
        reason_codes=("R3N3_EXACT_IDENTITY",),
        provenance=("identity", "r3n3_reserved_identity"),
        alignment=identity_alignment(raw_surface),
    )


def is_exact_identity(candidate: TransliterationCandidateV1, raw_surface: str) -> bool:
    return (
        bool(candidate.is_identity)
        and candidate.kind == CandidateKind.IDENTITY
        and candidate.surface == raw_surface
    )


def ensure_exact_identity_present(
    ranked: list[TransliterationCandidateV1],
    *,
    raw_surface: str,
) -> list[TransliterationCandidateV1]:
    """Guarantee exactly one exact-raw identity candidate exists before capping."""
    exact = [c for c in ranked if is_exact_identity(c, raw_surface)]
    others = [c for c in ranked if not is_exact_identity(c, raw_surface)]
    # Drop identity-flagged look-alikes that do not equal raw surface.
    cleaned = [c for c in others if not (c.is_identity and c.surface != raw_surface)]
    if exact:
        # Merge duplicate exact identities: keep first provenance, drop extras.
        primary = exact[0]
        return [primary, *cleaned]
    return [construct_exact_identity(raw_surface), *cleaned]


def _best_devanagari(ranked: list[TransliterationCandidateV1]) -> TransliterationCandidateV1 | None:
    for c in ranked:
        if (not c.is_identity) and (
            c.script == CandidateScript.DEVANAGARI or _has_devanagari(c.surface)
        ):
            return c
    return None


def _is_protected_or_policy_required(c: TransliterationCandidateV1) -> bool:
    codes = set(c.reason_codes or ())
    prov = set(c.provenance or ())
    return bool(
        codes
        & {
            "PROTECTED_SPAN",
            "R3D_PROTECTED",
            "ACRONYM_IDENTITY",
            "IDENTIFIER_PROTECTION",
        }
    ) or bool(prov & {"r3d_protected_hard_gate", "r3n_structural_identifier", "r3n2_structural_identifier"})


def finalize_candidates_r3n3(
    ranked: list[TransliterationCandidateV1],
    *,
    max_candidates: int = MAX_CANDIDATES_PER_SPAN,
    raw_surface: str | None = None,
) -> tuple[list[TransliterationCandidateV1], bool, dict[str, Any]]:
    """Single R3N3 finalization: validate → dedupe → reserve → cap → postcondition.

    Idempotent: applying twice yields the same candidate surfaces/order/flags.
    Does not increase the candidate cap.
    """
    diagnostics: dict[str, Any] = {
        "finalizer_version": FINALIZER_VERSION,
        "policy_version": POLICY_VERSION,
        "eviction_reason_codes": [],
        "postcondition_ok": True,
        "postcondition_errors": [],
    }
    if not ranked and not raw_surface:
        return [], False, diagnostics

    surface = raw_surface if raw_surface is not None else (ranked[0].surface if ranked else "")
    working = ensure_exact_identity_present(list(ranked), raw_surface=surface)

    # Canonical surface dedupe: prefer exact identity, then first occurrence.
    seen: set[str] = set()
    deduped: list[TransliterationCandidateV1] = []
    for c in working:
        key = c.surface
        if key in seen:
            if is_exact_identity(c, surface):
                # Replace prior non-identity duplicate with identity.
                deduped = [x for x in deduped if x.surface != key]
                deduped.insert(0, c)
                continue
            diagnostics["eviction_reason_codes"].append("DEDUP_SURFACE_COLLISION")
            continue
        seen.add(key)
        deduped.append(c)

    identity = next(c for c in deduped if is_exact_identity(c, surface))
    reserved: list[TransliterationCandidateV1] = [identity]
    reserved_ids = {identity.candidate_id}

    # Protected / policy-required (excluding identity already reserved)
    for c in deduped:
        if c.candidate_id in reserved_ids:
            continue
        if _is_protected_or_policy_required(c):
            if len(reserved) >= max_candidates:
                diagnostics["eviction_reason_codes"].append("PROTECTED_OVERFLOW_FAIL_CLOSED")
                diagnostics["postcondition_ok"] = False
                diagnostics["postcondition_errors"].append("protected_cannot_fit")
                break
            reserved.append(c)
            reserved_ids.add(c.candidate_id)

    # Highest-ranked valid Devanagari (may already be reserved)
    dev = _best_devanagari(deduped)
    if dev is not None and dev.candidate_id not in reserved_ids:
        if len(reserved) >= max_candidates:
            # Evict lowest-priority non-identity non-protected from reserved fill later —
            # at this stage reserved only has identity (+ protected). Must fit target.
            diagnostics["eviction_reason_codes"].append("TARGET_OVERFLOW_FAIL_CLOSED")
            diagnostics["postcondition_ok"] = False
            diagnostics["postcondition_errors"].append("target_devanagari_cannot_fit")
        else:
            reserved.append(dev)
            reserved_ids.add(dev.candidate_id)

    # Fill remaining by original ranked order (stable).
    for c in deduped:
        if c.candidate_id in reserved_ids:
            continue
        if len(reserved) >= max_candidates:
            diagnostics["eviction_reason_codes"].append("LOWEST_PRIORITY_NON_RESERVED_EVICTED")
            continue
        reserved.append(c)
        reserved_ids.add(c.candidate_id)

    # Cap hard
    if len(reserved) > max_candidates:
        # Never drop identity; drop from end among non-reserved categories first.
        head = [reserved[0]]  # identity
        rest = reserved[1:]
        reserved = head + rest[: max_candidates - 1]
        diagnostics["eviction_reason_codes"].append("HARD_CAP_TRIM")

    # Stable order: preserve relative ranked order among selected, identity may not be first.
    order_index = {c.candidate_id: i for i, c in enumerate(deduped)}
    reserved.sort(key=lambda c: (order_index.get(c.candidate_id, 10_000), c.candidate_id))

    out: list[TransliterationCandidateV1] = []
    for i, c in enumerate(reserved, start=1):
        out.append(c.model_copy(update={"rank": i}))

    # Postconditions
    idents = [c for c in out if is_exact_identity(c, surface)]
    if len(idents) != 1:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append(f"identity_count:{len(idents)}")
    if idents and idents[0].surface != surface:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("identity_surface_mismatch")
    if len(out) > max_candidates:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("cap_exceeded")
    surfaces = [c.surface for c in out]
    if len(surfaces) != len(set(surfaces)):
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("duplicate_surfaces")

    if not diagnostics["postcondition_ok"]:
        # Fail closed: identity-only safe output (constitutionally allowed).
        safe = construct_exact_identity(surface).model_copy(update={"rank": 1})
        return [safe], True, diagnostics

    truncated = len(deduped) > len(out)
    return out, truncated, diagnostics


def finalize_candidates_r3n3_compat(
    ranked: list[TransliterationCandidateV1],
    *,
    max_candidates: int,
) -> tuple[list[TransliterationCandidateV1], bool]:
    """Signature-compatible wrapper for transliterate_frame hook (no raw_surface).

    Infers raw surface from the exact-identity candidate or first identity surface.
    """
    raw = None
    for c in ranked:
        if c.is_identity and c.kind == CandidateKind.IDENTITY:
            raw = c.surface
            break
    if raw is None and ranked:
        raw = ranked[0].surface
    out, truncated, _ = finalize_candidates_r3n3(
        ranked, max_candidates=max_candidates, raw_surface=raw
    )
    return out, truncated


def apply_finalizer_twice_idempotent(
    ranked: list[TransliterationCandidateV1],
    *,
    raw_surface: str,
    max_candidates: int = MAX_CANDIDATES_PER_SPAN,
) -> bool:
    a, _, _ = finalize_candidates_r3n3(ranked, max_candidates=max_candidates, raw_surface=raw_surface)
    b, _, _ = finalize_candidates_r3n3(a, max_candidates=max_candidates, raw_surface=raw_surface)
    return [(c.surface, c.is_identity, c.rank) for c in a] == [
        (c.surface, c.is_identity, c.rank) for c in b
    ]


FinalizeFn = Callable[..., tuple[list[TransliterationCandidateV1], bool]]

__all__ = [
    "FINALIZER_VERSION",
    "POLICY_VERSION",
    "construct_exact_identity",
    "is_exact_identity",
    "ensure_exact_identity_present",
    "finalize_candidates_r3n3",
    "finalize_candidates_r3n3_compat",
    "apply_finalizer_twice_idempotent",
]
