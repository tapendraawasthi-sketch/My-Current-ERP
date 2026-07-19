"""MAI-08 candidate-only typo / abbreviation / code-mix feature service.

Never mutates raw_text. Never applies candidates. Respects protected spans.
"""

from __future__ import annotations

import re
from typing import Iterable

from .....contracts.common import SourceSpanV1
from .....contracts.language import LanguageFrameV1
from .....contracts.typo_code_mix import (
    TypoCodeMixBundleV1,
    TypoCodeMixCandidateKind,
    TypoCodeMixCandidateV1,
    TypoCodeMixStatus,
)
from .. import OFFSET_UNIT, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure.resource_repository import TypoCodeMixResources, load_resources

_TOKEN_RE = re.compile(r"[A-Za-z\u0900-\u097F0-9]+|[^\sA-Za-z\u0900-\u097F0-9]+|\s+", re.UNICODE)


def _protected_ranges(spans: Iterable[SourceSpanV1]) -> list[tuple[int, int]]:
    ranges = sorted((s.start_offset, s.end_offset) for s in spans)
    if not ranges:
        return []
    merged: list[tuple[int, int]] = [ranges[0]]
    for a, b in ranges[1:]:
        la, lb = merged[-1]
        if a <= lb:
            merged[-1] = (la, max(lb, b))
        else:
            merged.append((a, b))
    return merged


def _overlaps(start: int, end: int, protected: list[tuple[int, int]]) -> bool:
    for a, b in protected:
        if start < b and end > a:
            return True
    return False


def build_typo_code_mix_bundle(
    raw_text: str,
    *,
    language_frame: LanguageFrameV1 | None = None,
    resources: TypoCodeMixResources | None = None,
) -> TypoCodeMixBundleV1:
    res = resources or load_resources()
    protected = _protected_ranges(language_frame.protected_spans if language_frame else ())
    candidates: list[TypoCodeMixCandidateV1] = []
    cid = 0

    for match in _TOKEN_RE.finditer(raw_text):
        surface = match.group(0)
        if not surface or surface.isspace():
            continue
        start, end = match.start(), match.end()
        if _overlaps(start, end, protected):
            continue
        key = surface.lower()
        if key in res.abbreviations and res.abbreviations[key] != key:
            cid += 1
            candidates.append(
                TypoCodeMixCandidateV1(
                    candidate_id=f"abbr-{cid:04d}",
                    kind=TypoCodeMixCandidateKind.ABBREVIATION_EXPAND,
                    original_surface=surface,
                    candidate_surface=res.abbreviations[key],
                    raw_start=start,
                    raw_end=end,
                    reason_codes=("SHOP_ABBREVIATION_CANDIDATE",),
                    applied=False,
                )
            )
        if key in res.typo_probes and res.typo_probes[key] != key:
            cid += 1
            candidates.append(
                TypoCodeMixCandidateV1(
                    candidate_id=f"typo-{cid:04d}",
                    kind=TypoCodeMixCandidateKind.TYPO_VARIANT,
                    original_surface=surface,
                    candidate_surface=res.typo_probes[key],
                    raw_start=start,
                    raw_end=end,
                    reason_codes=("SHOP_TYPO_PROBE_CANDIDATE",),
                    applied=False,
                )
            )

    pattern = language_frame.code_mix_pattern if language_frame else None
    features: dict = {
        "code_mix_pattern": pattern,
        "language_distribution": dict(language_frame.language_distribution or {})
        if language_frame
        else {},
        "has_three_way_mix": pattern == "THREE_WAY_MIX",
        "has_ambiguous_mix": bool(pattern and str(pattern).startswith("AMBIGUOUS")),
    }
    if pattern:
        cid += 1
        candidates.append(
            TypoCodeMixCandidateV1(
                candidate_id=f"mix-{cid:04d}",
                kind=TypoCodeMixCandidateKind.CODE_MIX_FEATURE,
                original_surface=raw_text[:64],
                candidate_surface=str(pattern),
                raw_start=0,
                raw_end=min(len(raw_text), 64),
                reason_codes=("CODE_MIX_PATTERN_FEATURE",),
                applied=False,
            )
        )

    return TypoCodeMixBundleV1(
        analysis_status=TypoCodeMixStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        resource_version=res.resource_version or RESOURCE_PACK_VERSION,
        offset_unit=OFFSET_UNIT,
        source_authority="RAW",
        candidates=tuple(candidates),
        code_mix_features=features,
        warnings=(),
        error_codes=(),
        silent_applications=0,
        candidate_count=len(candidates),
    )


def attach_typo_code_mix_to_frame(
    frame: LanguageFrameV1,
    *,
    resources: TypoCodeMixResources | None = None,
) -> LanguageFrameV1:
    """Attach TypoCodeMixBundleV1; never mutates raw_text."""
    raw_before = frame.raw_text
    bundle = build_typo_code_mix_bundle(
        frame.raw_text,
        language_frame=frame,
        resources=resources,
    )
    if frame.raw_text != raw_before:
        raise RuntimeError("RAW_TEXT_MUTATION")
    if any(c.applied for c in bundle.candidates):
        raise RuntimeError("SILENT_CANDIDATE_APPLY")
    if bundle.silent_applications != 0:
        raise RuntimeError("SILENT_APPLICATIONS_NONZERO")

    versions = dict(frame.analyzer_versions or {})
    versions["typo_code_mix"] = RUNTIME_VERSION
    versions["typo_code_mix_resources"] = bundle.resource_version
    return frame.model_copy(
        update={
            "typo_code_mix_bundle": bundle,
            "analyzer_versions": versions,
        }
    )
