"""MAI-19 slice 2 — optional fields + ambiguous qty numbers."""

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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-19.0.2-slice2"


def test_payment_mode_and_item() -> None:
    req = _pipeline("bought 50 kg rice from Ram for Rs 500 cash")
    frame = req.event_frame
    assert frame is not None
    assert frame.status == FrameStatus.COMPLETE
    assert "payment_mode" in frame.explicit_values
    assert "item" in frame.explicit_values or frame.items
    pm = next(v for v in frame.values if v.field_name == "payment_mode")
    assert pm.normalized_value == "cash"
    assert "quantity_candidate" in frame.ambiguous_fields
    assert frame.authorizes_posting is False


def test_date_optional() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 on 2026-01-15")
    frame = req.event_frame
    assert frame is not None
    assert "date" in frame.explicit_values
    assert frame.dates_and_periods
    assert frame.dates_and_periods[0].normalized_value.normalized_date == "2026-01-15"


def test_qty_without_money_cue_does_not_steal_amount() -> None:
    # Qty present, no clear money cue → amount stays missing (fail-closed).
    req = _pipeline("bought 50 kg rice from Ram")
    frame = req.event_frame
    assert frame is not None
    assert frame.event_type == "purchase"
    assert "party" in frame.explicit_values
    assert "quantity_candidate" in frame.ambiguous_fields
    assert "amount" not in frame.explicit_values
    assert "amount" in frame.missing_required_fields


def test_nepali_ko_still_fills_amount_with_item() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    frame = req.event_frame
    assert frame is not None
    assert "amount" in frame.explicit_values
    assert "party" in frame.explicit_values
    assert frame.missing_required_fields == ()


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai19"
        / "frozen"
        / "event_frame_optional_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        frame = req.event_frame
        assert frame is not None
        assert frame.authorizes_posting is False
        if case.get("expected_filled_contains"):
            assert set(case["expected_filled_contains"]).issubset(
                set(frame.explicit_values)
            ), case["case_id"]
        if case.get("expected_ambiguous_contains"):
            assert set(case["expected_ambiguous_contains"]).issubset(
                set(frame.ambiguous_fields)
            ), case["case_id"]
        if "expected_amount_filled" in case:
            assert ("amount" in frame.explicit_values) is case[
                "expected_amount_filled"
            ], case["case_id"]
