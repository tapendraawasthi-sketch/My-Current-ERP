"""MAI-23 slice 1 — prompt registry annotation (no model invocation)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.prompt_registry import PromptRegistryAnalysisStatus
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
from src.oip.modules.conversation.application.prompt_registry_service import (
    RUNTIME_VERSION,
    assert_prompt_registry_authority,
    attach_prompt_registry_to_request,
    build_prompt_registry_bundle,
)
from src.oip.modules.conversation.application.provider_cascade_service import (
    attach_provider_cascade_to_request,
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
    req = attach_provider_cascade_to_request(req)
    return attach_prompt_registry_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-23.0.1-slice1"


def test_complete_purchase_selects_template() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.prompt_registry_bundle
    assert bundle is not None
    assert bundle.analysis_status == PromptRegistryAnalysisStatus.COMPLETE
    assert bundle.is_execution_authority is False
    assert bundle.model_invocations == 0
    assert bundle.selected_prompt_template_id == "erp.purchase.preview.v1"
    assert bundle.structured_output_schema_ref == "schemas/erp.purchase.preview.v1"
    assert_prompt_registry_authority(bundle)


def test_report_selects_template() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.prompt_registry_bundle
    assert bundle is not None
    assert bundle.analysis_status == PromptRegistryAnalysisStatus.COMPLETE
    assert bundle.selected_prompt_template_id == "erp.report.read.v1"


def test_incomplete_skips() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    bundle = req.prompt_registry_bundle
    assert bundle is not None
    assert bundle.analysis_status == PromptRegistryAnalysisStatus.SKIP
    assert bundle.selected_prompt_template_id is None


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.prompt_registry_bundle
    assert bundle is not None
    assert bundle.analysis_status == PromptRegistryAnalysisStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    pr = (dto.metadata or {}).get("prompt_registry") or {}
    assert pr.get("is_execution_authority") is False
    assert pr.get("model_invocations") == 0
    assert pr.get("analysis_status") == "COMPLETE"
    assert pr.get("selected_prompt_template_id")


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
    bundle = build_prompt_registry_bundle(req)
    assert bundle.analysis_status == PromptRegistryAnalysisStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai23"
        / "frozen"
        / "prompt_registry_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.prompt_registry_bundle
        assert bundle is not None
        assert bundle.model_invocations == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_template_id"):
            assert (
                bundle.selected_prompt_template_id == case["expected_template_id"]
            ), case["case_id"]
        if case.get("expected_has_template") is False:
            assert bundle.selected_prompt_template_id is None, case["case_id"]
