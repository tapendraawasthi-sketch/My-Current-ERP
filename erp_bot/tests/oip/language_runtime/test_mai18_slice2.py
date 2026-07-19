"""MAI-18 slice 2 — EventFrame skeleton from selected event spec."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.event_frame import FrameStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    RUNTIME_VERSION,
    attach_event_spec_registry_to_request,
    build_event_frame_skeleton,
    build_event_spec_registry_bundle,
    event_frame_to_metadata,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)


def _routed(text: str) -> CanonicalAIRequestV1:
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
    return attach_router_decision_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-18.0.2-slice2"


def test_purchase_skeleton_missing_party_amount() -> None:
    req = _routed("Ram bata 500 ko saman kine")
    registry = build_event_spec_registry_bundle(req)
    frame = build_event_frame_skeleton(req, registry=registry)
    assert frame.event_type == "purchase"
    assert frame.status == FrameStatus.PARTIAL
    assert set(frame.missing_required_fields) == {"party", "amount"}
    assert frame.values == ()
    assert frame.explicit_values == ()
    assert frame.authorizes_posting is False
    assert frame.receipt_id is None
    assert (frame.inherited_context or {}).get("selected_spec_id") == "purchase_v1"


def test_report_skeleton_missing_report_type() -> None:
    req = _routed("show balance sheet")
    registry = build_event_spec_registry_bundle(req)
    frame = build_event_frame_skeleton(req, registry=registry)
    assert frame.event_type == "report"
    assert "report_type" in frame.missing_required_fields
    assert frame.values == ()


def test_ood_unknown_empty_skeleton() -> None:
    req = _routed("asdf qwer zxcv")
    registry = build_event_spec_registry_bundle(req)
    frame = build_event_frame_skeleton(req, registry=registry)
    assert frame.event_type == "unknown"
    assert frame.status == FrameStatus.EMPTY
    assert frame.missing_required_fields == ()


def test_attach_sets_both_bundles() -> None:
    req = _routed("Ram bata 500 ko saman kine")
    updated = attach_event_spec_registry_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.event_spec_registry_bundle is not None
    assert updated.event_frame is not None
    assert updated.event_frame.values == ()
    assert updated.event_spec_registry_bundle.runtime_version == RUNTIME_VERSION


def test_adapter_metadata_event_frame() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = attach_event_spec_registry_to_request(
        _routed("Ram bata 500 ko saman kine")
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ef = (dto.metadata or {}).get("event_frame")
    assert isinstance(ef, dict)
    assert ef.get("event_type") == "purchase"
    assert "party" in (ef.get("missing_required_fields") or [])
    assert ef.get("authorizes_posting") is False
    assert ef.get("value_count") == 0


def test_event_frame_metadata_helper() -> None:
    req = _routed("show trial balance")
    frame = build_event_frame_skeleton(
        req, registry=build_event_spec_registry_bundle(req)
    )
    meta = event_frame_to_metadata(frame)
    assert meta["authorizes_posting"] is False
    assert meta["value_count"] == 0


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai18"
        / "frozen"
        / "event_frame_skeleton_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _routed(case["text"])
        registry = build_event_spec_registry_bundle(req)
        frame = build_event_frame_skeleton(req, registry=registry)
        assert frame.authorizes_posting is False
        assert len(frame.values) == 0
        if case.get("expected_event_type"):
            assert frame.event_type == case["expected_event_type"], case[
                "case_id"
            ]
        if case.get("expected_missing"):
            assert set(frame.missing_required_fields) == set(
                case["expected_missing"]
            ), case["case_id"]
        if case.get("expected_status"):
            assert frame.status.value == case["expected_status"], case[
                "case_id"
            ]
