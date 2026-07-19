"""MAI-25 slice 2 — extraction / OCR plan from structural segments."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.extraction_ocr_plan import (
    ExtractionOcrPlanStatus,
    ExtractionPlanStepKind,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.extraction_ocr_plan_service import (
    RUNTIME_VERSION,
    assert_extraction_ocr_plan_authority,
    attach_extraction_ocr_plan_to_request,
    extraction_ocr_plan_to_metadata,
    should_apply_extraction_ocr_plan,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.structural_segmentation_service import (
    attach_structural_segmentation_to_request,
)


def _pipeline(text: str, *, has_image: bool = False):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        active_ui_context={"has_image": True} if has_image else {},
    )
    req = attach_router_decision_to_request(req)
    req = attach_knowledge_source_governance_to_request(req)
    req = attach_structural_segmentation_to_request(req)
    return attach_extraction_ocr_plan_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-25.0.2-slice2"


def test_complete_plan_skips_ocr_for_text() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.extraction_ocr_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExtractionOcrPlanStatus.COMPLETE
    assert bundle.ocr_execution_authorized is False
    assert bundle.ocr_invocations == 0
    assert bundle.tool_executions == 0
    assert bundle.ocr_candidate is False
    kinds = [s.kind for s in bundle.steps]
    assert ExtractionPlanStepKind.SKIP_OCR in kinds
    assert ExtractionPlanStepKind.OCR_CANDIDATE not in kinds
    assert_extraction_ocr_plan_authority(bundle)


def test_record_table_plan_steps() -> None:
    req = _pipeline("RECORD purchase_v1\n| a | b |")
    bundle = req.extraction_ocr_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExtractionOcrPlanStatus.COMPLETE
    kinds = {s.kind for s in bundle.steps}
    assert ExtractionPlanStepKind.PARSE_RECORD_BLOCK in kinds
    assert ExtractionPlanStepKind.PARSE_TABLE_CUE in kinds
    assert ExtractionPlanStepKind.SKIP_OCR in kinds


def test_image_cue_marks_ocr_candidate_but_denied() -> None:
    req = _pipeline("Ram bata 500 ko saman kine", has_image=True)
    bundle = req.extraction_ocr_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExtractionOcrPlanStatus.COMPLETE
    assert bundle.ocr_candidate is True
    assert bundle.ocr_execution_authorized is False
    assert any(s.kind == ExtractionPlanStepKind.OCR_CANDIDATE for s in bundle.steps)
    assert_extraction_ocr_plan_authority(bundle)


def test_ood_skips_plan() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.extraction_ocr_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExtractionOcrPlanStatus.SKIP
    meta = extraction_ocr_plan_to_metadata(bundle)
    assert should_apply_extraction_ocr_plan(meta) is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai25"
        / "frozen"
        / "extraction_ocr_plan_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"], has_image=bool(case.get("has_image")))
        bundle = req.extraction_ocr_plan_bundle
        assert bundle is not None
        assert bundle.ocr_invocations == 0
        assert bundle.ocr_execution_authorized is False
        assert bundle.tool_executions == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_skip_ocr"):
            assert any(
                s.kind == ExtractionPlanStepKind.SKIP_OCR for s in bundle.steps
            ), case["case_id"]
        if case.get("expected_ocr_candidate"):
            assert bundle.ocr_candidate is True, case["case_id"]
            assert any(
                s.kind == ExtractionPlanStepKind.OCR_CANDIDATE for s in bundle.steps
            ), case["case_id"]
