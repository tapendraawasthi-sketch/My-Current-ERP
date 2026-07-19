"""MAI-22 slice 1 — provider cascade annotation (no model invocation)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.provider_cascade import ProviderCascadeAnalysisStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.clarification_plan_service import (
    attach_clarification_plan_to_request,
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
from src.oip.modules.conversation.application.provider_cascade_service import (
    RUNTIME_VERSION,
    assert_provider_cascade_authority,
    attach_provider_cascade_to_request,
    build_provider_cascade_bundle,
)
from src.oip.modules.conversation.application.typed_plan_service import (
    attach_typed_plan_to_request,
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
    req = attach_clarification_plan_to_request(req)
    req = attach_typed_plan_to_request(req)
    return attach_provider_cascade_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-22.")


def test_complete_purchase_gets_cascade() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.provider_cascade_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProviderCascadeAnalysisStatus.COMPLETE
    assert bundle.is_execution_authority is False
    assert bundle.model_invocations == 0
    assert bundle.selected_provider_id
    assert len(bundle.cascade_order) >= 2
    assert bundle.cascade_order[0] == bundle.selected_provider_id
    assert bundle.fallback_chain == bundle.cascade_order[1:]
    assert_provider_cascade_authority(bundle)


def test_incomplete_skips() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    bundle = req.provider_cascade_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProviderCascadeAnalysisStatus.SKIP
    assert bundle.selected_provider_id is None
    assert bundle.model_invocations == 0


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.provider_cascade_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProviderCascadeAnalysisStatus.SKIP


def test_report_cascade() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.provider_cascade_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProviderCascadeAnalysisStatus.COMPLETE
    assert "ollama" in bundle.cascade_order or bundle.selected_provider_id


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    pc = (dto.metadata or {}).get("provider_cascade") or {}
    assert pc.get("is_execution_authority") is False
    assert pc.get("model_invocations") == 0
    assert pc.get("analysis_status") == "COMPLETE"
    assert pc.get("selected_provider_id")


def test_build_without_typed_plan_skips() -> None:
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
    bundle = build_provider_cascade_bundle(req)
    assert bundle.analysis_status == ProviderCascadeAnalysisStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai22"
        / "frozen"
        / "provider_cascade_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.provider_cascade_bundle
        assert bundle is not None
        assert bundle.model_invocations == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_has_provider") is True:
            assert bundle.selected_provider_id
            assert len(bundle.cascade_order) >= 1
        if case.get("expected_has_provider") is False:
            assert bundle.selected_provider_id is None
