"""MAI-19 slice 1 — structured EventFrame value extraction."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.event_frame import FrameStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.event_frame_extraction_service import (
    RUNTIME_VERSION,
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
    return attach_event_frame_extraction_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-19.")


def test_purchase_fills_party_and_amount() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    frame = req.event_frame
    assert frame is not None
    assert frame.event_type == "purchase"
    assert frame.status == FrameStatus.COMPLETE
    assert frame.missing_required_fields == ()
    names = {v.field_name for v in frame.values}
    assert {"party", "amount"}.issubset(names)
    assert frame.authorizes_posting is False
    assert frame.receipt_id is None
    party = next(v for v in frame.values if v.field_name == "party")
    amount = next(v for v in frame.values if v.field_name == "amount")
    assert party.normalized_value == "Ram"
    assert amount.normalized_value.amount == "500"


def test_report_fills_report_type() -> None:
    req = _pipeline("show balance sheet")
    frame = req.event_frame
    assert frame is not None
    assert frame.event_type == "report"
    assert frame.missing_required_fields == ()
    assert frame.status == FrameStatus.COMPLETE
    rt = next(v for v in frame.values if v.field_name == "report_type")
    assert rt.normalized_value == "balance_sheet"


def test_ood_stays_empty() -> None:
    req = _pipeline("asdf qwer zxcv")
    frame = req.event_frame
    assert frame is not None
    assert frame.event_type == "unknown"
    assert frame.values == ()
    assert frame.status == FrameStatus.EMPTY
    assert frame.authorizes_posting is False


def test_english_purchase_from_pattern() -> None:
    req = _pipeline("bought rice from Ram for 500")
    frame = req.event_frame
    assert frame is not None
    assert frame.event_type == "purchase"
    assert "party" in frame.explicit_values
    assert "amount" in frame.explicit_values
    assert frame.missing_required_fields == ()


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ef = (dto.metadata or {}).get("event_frame")
    assert isinstance(ef, dict)
    assert int(ef.get("value_count") or 0) >= 2
    assert ef.get("authorizes_posting") is False
    assert "party" in (ef.get("filled_fields") or [])


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai19"
        / "frozen"
        / "event_frame_extraction_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        frame = req.event_frame
        assert frame is not None
        assert frame.authorizes_posting is False
        if case.get("expected_event_type"):
            assert frame.event_type == case["expected_event_type"], case[
                "case_id"
            ]
        if case.get("expected_status"):
            assert frame.status.value == case["expected_status"], case[
                "case_id"
            ]
        if "expected_missing" in case:
            assert set(frame.missing_required_fields) == set(
                case["expected_missing"]
            ), case["case_id"]
        if case.get("expected_filled"):
            assert set(case["expected_filled"]).issubset(
                set(frame.explicit_values)
            ), case["case_id"]
