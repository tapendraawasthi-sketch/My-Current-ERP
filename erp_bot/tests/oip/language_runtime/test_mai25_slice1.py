"""MAI-25 slice 1 — structural segmentation annotation (no OCR)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.structural_segmentation import (
    StructuralSegmentationStatus,
    StructuralSegmentKind,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.structural_segmentation_service import (
    RUNTIME_VERSION,
    assert_structural_segmentation_authority,
    attach_structural_segmentation_to_request,
    build_structural_segmentation_bundle,
)


def _pipeline(text: str):
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
    )
    req = attach_router_decision_to_request(req)
    req = attach_knowledge_source_governance_to_request(req)
    return attach_structural_segmentation_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-25.0.1-slice1"


def test_complete_free_text() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.structural_segmentation_bundle
    assert bundle is not None
    assert bundle.analysis_status == StructuralSegmentationStatus.COMPLETE
    assert bundle.segment_count >= 1
    assert any(s.kind == StructuralSegmentKind.FREE_TEXT for s in bundle.segments)
    assert bundle.ocr_invocations == 0
    assert bundle.ocr_recommended is False
    assert bundle.is_execution_authority is False
    assert_structural_segmentation_authority(bundle)


def test_record_and_structure_kinds() -> None:
    req = _pipeline("RECORD purchase_v1\n# Notes\n- rice\n| a | b |")
    bundle = req.structural_segmentation_bundle
    assert bundle is not None
    assert bundle.analysis_status == StructuralSegmentationStatus.COMPLETE
    kinds = {s.kind for s in bundle.segments}
    assert StructuralSegmentKind.RECORD_BLOCK in kinds
    assert StructuralSegmentKind.HEADING in kinds
    assert StructuralSegmentKind.LIST_ITEM in kinds
    assert StructuralSegmentKind.TABLE_CUE in kinds


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.structural_segmentation_bundle
    assert bundle is not None
    assert bundle.analysis_status == StructuralSegmentationStatus.SKIP
    assert bundle.segment_count == 0


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ss = (dto.metadata or {}).get("structural_segmentation") or {}
    assert ss.get("is_execution_authority") is False
    assert ss.get("ocr_invocations") == 0
    assert ss.get("analysis_status") == "COMPLETE"
    assert ss.get("segment_count", 0) >= 1


def test_build_without_governance_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="hello",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    bundle = build_structural_segmentation_bundle(req)
    assert bundle.analysis_status == StructuralSegmentationStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai25"
        / "frozen"
        / "structural_segmentation_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.structural_segmentation_bundle
        assert bundle is not None
        assert bundle.ocr_invocations == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_has_free_text") and (
            bundle.analysis_status == StructuralSegmentationStatus.COMPLETE
        ):
            assert any(
                s.kind == StructuralSegmentKind.FREE_TEXT for s in bundle.segments
            ), case["case_id"]
        if case.get("expected_kinds"):
            assert [s.kind.value for s in bundle.segments] == case[
                "expected_kinds"
            ], case["case_id"]
        if case.get("expected_kinds_any"):
            kinds = {s.kind.value for s in bundle.segments}
            for k in case["expected_kinds_any"]:
                assert k in kinds, case["case_id"]
