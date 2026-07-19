"""MAI-31 slice 1 — EventFrame → domain port mapping annotation (never executes)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.domain_port_mapping import (
    DomainPortMappingStatus,
    DomainPortSupportStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    RUNTIME_VERSION,
    assert_domain_port_mapping_authority,
    attach_domain_port_mapping_to_request,
    build_domain_port_mapping_bundle,
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
    return attach_domain_port_mapping_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-31.0.1-slice1"


def test_purchase_supported_or_incomplete() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.domain_port_mapping_bundle
    assert bundle is not None
    assert bundle.analysis_status == DomainPortMappingStatus.COMPLETE
    assert bundle.event_type == "purchase"
    assert bundle.selected_port_id == "purchase_draft_port"
    assert bundle.selected_draft_entrypoint == "start_or_merge_purchase"
    assert bundle.support_status in {
        DomainPortSupportStatus.SUPPORTED,
        DomainPortSupportStatus.INCOMPLETE,
    }
    assert len(bundle.field_bindings) >= 2
    assert bundle.port_executed is False
    assert bundle.draft_mutations == 0
    assert bundle.dexie_invoked is False
    assert bundle.journal_calculated is False
    assert bundle.mode_aware_invoked is False
    assert bundle.lookup_executed is False
    assert bundle.is_execution_authority is False
    assert_domain_port_mapping_authority(bundle)


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.domain_port_mapping_bundle
    assert bundle is not None
    assert bundle.analysis_status == DomainPortMappingStatus.SKIP
    assert bundle.support_status == DomainPortSupportStatus.NOT_APPLICABLE
    assert bundle.port_executed is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.domain_port_mapping_bundle
    assert bundle is not None
    assert bundle.analysis_status == DomainPortMappingStatus.SKIP
    assert bundle.port_executed is False


def test_no_event_frame_skips() -> None:
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
    bundle = build_domain_port_mapping_bundle(req)
    assert bundle.analysis_status == DomainPortMappingStatus.SKIP
    assert "NO_EVENT_FRAME" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    dpm = (dto.metadata or {}).get("domain_port_mapping") or {}
    assert dpm.get("port_executed") is False
    assert dpm.get("draft_mutations") == 0
    assert dpm.get("dexie_invoked") is False
    assert dpm.get("journal_calculated") is False
    assert dpm.get("mode_aware_invoked") is False
    assert dpm.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai31"
        / "frozen"
        / "domain_port_mapping_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.domain_port_mapping_bundle
        assert bundle is not None
        assert bundle.port_executed is False
        assert bundle.draft_mutations == 0
        assert bundle.dexie_invoked is False
        assert bundle.journal_calculated is False
        assert bundle.mode_aware_invoked is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_support"):
            assert bundle.support_status.value == case["expected_support"], case[
                "case_id"
            ]
        if case.get("expected_port_id"):
            assert bundle.selected_port_id == case["expected_port_id"], case["case_id"]
