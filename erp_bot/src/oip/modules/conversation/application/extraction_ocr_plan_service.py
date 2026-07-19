"""MAI-25 slice 2 — extraction / OCR plan from structural segments.

Consumes COMPLETE StructuralSegmentationBundle into ordered plan steps.
Never invokes OCR, executes tools, or mutates drafts/indexes.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.extraction_ocr_plan import (
    ExtractionOcrPlanBundleV1,
    ExtractionOcrPlanStatus,
    ExtractionPlanStepKind,
    ExtractionPlanStepV1,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.structural_segmentation import (
    StructuralSegmentationStatus,
    StructuralSegmentKind,
)

RUNTIME_VERSION = "mai-25.0.2-slice2"
AUTHORITY = "ADR_0042"

_KIND_TO_STEP: dict[StructuralSegmentKind, ExtractionPlanStepKind] = {
    StructuralSegmentKind.RECORD_BLOCK: ExtractionPlanStepKind.PARSE_RECORD_BLOCK,
    StructuralSegmentKind.TABLE_CUE: ExtractionPlanStepKind.PARSE_TABLE_CUE,
    StructuralSegmentKind.LIST_ITEM: ExtractionPlanStepKind.PARSE_LIST_ITEM,
    StructuralSegmentKind.HEADING: ExtractionPlanStepKind.PARSE_TEXT_SEGMENT,
    StructuralSegmentKind.FREE_TEXT: ExtractionPlanStepKind.PARSE_TEXT_SEGMENT,
    StructuralSegmentKind.UNKNOWN: ExtractionPlanStepKind.PARSE_TEXT_SEGMENT,
}


def _has_image_attachment(request: CanonicalAIRequestV1) -> bool:
    ui = request.active_ui_context or {}
    caps = request.client_capabilities or {}
    for src in (ui, caps):
        if src.get("has_image") is True or src.get("image_attachment") is True:
            return True
        mime = str(src.get("attachment_mime") or src.get("mime_type") or "").lower()
        if mime.startswith("image/"):
            return True
    return False


def build_extraction_ocr_plan_bundle(
    request: CanonicalAIRequestV1,
) -> ExtractionOcrPlanBundleV1:
    seg = request.structural_segmentation_bundle
    if seg is None:
        return ExtractionOcrPlanBundleV1(
            analysis_status=ExtractionOcrPlanStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_STRUCTURAL_SEGMENTATION",),
            warnings=("NO_STRUCTURAL_SEGMENTATION",),
        )

    if seg.analysis_status != StructuralSegmentationStatus.COMPLETE:
        return ExtractionOcrPlanBundleV1(
            analysis_status=ExtractionOcrPlanStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("SEGMENTATION_NOT_COMPLETE",),
            warnings=("SEGMENTATION_NOT_COMPLETE",),
        )

    steps: list[ExtractionPlanStepV1] = []
    for i, segment in enumerate(seg.segments, start=1):
        kind = _KIND_TO_STEP.get(
            segment.kind, ExtractionPlanStepKind.PARSE_TEXT_SEGMENT
        )
        steps.append(
            ExtractionPlanStepV1(
                step_id=f"x-{i:04d}",
                kind=kind,
                segment_id=segment.segment_id,
                reason_codes=("FROM_STRUCTURAL_SEGMENT", segment.kind.value),
            )
        )

    image = _has_image_attachment(request)
    if image:
        steps.append(
            ExtractionPlanStepV1(
                step_id=f"x-{len(steps) + 1:04d}",
                kind=ExtractionPlanStepKind.OCR_CANDIDATE,
                segment_id=None,
                reason_codes=("IMAGE_ATTACHMENT_CUE", "PLAN_ONLY_NO_EXECUTE"),
            )
        )
    else:
        steps.append(
            ExtractionPlanStepV1(
                step_id=f"x-{len(steps) + 1:04d}",
                kind=ExtractionPlanStepKind.SKIP_OCR,
                segment_id=None,
                reason_codes=("TEXT_INPUT_NO_OCR",),
            )
        )

    return ExtractionOcrPlanBundleV1(
        analysis_status=ExtractionOcrPlanStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        steps=tuple(steps),
        step_count=len(steps),
        ocr_candidate=image,
        ocr_execution_authorized=False,
        reason_codes=(
            "SEGMENTATION_COMPLETE",
            "DETERMINISTIC_EXTRACTION_PLAN",
            "OCR_EXECUTION_DENIED",
        ),
        ocr_invocations=0,
        extraction_mutations=0,
        draft_mutations=0,
        tool_executions=0,
    )


def attach_extraction_ocr_plan_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_extraction_ocr_plan_bundle(request)
    return request.model_copy(update={"extraction_ocr_plan_bundle": bundle})


def assert_extraction_ocr_plan_authority(
    bundle: ExtractionOcrPlanBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.ocr_execution_authorized
        or bundle.ocr_invocations != 0
        or bundle.extraction_mutations != 0
        or bundle.draft_mutations != 0
        or bundle.tool_executions != 0
    ):
        raise RuntimeError("EXTRACTION_OCR_PLAN_AUTHORITY")


def should_apply_extraction_ocr_plan(
    plan: Mapping[str, Any] | None,
) -> bool:
    if not isinstance(plan, Mapping):
        return False
    if plan.get("is_execution_authority") is True:
        return False
    if plan.get("ocr_execution_authorized") is True:
        return False
    if int(plan.get("ocr_invocations") or 0) != 0:
        return False
    if int(plan.get("tool_executions") or 0) != 0:
        return False
    return str(plan.get("analysis_status") or "") == (
        ExtractionOcrPlanStatus.COMPLETE.value
    )


def extraction_ocr_plan_to_metadata(
    bundle: ExtractionOcrPlanBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "step_count": bundle.step_count,
        "step_kinds": [s.kind.value for s in bundle.steps],
        "ocr_candidate": bundle.ocr_candidate,
        "ocr_execution_authorized": False,
        "reason_codes": list(bundle.reason_codes),
        "ocr_invocations": bundle.ocr_invocations,
        "extraction_mutations": bundle.extraction_mutations,
        "draft_mutations": bundle.draft_mutations,
        "tool_executions": bundle.tool_executions,
        "is_execution_authority": False,
    }


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "assert_extraction_ocr_plan_authority",
    "attach_extraction_ocr_plan_to_request",
    "build_extraction_ocr_plan_bundle",
    "extraction_ocr_plan_to_metadata",
    "should_apply_extraction_ocr_plan",
]
