"""MAI-26 — temporal / amendment / cross-reference annotation + consume.

Slice 1: cue candidates in raw_text when knowledge-source governance is COMPLETE.
Slice 2: resolve retrieval as_of from as_of_candidate; amendment stays cues-only.
Never proves Nepal-law effective dates, applies amendments, or mutates documents.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.temporal_cross_ref import (
    CrossRefCueKind,
    CrossRefCueV1,
    TemporalCrossRefBundleV1,
    TemporalCrossRefStatus,
    TemporalCueKind,
    TemporalCueV1,
)

RUNTIME_VERSION = "mai-26.0.2-slice2"
AUTHORITY = "ADR_0043"

_ISO_DATE = re.compile(r"\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b")
_DMY = re.compile(
    r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|19\d{2})\b"
)
_AS_OF = re.compile(
    r"\b(?:as\s+of|asof|effective\s+(?:from|date)|देखि\s+लागू)\b",
    re.IGNORECASE,
)
_FY = re.compile(
    r"\b(?:FY|F\.Y\.|fiscal\s+year|आ\.व\.|आर्थिक\s+वर्ष)\s*[-:]?\s*"
    r"(\d{2,4})\s*[-/]\s*(\d{2,4})\b",
    re.IGNORECASE,
)
_AMEND = re.compile(
    r"\b(?:amend(?:ed|ment)?|supersede[sd]?|repeal(?:ed)?|संशोधन|खारेज)\b",
    re.IGNORECASE,
)
_SECTION = re.compile(
    r"\b(?:section|sec\.?|धारा|अनुच्छेद)\s*\d+[A-Za-z]?\b",
    re.IGNORECASE,
)
_ACT_RULE = re.compile(
    r"\b(?:Income\s+Tax\s+Act|VAT\s+Act|Companies\s+Act|NFRS|IAS|IFRS|"
    r"आयकर\s+ऐन|मूल्य\s+अभिवृद्धि\s+कर\s+ऐन)\b",
    re.IGNORECASE,
)
_SEE_REF = re.compile(
    r"\b(?:see|pursuant\s+to|under|refer(?:ence)?\s+to|हेर्नुहोस्)\b",
    re.IGNORECASE,
)
_SUPERSEDE = re.compile(
    r"\b(?:supersedes|superseded\s+by|replaces)\b",
    re.IGNORECASE,
)


def _add_matches(
    *,
    text: str,
    pattern: re.Pattern[str],
    kind_temporal: TemporalCueKind | None,
    kind_xref: CrossRefCueKind | None,
    reason: str,
    temporal_out: list[TemporalCueV1],
    xref_out: list[CrossRefCueV1],
) -> None:
    for m in pattern.finditer(text or ""):
        surface = m.group(0)
        if kind_temporal is not None:
            temporal_out.append(
                TemporalCueV1(
                    cue_id=f"t-{len(temporal_out) + 1:04d}",
                    kind=kind_temporal,
                    surface=surface[:160],
                    start_offset=m.start(),
                    end_offset=m.end(),
                    reason_codes=(reason,),
                )
            )
        if kind_xref is not None:
            xref_out.append(
                CrossRefCueV1(
                    cue_id=f"x-{len(xref_out) + 1:04d}",
                    kind=kind_xref,
                    surface=surface[:160],
                    start_offset=m.start(),
                    end_offset=m.end(),
                    reason_codes=(reason,),
                )
            )


def _as_of_candidate(text: str) -> str | None:
    m = _ISO_DATE.search(text or "")
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = _DMY.search(text or "")
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


def build_temporal_cross_ref_bundle(
    request: CanonicalAIRequestV1,
) -> TemporalCrossRefBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return TemporalCrossRefBundleV1(
            analysis_status=TemporalCrossRefStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_KNOWLEDGE_SOURCE_GOVERNANCE",),
            warnings=("NO_KNOWLEDGE_SOURCE_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return TemporalCrossRefBundleV1(
            analysis_status=TemporalCrossRefStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    text = request.raw_text or ""
    if not text.strip():
        return TemporalCrossRefBundleV1(
            analysis_status=TemporalCrossRefStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("EMPTY_RAW_TEXT",),
            warnings=("EMPTY_RAW_TEXT",),
        )

    temporal: list[TemporalCueV1] = []
    xref: list[CrossRefCueV1] = []

    _add_matches(
        text=text,
        pattern=_ISO_DATE,
        kind_temporal=TemporalCueKind.AS_OF_DATE,
        kind_xref=None,
        reason="ISO_DATE",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_DMY,
        kind_temporal=TemporalCueKind.AS_OF_DATE,
        kind_xref=None,
        reason="DMY_DATE",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_AS_OF,
        kind_temporal=TemporalCueKind.EFFECTIVE_FROM_CUE,
        kind_xref=None,
        reason="AS_OF_LANGUAGE",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_FY,
        kind_temporal=TemporalCueKind.FISCAL_YEAR,
        kind_xref=None,
        reason="FISCAL_YEAR",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_AMEND,
        kind_temporal=TemporalCueKind.AMENDMENT_LANGUAGE,
        kind_xref=None,
        reason="AMENDMENT_LANGUAGE",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_SECTION,
        kind_temporal=None,
        kind_xref=CrossRefCueKind.SECTION_REF,
        reason="SECTION_REF",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_ACT_RULE,
        kind_temporal=None,
        kind_xref=CrossRefCueKind.ACT_RULE_REF,
        reason="ACT_RULE_REF",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_SEE_REF,
        kind_temporal=None,
        kind_xref=CrossRefCueKind.DOCUMENT_REF,
        reason="SEE_OR_PURSUANT",
        temporal_out=temporal,
        xref_out=xref,
    )
    _add_matches(
        text=text,
        pattern=_SUPERSEDE,
        kind_temporal=None,
        kind_xref=CrossRefCueKind.SUPERSEDES_CUE,
        reason="SUPERSEDES_LANGUAGE",
        temporal_out=temporal,
        xref_out=xref,
    )

    return TemporalCrossRefBundleV1(
        analysis_status=TemporalCrossRefStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        temporal_cues=tuple(temporal),
        cross_ref_cues=tuple(xref),
        as_of_candidate=_as_of_candidate(text),
        legal_effective_dates_proven=False,
        amendment_applied=False,
        reason_codes=(
            "GOVERNANCE_COMPLETE",
            "DETERMINISTIC_TEMPORAL_XREF_CUES",
            "LEGAL_DATES_NOT_PROVEN",
        ),
        silent_applications=0,
        draft_mutations=0,
        documents_mutated=0,
    )


def attach_temporal_cross_ref_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_temporal_cross_ref_bundle(request)
    return request.model_copy(update={"temporal_cross_ref_bundle": bundle})


def assert_temporal_cross_ref_authority(
    bundle: TemporalCrossRefBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.legal_effective_dates_proven
        or bundle.amendment_applied
        or bundle.silent_applications != 0
        or bundle.draft_mutations != 0
        or bundle.documents_mutated != 0
    ):
        raise RuntimeError("TEMPORAL_CROSS_REF_AUTHORITY")


def temporal_cross_ref_to_metadata(
    bundle: TemporalCrossRefBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "temporal_cue_count": len(bundle.temporal_cues),
        "cross_ref_cue_count": len(bundle.cross_ref_cues),
        "temporal_kinds": [c.kind.value for c in bundle.temporal_cues],
        "cross_ref_kinds": [c.kind.value for c in bundle.cross_ref_cues],
        "as_of_candidate": bundle.as_of_candidate,
        "legal_effective_dates_proven": False,
        "amendment_applied": False,
        "amendment_filter_mode": "CUES_ONLY",
        "reason_codes": list(bundle.reason_codes),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "documents_mutated": bundle.documents_mutated,
        "is_execution_authority": False,
    }


def should_apply_retrieval_as_of(
    temporal_cross_ref: Mapping[str, Any] | TemporalCrossRefBundleV1 | None,
) -> bool:
    """True when COMPLETE with as_of_candidate and no false legal-proof claim."""
    if temporal_cross_ref is None:
        return False
    if isinstance(temporal_cross_ref, TemporalCrossRefBundleV1):
        data = temporal_cross_ref_to_metadata(temporal_cross_ref)
    else:
        data = dict(temporal_cross_ref)
    if data.get("is_execution_authority") is True:
        return False
    if data.get("legal_effective_dates_proven") is True:
        return False
    if data.get("amendment_applied") is True:
        return False
    if str(data.get("analysis_status") or "") != TemporalCrossRefStatus.COMPLETE.value:
        return False
    return bool(str(data.get("as_of_candidate") or "").strip())


def resolve_retrieval_as_of(
    temporal_cross_ref: Mapping[str, Any] | TemporalCrossRefBundleV1 | None,
) -> str | None:
    """Return normalized as_of timestamp for knowledge retrieval, or None.

    Candidate dates are filter hints only — never imply legal_effective_dates_proven.
    """
    if not should_apply_retrieval_as_of(temporal_cross_ref):
        return None
    if isinstance(temporal_cross_ref, TemporalCrossRefBundleV1):
        candidate = temporal_cross_ref.as_of_candidate
    else:
        candidate = (temporal_cross_ref or {}).get("as_of_candidate")
    raw = str(candidate or "").strip()
    if not raw:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return f"{raw}T23:59:59+00:00"
    return raw


def amendment_cues_present(
    temporal_cross_ref: Mapping[str, Any] | TemporalCrossRefBundleV1 | None,
) -> bool:
    """Whether amendment/supersession language was observed (cues only; never applied)."""
    if temporal_cross_ref is None:
        return False
    if isinstance(temporal_cross_ref, TemporalCrossRefBundleV1):
        kinds_t = {c.kind for c in temporal_cross_ref.temporal_cues}
        kinds_x = {c.kind for c in temporal_cross_ref.cross_ref_cues}
        return (
            TemporalCueKind.AMENDMENT_LANGUAGE in kinds_t
            or CrossRefCueKind.SUPERSEDES_CUE in kinds_x
        )
    kinds_t = set(temporal_cross_ref.get("temporal_kinds") or [])
    kinds_x = set(temporal_cross_ref.get("cross_ref_kinds") or [])
    return (
        TemporalCueKind.AMENDMENT_LANGUAGE.value in kinds_t
        or CrossRefCueKind.SUPERSEDES_CUE.value in kinds_x
    )


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "amendment_cues_present",
    "assert_temporal_cross_ref_authority",
    "attach_temporal_cross_ref_to_request",
    "build_temporal_cross_ref_bundle",
    "resolve_retrieval_as_of",
    "should_apply_retrieval_as_of",
    "temporal_cross_ref_to_metadata",
]
