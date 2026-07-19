"""MAI-33 slice 1 — deterministic preview / edit-loop policy (never generates)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.deterministic_preview_edit_loop import (
    DeterministicPreviewEditLoopStatus,
    EditLoopPolicy,
    PreviewReadiness,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.deterministic_preview_edit_loop_service import (
    RUNTIME_VERSION,
    assert_deterministic_preview_edit_loop_authority,
    attach_deterministic_preview_edit_loop_to_request,
    build_deterministic_preview_edit_loop_bundle,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    attach_domain_port_mapping_to_request,
)
from src.oip.modules.conversation.application.durable_versioned_draft_service import (
    attach_durable_versioned_draft_to_request,
)
from src.oip.modules.conversation.application.event_frame_extraction_service import (
    attach_event_frame_extraction_to_request,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    attach_event_spec_registry_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
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
    req = attach_event_spec_registry_to_request(req)
    req = attach_event_frame_extraction_to_request(req)
    req = attach_domain_port_mapping_to_request(req)
    req = attach_durable_versioned_draft_to_request(req)
    return attach_deterministic_preview_edit_loop_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-33.0.1-slice1"


def test_purchase_policy_declared() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.deterministic_preview_edit_loop_bundle
    assert bundle is not None
    assert bundle.analysis_status == DeterministicPreviewEditLoopStatus.COMPLETE
    assert bundle.preview_readiness == PreviewReadiness.POLICY_DECLARED
    assert bundle.edit_loop_policy == EditLoopPolicy.INVALIDATE_PREVIEW_ON_EDIT
    assert bundle.draft_module_id == "purchase_draft"
    assert bundle.stale_preview_on_confirm == "REJECT"
    assert bundle.gap_p2_002_status == "OPEN"
    assert bundle.preview_generated is False
    assert bundle.confirmation_card_generated is False
    assert bundle.preview_message_invoked is False
    assert bundle.journal_calculated is False
    assert bundle.draft_mutations == 0
    assert bundle.is_execution_authority is False
    assert "PREVIEW_POLICY_DECLARED" in bundle.reason_codes
    assert_deterministic_preview_edit_loop_authority(bundle)


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.deterministic_preview_edit_loop_bundle
    assert bundle is not None
    assert bundle.analysis_status == DeterministicPreviewEditLoopStatus.SKIP
    assert bundle.preview_generated is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.deterministic_preview_edit_loop_bundle
    assert bundle is not None
    assert bundle.analysis_status == DeterministicPreviewEditLoopStatus.SKIP


def test_no_durable_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="Ram bata 500 ko saman kine",
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
    bundle = build_deterministic_preview_edit_loop_bundle(req)
    assert bundle.analysis_status == DeterministicPreviewEditLoopStatus.SKIP
    assert "NO_DURABLE_VERSIONED_DRAFT" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    pel = (dto.metadata or {}).get("deterministic_preview_edit_loop") or {}
    assert pel.get("preview_generated") is False
    assert pel.get("confirmation_card_generated") is False
    assert pel.get("journal_calculated") is False
    assert pel.get("gap_p2_002_status") == "OPEN"
    assert pel.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai33"
        / "frozen"
        / "deterministic_preview_edit_loop_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.deterministic_preview_edit_loop_bundle
        assert bundle is not None
        assert bundle.preview_generated is False
        assert bundle.confirmation_card_generated is False
        assert bundle.journal_calculated is False
        assert bundle.gap_p2_002_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert bundle.preview_readiness.value == case["expected_readiness"], case[
                "case_id"
            ]
