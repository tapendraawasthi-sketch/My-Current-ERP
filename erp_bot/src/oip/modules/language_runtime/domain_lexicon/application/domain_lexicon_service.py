"""MAI-10 candidate-only domain concept matcher.

Never mutates raw_text. Never applies candidates. Skips protected spans.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from .....contracts.common import SourceSpanV1
from .....contracts.domain_lexicon import (
    DomainConceptCandidateV1,
    DomainLexiconBundleV1,
    DomainLexiconStatus,
)
from .....contracts.language import LanguageFrameV1
from .. import OFFSET_UNIT, ONTOLOGY_VERSION, RUNTIME_VERSION

_SEED_PATH = (
    Path(__file__).resolve().parent.parent / "resources" / "seed_concepts_v1.json"
)

# Letter / digit class for boundary checks (Latin + Devanagari).
_WORD_CHAR = re.compile(r"[A-Za-z0-9\u0900-\u097F]", re.UNICODE)


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


def _is_boundary(text: str, start: int, end: int) -> bool:
    if start > 0 and _WORD_CHAR.match(text[start - 1]):
        return False
    if end < len(text) and _WORD_CHAR.match(text[end]):
        return False
    return True


@lru_cache(maxsize=1)
def _load_surface_index() -> tuple[tuple[str, str, str], ...]:
    """Return (surface_lower, concept_id, language_form) longest-first."""
    data = json.loads(_SEED_PATH.read_text(encoding="utf-8"))
    rows: list[tuple[str, str, str]] = []
    for concept in data.get("concepts", []):
        cid = str(concept["concept_id"])
        for surf in concept.get("surfaces", []):
            text = str(surf["text"]).strip()
            if not text:
                continue
            rows.append((text.lower(), cid, str(surf.get("language_form", "UNKNOWN"))))
    rows.sort(key=lambda r: (-len(r[0]), r[0], r[1]))
    return tuple(rows)


def parse_domain_concepts(
    text: str,
    *,
    language_frame: LanguageFrameV1 | None = None,
) -> list[dict]:
    """Return concept dicts for evals / adapters."""
    protected = _protected_ranges(language_frame.protected_spans if language_frame else ())
    # Also honor span_annotations with protected_reason.
    if language_frame is not None:
        extra = [
            SourceSpanV1(
                start_offset=ann.start_offset,
                end_offset=ann.end_offset,
                original_text=ann.original_text or "",
            )
            for ann in (language_frame.span_annotations or ())
            if ann.protected_reason
        ]
        if extra:
            protected = _protected_ranges(
                list(language_frame.protected_spans or ()) + extra
            )

    lower = text.lower()
    claimed: set[tuple[int, int]] = set()
    out: list[dict] = []

    for surface, concept_id, language_form in _load_surface_index():
        start = 0
        while True:
            idx = lower.find(surface, start)
            if idx < 0:
                break
            end = idx + len(surface)
            start = idx + 1
            if not _is_boundary(text, idx, end):
                continue
            if _overlaps(idx, end, protected):
                continue
            if any(idx < b and end > a for a, b in claimed):
                continue
            claimed.add((idx, end))
            out.append(
                {
                    "surface": text[idx:end],
                    "concept_id": concept_id,
                    "language_form": language_form,
                    "raw_start": idx,
                    "raw_end": end,
                }
            )

    out.sort(key=lambda d: (d["raw_start"], d["raw_end"]))
    return out


def build_domain_lexicon_bundle(
    raw_text: str,
    *,
    language_frame: LanguageFrameV1 | None = None,
) -> DomainLexiconBundleV1:
    parsed = parse_domain_concepts(raw_text, language_frame=language_frame)
    candidates: list[DomainConceptCandidateV1] = []
    for i, row in enumerate(parsed):
        candidates.append(
            DomainConceptCandidateV1(
                candidate_id=f"dlx-{i:04d}",
                surface=row["surface"],
                concept_id=row["concept_id"],
                language_form=row["language_form"],
                raw_start=row["raw_start"],
                raw_end=row["raw_end"],
                reason_codes=("SEED_SURFACE_MATCH",),
                applied=False,
            )
        )
    return DomainLexiconBundleV1(
        analysis_status=DomainLexiconStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        ontology_version=ONTOLOGY_VERSION,
        offset_unit=OFFSET_UNIT,
        source_authority="RAW",
        candidates=tuple(candidates),
        candidate_count=len(candidates),
        silent_applications=0,
    )


def attach_domain_lexicon_to_frame(frame: LanguageFrameV1) -> LanguageFrameV1:
    bundle = build_domain_lexicon_bundle(frame.raw_text, language_frame=frame)
    versions = dict(frame.analyzer_versions or {})
    versions["domain_lexicon"] = RUNTIME_VERSION
    versions["domain_ontology"] = ONTOLOGY_VERSION
    return frame.model_copy(
        update={
            "domain_lexicon_bundle": bundle,
            "analyzer_versions": versions,
        }
    )
