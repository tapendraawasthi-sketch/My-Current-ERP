"""MAI-32 slice 1 — durable versioned draft readiness (never writes)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.durable_versioned_draft import (
    DraftDurabilityStatus,
    DraftVersionPolicy,
    DurableVersionedDraftStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    attach_domain_port_mapping_to_request,
)
from src.oip.modules.conversation.application.durable_versioned_draft_service import (
    RUNTIME_VERSION,
    assert_durable_versioned_draft_authority,
    attach_durable_versioned_draft_to_request,
    build_durable_versioned_draft_bundle,
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
    return attach_durable_versioned_draft_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-32.0.1-slice1"


def test_purchase_complete_ephemeral() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.durable_versioned_draft_bundle
    assert bundle is not None
    assert bundle.analysis_status == DurableVersionedDraftStatus.COMPLETE
    assert bundle.selected_port_id == "purchase_draft_port"
    assert bundle.draft_module_id == "purchase_draft"
    assert bundle.known_store_filename == "purchase_drafts.json"
    assert bundle.version_policy == DraftVersionPolicy.MONOTONIC_INT_BUMP
    assert bundle.durability_status == DraftDurabilityStatus.EPHEMERAL_LOCAL_JSON
    assert bundle.production_store_authority is False
    assert bundle.local_json_is_production_authority is False
    assert bundle.draft_aggregate_ready is False
    assert bundle.store_ready_for_production is False
    assert bundle.store_ready_for_annotation is True
    assert bundle.save_invoked is False
    assert bundle.load_invoked is False
    assert bundle.draft_mutations == 0
    assert bundle.is_execution_authority is False
    assert "LOCAL_JSON_NOT_PRODUCTION_AUTHORITY" in bundle.reason_codes
    assert_durable_versioned_draft_authority(bundle)


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.durable_versioned_draft_bundle
    assert bundle is not None
    assert bundle.analysis_status == DurableVersionedDraftStatus.SKIP
    assert bundle.save_invoked is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.durable_versioned_draft_bundle
    assert bundle is not None
    assert bundle.analysis_status == DurableVersionedDraftStatus.SKIP


def test_no_mapping_skips() -> None:
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
    bundle = build_durable_versioned_draft_bundle(req)
    assert bundle.analysis_status == DurableVersionedDraftStatus.SKIP
    assert "NO_DOMAIN_PORT_MAPPING" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    dvd = (dto.metadata or {}).get("durable_versioned_draft") or {}
    assert dvd.get("save_invoked") is False
    assert dvd.get("draft_mutations") == 0
    assert dvd.get("production_store_authority") is False
    assert dvd.get("draft_aggregate_ready") is False
    assert dvd.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai32"
        / "frozen"
        / "durable_versioned_draft_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.durable_versioned_draft_bundle
        assert bundle is not None
        assert bundle.save_invoked is False
        assert bundle.draft_mutations == 0
        assert bundle.production_store_authority is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_durability"):
            assert bundle.durability_status.value == case["expected_durability"], case[
                "case_id"
            ]
        if case.get("expected_module"):
            assert bundle.draft_module_id == case["expected_module"], case["case_id"]
