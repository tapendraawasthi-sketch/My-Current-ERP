"""MAI-25 slice 1 — structural segmentation annotation (no OCR).

Deterministic line/block cues on raw_text when knowledge-source governance
is COMPLETE. Never invokes OCR, mutates indexes/drafts, or extracts values.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.structural_segmentation import (
    StructuralSegmentationBundleV1,
    StructuralSegmentationStatus,
    StructuralSegmentKind,
    StructuralSegmentV1,
)

RUNTIME_VERSION = "mai-25.0.1-slice1"
AUTHORITY = "ADR_0042"

_RECORD_RE = re.compile(r"^\s*RECORD\s+\S+", re.IGNORECASE)
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+\S+")
_LIST_RE = re.compile(r"^\s*(?:[-*]|\d+[.)])\s+\S+")
_TABLE_RE = re.compile(r"\|.+\|")
_PREVIEW_MAX = 120


def _classify_line(line: str) -> tuple[StructuralSegmentKind, float, tuple[str, ...]]:
    stripped = line.strip()
    if not stripped:
        return StructuralSegmentKind.UNKNOWN, 0.0, ("EMPTY_LINE",)
    if _RECORD_RE.match(stripped):
        return StructuralSegmentKind.RECORD_BLOCK, 0.95, ("RECORD_MARKER",)
    if _HEADING_RE.match(stripped):
        return StructuralSegmentKind.HEADING, 0.9, ("MARKDOWN_HEADING",)
    if _TABLE_RE.search(stripped) or "\t" in line:
        return StructuralSegmentKind.TABLE_CUE, 0.85, ("TABLE_DELIMITER",)
    if _LIST_RE.match(stripped):
        return StructuralSegmentKind.LIST_ITEM, 0.8, ("LIST_MARKER",)
    return StructuralSegmentKind.FREE_TEXT, 0.7, ("PLAIN_LINE",)


def _segment_text(text: str) -> tuple[StructuralSegmentV1, ...]:
    raw = text or ""
    if not raw.strip():
        return ()
    segments: list[StructuralSegmentV1] = []
    offset = 0
    idx = 0
    # Preserve final newline-less last line via splitlines(keepends=True)
    parts = raw.splitlines(keepends=True)
    if not parts:
        parts = [raw]
    for part in parts:
        line = part.rstrip("\r\n")
        start = offset
        end = start + len(line)
        kind, conf, reasons = _classify_line(line)
        if kind != StructuralSegmentKind.UNKNOWN:
            idx += 1
            preview = line[:_PREVIEW_MAX]
            segments.append(
                StructuralSegmentV1(
                    segment_id=f"seg-{idx:04d}",
                    kind=kind,
                    start_offset=start,
                    end_offset=end,
                    preview=preview,
                    confidence=conf,
                    reason_codes=reasons,
                )
            )
        offset += len(part)
    if not segments and raw.strip():
        segments.append(
            StructuralSegmentV1(
                segment_id="seg-0001",
                kind=StructuralSegmentKind.FREE_TEXT,
                start_offset=0,
                end_offset=len(raw),
                preview=raw.strip()[:_PREVIEW_MAX],
                confidence=0.6,
                reason_codes=("WHOLE_TEXT_FALLBACK",),
            )
        )
    return tuple(segments)


def build_structural_segmentation_bundle(
    request: CanonicalAIRequestV1,
) -> StructuralSegmentationBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return StructuralSegmentationBundleV1(
            analysis_status=StructuralSegmentationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_KNOWLEDGE_SOURCE_GOVERNANCE",),
            warnings=("NO_KNOWLEDGE_SOURCE_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return StructuralSegmentationBundleV1(
            analysis_status=StructuralSegmentationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    text = request.raw_text or ""
    if not text.strip():
        return StructuralSegmentationBundleV1(
            analysis_status=StructuralSegmentationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("EMPTY_RAW_TEXT",),
            warnings=("EMPTY_RAW_TEXT",),
        )

    segments = _segment_text(text)
    return StructuralSegmentationBundleV1(
        analysis_status=StructuralSegmentationStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        segments=segments,
        segment_count=len(segments),
        ocr_recommended=False,
        reason_codes=("GOVERNANCE_COMPLETE", "DETERMINISTIC_LINE_SEGMENTATION"),
        ocr_invocations=0,
        extraction_mutations=0,
        draft_mutations=0,
        index_mutations=0,
    )


def attach_structural_segmentation_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_structural_segmentation_bundle(request)
    return request.model_copy(update={"structural_segmentation_bundle": bundle})


def assert_structural_segmentation_authority(
    bundle: StructuralSegmentationBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.ocr_invocations != 0
        or bundle.extraction_mutations != 0
        or bundle.draft_mutations != 0
        or bundle.index_mutations != 0
    ):
        raise RuntimeError("STRUCTURAL_SEGMENTATION_AUTHORITY")


def structural_segmentation_to_metadata(
    bundle: StructuralSegmentationBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "segment_count": bundle.segment_count,
        "ocr_recommended": bundle.ocr_recommended,
        "segment_kinds": [s.kind.value for s in bundle.segments],
        "reason_codes": list(bundle.reason_codes),
        "ocr_invocations": bundle.ocr_invocations,
        "extraction_mutations": bundle.extraction_mutations,
        "draft_mutations": bundle.draft_mutations,
        "index_mutations": bundle.index_mutations,
        "is_execution_authority": False,
    }


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "assert_structural_segmentation_authority",
    "attach_structural_segmentation_to_request",
    "build_structural_segmentation_bundle",
    "structural_segmentation_to_metadata",
]
