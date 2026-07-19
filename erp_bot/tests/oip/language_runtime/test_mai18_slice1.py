"""MAI-18 slice 1 — event specification registry annotation."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.event_spec_registry import EventSpecAnalysisStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    RUNTIME_VERSION,
    attach_event_spec_registry_to_request,
    build_event_spec_registry_bundle,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)


def _request(text: str) -> CanonicalAIRequestV1:
    return CanonicalAIRequestV1(
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


def _routed(text: str) -> CanonicalAIRequestV1:
    return attach_router_decision_to_request(_request(text))


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-18.")


def test_purchase_selects_purchase_spec() -> None:
    bundle = build_event_spec_registry_bundle(
        _routed("Ram bata 500 ko saman kine")
    )
    assert bundle.analysis_status == EventSpecAnalysisStatus.COMPLETE
    assert bundle.selected_spec_id == "purchase_v1"
    assert bundle.is_execution_authority is False
    assert bundle.silent_applications == 0
    assert bundle.draft_mutations == 0
    selected = next(c for c in bundle.candidates if c.selected)
    assert "party" in selected.required_fields
    assert "amount" in selected.required_fields


def test_report_selects_report_spec() -> None:
    bundle = build_event_spec_registry_bundle(_routed("show balance sheet"))
    assert bundle.selected_spec_id == "report_v1"
    assert bundle.candidates[0].event_type == "report"


def test_ood_gibberish_unknown_spec() -> None:
    bundle = build_event_spec_registry_bundle(_routed("asdf qwer zxcv"))
    assert bundle.selected_spec_id == "unknown_v1"
    assert bundle.analysis_status in {
        EventSpecAnalysisStatus.PARTIAL,
        EventSpecAnalysisStatus.UNKNOWN,
    }


def test_missing_router_partial() -> None:
    bundle = build_event_spec_registry_bundle(_request("hello"))
    assert bundle.selected_spec_id == "unknown_v1"
    assert bundle.analysis_status == EventSpecAnalysisStatus.PARTIAL
    assert "ROUTER_DECISION_ABSENT" in bundle.warnings


def test_attach_preserves_raw_text() -> None:
    req = _routed("show trial balance")
    updated = attach_event_spec_registry_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.event_spec_registry_bundle is not None
    assert updated.event_spec_registry_bundle.runtime_version == RUNTIME_VERSION


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = attach_event_spec_registry_to_request(_routed("Ram bata 500 ko saman kine"))
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    es = (dto.metadata or {}).get("event_spec_registry")
    assert isinstance(es, dict)
    assert es.get("runtime_version") == RUNTIME_VERSION
    assert es.get("selected_spec_id") == "purchase_v1"
    assert es.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai18"
        / "frozen"
        / "event_spec_registry_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _routed(case["text"]) if case.get("with_router", True) else _request(
            case["text"]
        )
        bundle = build_event_spec_registry_bundle(req)
        assert bundle.silent_applications == 0
        assert bundle.draft_mutations == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_spec_id"):
            assert bundle.selected_spec_id == case["expected_spec_id"], case[
                "case_id"
            ]
