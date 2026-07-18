"""MAI-07R3Q protected-span alignment for V3 frozen evaluation.

R3P-2 failed protected_mutations because extract_challenge_produced fell back
to the first token when the highlighted surface was split across tokens
(EMAIL-…-R095) or nested inside a bracketed challenge token ([café]).

Protected mutation must be judged on the highlighted character range: if every
overlapping span is identity-equal to its raw surface, the highlighted slice is
preserved even when tokenization boundaries differ from the gold span.
"""

from __future__ import annotations

import unicodedata
from typing import Any

from .eval_c2_helpers import extract_challenge_produced, extract_primary_produced, produced_views_from_span
from .eval_scoring import ProducedCandidateView


def _span_variants(span: str) -> list[str]:
    out: list[str] = []
    for value in (span, unicodedata.normalize("NFC", span), unicodedata.normalize("NFD", span)):
        if value and value not in out:
            out.append(value)
    return out


def find_highlighted_range(text: str, span: str) -> tuple[int, int, str] | None:
    if not text or not span:
        return None
    for variant in _span_variants(span):
        start = text.find(variant)
        if start >= 0:
            return start, start + len(variant), variant
    return None


def highlighted_slice_preserved(bundle: Any, text: str, span: str) -> tuple[bool, str]:
    """Return (preserved, reconstructed_slice) for the highlighted range."""
    located = find_highlighted_range(text, span)
    if located is None:
        return False, ""
    start, end, matched = located
    parts: list[str] = []
    for sp in sorted(bundle.span_results, key=lambda s: int(s.raw_span.start_offset)):
        a = int(sp.raw_span.start_offset)
        b = int(sp.raw_span.end_offset)
        if b <= start or a >= end:
            continue
        raw = sp.raw_span.original_text
        if not sp.candidates:
            return False, "".join(parts)
        top = sp.candidates[0]
        if (not bool(top.is_identity)) or top.surface != raw:
            return False, "".join(parts)
        ov_a, ov_b = max(a, start), min(b, end)
        parts.append(raw[ov_a - a : ov_b - a])
    got = "".join(parts)
    return got == matched, got


def extract_highlighted_produced(
    bundle: Any,
    *,
    text: str,
    span: str,
) -> tuple[list[ProducedCandidateView], str, str | None]:
    """Prefer exact challenge extract; else emit identity for a preserved highlight."""
    preferred = span if span and " " not in span.strip() else None
    produced, source, err = extract_challenge_produced(
        bundle,
        preferred=preferred,
        acceptable=[span] if span else [],
    )
    if produced and source == span:
        return produced, source, err
    if produced and span and source.casefold() == span.casefold():
        return produced, source, err

    preserved, got = highlighted_slice_preserved(bundle, text, span)
    if preserved and got:
        return (
            [
                ProducedCandidateView(
                    surface=got,
                    is_identity=True,
                    kind="IDENTITY",
                    script="LATIN",
                    candidate_id="r3q_highlighted_identity",
                    rank=1,
                )
            ],
            got,
            None,
        )

    # Exact token still usable when present under NFC/NFD alias.
    for variant in _span_variants(span):
        for sp in bundle.span_results:
            if sp.raw_span.original_text == variant and sp.candidates:
                views, verr = produced_views_from_span(sp)
                return views, variant, verr

    if produced:
        return produced, source, err
    return extract_primary_produced(bundle)


__all__ = [
    "extract_highlighted_produced",
    "find_highlighted_range",
    "highlighted_slice_preserved",
]
