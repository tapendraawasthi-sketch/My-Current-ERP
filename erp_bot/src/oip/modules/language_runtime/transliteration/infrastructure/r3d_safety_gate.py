"""MAI-07R3D protected-span hard safety gate.

Reuses MAI-05 protected ranges / protected_reason flags — does not invent a second detector.
Makes protected mutations structurally impossible before candidate generation and before bundle serialize.
"""

from __future__ import annotations

import hashlib
from typing import Iterable

from .....contracts.common import SourceSpanV1
from .....contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    EligibilityDecision,
    TransliterationCandidateV1,
    TransliterationSpanV1,
    UncertaintyClass,
)
from ..domain.alignment import identity_alignment
from .. import OFFSET_UNIT

try:
    from .english_identity_guard import POLICY_VERSION as _R3H2_POLICY_VERSION
except Exception:  # pragma: no cover - import cycle fallback
    _R3H2_POLICY_VERSION = "mai-07-r3h2.1.0.0"


def _cid(*parts: str) -> str:
    return "xls_" + hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def ranges_overlap(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and b0 < a1


def span_is_protected(
    *,
    start: int,
    end: int,
    protected_reason: str | None,
    protected_ranges: Iterable[tuple[int, int]],
) -> bool:
    if protected_reason:
        return True
    return any(ranges_overlap(start, end, a, b) for a, b in protected_ranges)


def identity_only_candidate(surface: str, reasons: tuple[str, ...]) -> TransliterationCandidateV1:
    return TransliterationCandidateV1(
        candidate_id=_cid("id", surface, "prot"),
        surface=surface,
        script=CandidateScript.LATIN if any(ord(c) < 128 for c in surface) else CandidateScript.OTHER,
        kind=CandidateKind.IDENTITY,
        rank=1,
        ranking_score=1.0,
        uncertainty_class=UncertaintyClass.HIGH_EVIDENCE,
        calibration_status=CalibrationStatus.UNCALIBRATED,
        alignment=identity_alignment(surface),
        is_identity=True,
        requires_review=False,
        reason_codes=reasons,
        provenance=("identity", "r3d_protected_hard_gate"),
    )


def force_protected_span_result(
    *,
    span_id: str,
    raw_span: SourceSpanV1,
    form: str,
    surface: str,
    name_like: bool,
    decision: EligibilityDecision = EligibilityDecision.SKIPPED_PROTECTED,
    reasons: tuple[str, ...] = ("PROTECTED_SPAN", "R3D_HARD_GATE"),
) -> TransliterationSpanV1:
    ident = identity_only_candidate(surface, reasons)
    # Fail closed: NEVER GENERATE on protected content
    if decision not in {
        EligibilityDecision.SKIPPED_PROTECTED,
        EligibilityDecision.IDENTITY_ONLY,
        EligibilityDecision.SKIPPED_SECURITY,
    }:
        decision = EligibilityDecision.SKIPPED_PROTECTED
    return TransliterationSpanV1(
        span_id=span_id,
        raw_span=raw_span,
        source_language_form=form,
        eligibility=decision,
        decision_reason_codes=reasons,
        candidates=(ident,),
        identity_candidate_id=ident.candidate_id,
        is_protected=True,
        is_ambiguous=False,
        is_name_like=name_like,
        review_required=False,
        review_reason_codes=(),
        disposition="PROTECTED_IDENTITY_REQUIRED",
        policy_version=_R3H2_POLICY_VERSION,
    )


def sanitize_span_if_protected(span: TransliterationSpanV1) -> TransliterationSpanV1:
    """Pre-serialize gate: protected spans must be code-point identity-only."""
    if not span.is_protected and span.eligibility is not EligibilityDecision.SKIPPED_PROTECTED:
        return span
    surface = span.raw_span.original_text
    if (
        len(span.candidates) == 1
        and span.candidates[0].is_identity
        and span.candidates[0].surface == surface
    ):
        return span.model_copy(update={"is_protected": True})
    return force_protected_span_result(
        span_id=span.span_id,
        raw_span=span.raw_span,
        form=span.source_language_form,
        surface=surface,
        name_like=span.is_name_like,
        decision=EligibilityDecision.SKIPPED_PROTECTED,
        reasons=tuple(dict.fromkeys(tuple(span.decision_reason_codes) + ("R3D_HARD_GATE_SERIALIZE",))),
    )


def count_protected_mutations(spans: Iterable[TransliterationSpanV1]) -> int:
    n = 0
    for sp in spans:
        if not sp.is_protected and sp.eligibility is not EligibilityDecision.SKIPPED_PROTECTED:
            continue
        surface = sp.raw_span.original_text
        for c in sp.candidates:
            if c.surface != surface:
                n += 1
                break
            if not c.is_identity and len(sp.candidates) > 1:
                n += 1
                break
    return n


def make_raw_span(surface: str, start: int, end: int) -> SourceSpanV1:
    return SourceSpanV1(
        start_offset=start,
        end_offset=end,
        original_text=surface,
        offset_unit=OFFSET_UNIT,
    )
