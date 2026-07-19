"""MAI-20 slice 2 — surface clarification plan in mode_aware."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.integration.mode_aware_erp import handle_mode_aware_erp
from src.oip.modules.conversation.application.clarification_plan_service import (
    RUNTIME_VERSION,
    attach_clarification_plan_to_request,
    clarification_plan_to_metadata,
    should_surface_clarification_plan,
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


@pytest.fixture(autouse=True)
def _isolate_draft_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import src.khata.purchase_draft as pd

    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    pd._MEMORY.clear()
    yield
    pd._MEMORY.clear()


def _plan_meta(text: str) -> dict:
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
    return clarification_plan_to_metadata(req.clarification_plan_bundle)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-20.0.2-slice2"


def test_none_plan_keeps_legacy() -> None:
    assert should_surface_clarification_plan(None) is False


def test_incomplete_purchase_surfaces_ask() -> None:
    meta = _plan_meta("bought 50 kg rice from Ram")
    assert should_surface_clarification_plan(meta) is True
    result = handle_mode_aware_erp(
        "bought 50 kg rice from Ram",
        orbix_mode="ask",
        session_id="s1",
        tenant_id="t1",
        company_id="co-1",
        clarification_plan=meta,
    )
    assert result is not None
    assert result.skip_llm is True
    assert result.method == "mai20_clarification_plan_gate"
    assert result.intent == "event_frame_clarification"
    assert result.draft_id is None
    assert result.error and result.error.get("code") == "CLARIFICATION_PLAN_ASK"
    assert result.error.get("nothing_posted") is True
    assert result.error.get("type") == "clarification_required"
    assert result.text
    assert meta.get("primary_field") in {
        "quantity_candidate",
        "amount",
    }


def test_complete_purchase_does_not_surface() -> None:
    meta = _plan_meta("Ram bata 500 ko saman kine")
    assert should_surface_clarification_plan(meta) is False
    result = handle_mode_aware_erp(
        "Ram bata 500 ko saman kine",
        orbix_mode="ask",
        session_id="s1",
        tenant_id="t1",
        company_id="co-1",
        clarification_plan=meta,
    )
    assert result is not None
    assert result.method != "mai20_clarification_plan_gate"


def test_ood_skip_does_not_surface() -> None:
    meta = _plan_meta("asdf qwer zxcv")
    assert should_surface_clarification_plan(meta) is False


def test_pending_clarify_not_blocked() -> None:
    meta = _plan_meta("bought 50 kg rice from Ram")
    assert should_surface_clarification_plan(meta) is True
    assert (
        should_surface_clarification_plan(
            meta,
            has_pending_clarify=True,
            turn_relation={"relation": "ANSWER_CLARIFICATION", "status": "READY"},
        )
        is False
    )


def test_frozen_eval_fixtures() -> None:
    import json

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai20"
        / "frozen"
        / "clarification_plan_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        meta = _plan_meta(case["text"])
        surface = should_surface_clarification_plan(meta)
        if "expected_surface" in case:
            assert surface is case["expected_surface"], case["case_id"]
        if case.get("expected_surface_one_of") is not None:
            assert surface in case["expected_surface_one_of"], case["case_id"]
        if case.get("expected_primary"):
            assert meta.get("primary_field") == case["expected_primary"], case[
                "case_id"
            ]
        if surface and case.get("expected_method"):
            result = handle_mode_aware_erp(
                case["text"],
                orbix_mode="ask",
                session_id="s1",
                tenant_id="t1",
                company_id="co-1",
                clarification_plan=meta,
            )
            assert result is not None
            assert result.method == case["expected_method"], case["case_id"]
            if case.get("expected_nothing_posted"):
                assert result.draft_id is None
                assert result.error and result.error.get("nothing_posted") is True


def test_missing_amount_only_surfaces() -> None:
    meta = _plan_meta("bought rice from Ram")
    assert should_surface_clarification_plan(meta) is True
    assert meta.get("primary_field") == "amount"
    result = handle_mode_aware_erp(
        "bought rice from Ram",
        orbix_mode="ask",
        session_id="s1",
        tenant_id="t1",
        company_id="co-1",
        clarification_plan=meta,
    )
    assert result is not None
    assert result.method == "mai20_clarification_plan_gate"
    assert "amount" in (result.text or "").lower() or "रकम" in (result.text or "")
