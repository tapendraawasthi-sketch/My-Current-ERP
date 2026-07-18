"""Alignment helpers — exact Unicode code-point ranges only (no float interpolation)."""

from __future__ import annotations

from .....contracts.transliteration import AlignmentKind, AlignmentMapV1, AlignmentSegmentV1


def identity_alignment(raw: str, candidate: str | None = None) -> AlignmentMapV1:
    cand = raw if candidate is None else candidate
    if raw == cand:
        kind = AlignmentKind.IDENTITY
    elif len(raw) == 1 and len(cand) > 1:
        kind = AlignmentKind.ONE_TO_MANY
    elif len(raw) > 1 and len(cand) == 1:
        kind = AlignmentKind.MANY_TO_ONE
    elif len(raw) != len(cand):
        kind = AlignmentKind.MANY_TO_MANY
    else:
        kind = AlignmentKind.ONE_TO_ONE
    return AlignmentMapV1(
        segments=(
            AlignmentSegmentV1(
                raw_start=0,
                raw_end=len(raw),
                candidate_start=0,
                candidate_end=len(cand),
                alignment_kind=kind,
            ),
        ),
        raw_length=len(raw),
        candidate_length=len(cand),
    )


def float_interpolation_usage_count(source: str) -> int:
    """Static anti-shortcut: count forbidden float-boundary patterns in alignment code."""
    body = source.split("def float_interpolation_usage_count", 1)[0]
    markers = ("int(round(", "* ratio", "lerp(", "numpy.interp")
    return sum(body.count(m) for m in markers)
