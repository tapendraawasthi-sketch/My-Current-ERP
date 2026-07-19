"""MAI-26 slice 1 — temporal / cross-ref cue annotation (never proven)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.temporal_cross_ref import (
    CrossRefCueKind,
    TemporalCrossRefStatus,
    TemporalCueKind,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.temporal_cross_ref_service import (
    RUNTIME_VERSION,
    assert_temporal_cross_ref_authority,
    attach_temporal_cross_ref_to_request,
    build_temporal_cross_ref_bundle,
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
    return attach_temporal_cross_ref_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-26.")


def test_complete_without_claiming_proof() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.temporal_cross_ref_bundle
    assert bundle is not None
    assert bundle.analysis_status == TemporalCrossRefStatus.COMPLETE
    assert bundle.legal_effective_dates_proven is False
    assert bundle.amendment_applied is False
    assert bundle.documents_mutated == 0
    assert bundle.is_execution_authority is False
    assert_temporal_cross_ref_authority(bundle)


def test_date_and_act_cues() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.temporal_cross_ref_bundle
    assert bundle is not None
    assert bundle.analysis_status == TemporalCrossRefStatus.COMPLETE
    assert bundle.as_of_candidate == "2024-07-16"
    assert any(c.kind == TemporalCueKind.AS_OF_DATE for c in bundle.temporal_cues)
    assert any(c.kind == CrossRefCueKind.ACT_RULE_REF for c in bundle.cross_ref_cues)
    assert bundle.legal_effective_dates_proven is False


def test_fy_amendment_and_section() -> None:
    req = _pipeline("show VAT report FY 2080/81 amended section 12 supersedes")
    bundle = req.temporal_cross_ref_bundle
    assert bundle is not None
    kinds_t = {c.kind for c in bundle.temporal_cues}
    kinds_x = {c.kind for c in bundle.cross_ref_cues}
    assert TemporalCueKind.FISCAL_YEAR in kinds_t
    assert TemporalCueKind.AMENDMENT_LANGUAGE in kinds_t
    assert CrossRefCueKind.SECTION_REF in kinds_x
    assert CrossRefCueKind.SUPERSEDES_CUE in kinds_x
    assert bundle.amendment_applied is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.temporal_cross_ref_bundle
    assert bundle is not None
    assert bundle.analysis_status == TemporalCrossRefStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline("show NFRS report pursuant to section 5 as of 15/07/2023")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tcr = (dto.metadata or {}).get("temporal_cross_ref") or {}
    assert tcr.get("legal_effective_dates_proven") is False
    assert tcr.get("amendment_applied") is False
    assert tcr.get("is_execution_authority") is False
    assert tcr.get("as_of_candidate") == "2023-07-15"


def test_build_without_governance_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="as of 2024-01-01",
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
    bundle = build_temporal_cross_ref_bundle(req)
    assert bundle.analysis_status == TemporalCrossRefStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai26"
        / "frozen"
        / "temporal_cross_ref_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.temporal_cross_ref_bundle
        assert bundle is not None
        assert bundle.legal_effective_dates_proven is False
        assert bundle.amendment_applied is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_as_of"):
            assert bundle.as_of_candidate == case["expected_as_of"], case["case_id"]
        if case.get("expected_has_temporal"):
            assert len(bundle.temporal_cues) > 0, case["case_id"]
        if case.get("expected_has_xref"):
            assert len(bundle.cross_ref_cues) > 0, case["case_id"]
