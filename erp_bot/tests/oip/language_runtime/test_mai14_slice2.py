"""MAI-14 slice 2 — turn-relation pending-draft merge gate."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.khata.purchase_draft import (
    load_pending_draft,
    save_draft,
    start_or_merge_purchase,
)
from src.oip.integration.mode_aware_erp import handle_mode_aware_erp
from src.oip.modules.conversation.application.turn_relation_service import (
    RUNTIME_VERSION,
    allows_pending_merge,
)


@pytest.fixture(autouse=True)
def _isolate_purchase_draft_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Avoid polluting global khata draft MEMORY across tests."""
    import src.khata.purchase_draft as pd

    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    pd._MEMORY.clear()
    yield
    pd._MEMORY.clear()


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-14.0.2-slice2"


def test_allows_pending_merge_matrix() -> None:
    assert allows_pending_merge(None) is True
    assert allows_pending_merge({"relation": "ANSWER_CLARIFICATION", "status": "READY"})
    assert allows_pending_merge({"relation": "CONTINUE_ACTIVE_DRAFT", "status": "READY"})
    assert allows_pending_merge({"relation": "CORRECT_ACTIVE_DRAFT", "status": "READY"})
    assert allows_pending_merge({"relation": "CONTINUE_EXPLICIT_DRAFT"}) is True
    assert allows_pending_merge({"relation": "NEW_TOPIC", "status": "READY"}) is False
    assert allows_pending_merge({"relation": "UNKNOWN", "status": "PARTIAL"}) is False
    assert allows_pending_merge({"relation": "CONFIRMATION_INTENT"}) is False
    assert allows_pending_merge({"relation": "CANCEL_ACTIVE_DRAFT"}) is False
    assert allows_pending_merge({"relation": "UNKNOWN", "status": "FAILED"}) is False


def _seed_pending(*, session: str):
    draft = start_or_merge_purchase(
        "I bought 50 kg goods.",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
    )
    save_draft(draft)
    return draft


def test_new_topic_blocks_clarification_merge() -> None:
    session = "mai14-gate-new"
    d1 = _seed_pending(session=session)
    assert d1.status == "awaiting_clarification"

    # Short clarify token — would merge if gate failed; must not with NEW_TOPIC.
    handle_mode_aware_erp(
        "cash",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={
            "relation": "NEW_TOPIC",
            "status": "READY",
            "classifier_version": RUNTIME_VERSION,
        },
    )
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.draft_id == d1.draft_id
    assert pending.status == "awaiting_clarification"
    assert pending.payment_method is None


def test_answer_clarification_allows_merge() -> None:
    session = "mai14-gate-clarify"
    d1 = _seed_pending(session=session)
    result = handle_mode_aware_erp(
        "Rice at Rs 80 per kg, paid in cash.",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={
            "relation": "ANSWER_CLARIFICATION",
            "status": "READY",
            "classifier_version": RUNTIME_VERSION,
        },
    )
    assert result is not None
    assert result.draft_id == d1.draft_id
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.item.name and "Rice" in pending.item.name
    assert pending.payment_method == "cash"


def test_confirmation_intent_blocks_merge() -> None:
    session = "mai14-gate-confirm"
    d1 = _seed_pending(session=session)
    handle_mode_aware_erp(
        "yes",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={
            "relation": "CONFIRMATION_INTENT",
            "status": "READY",
            "classifier_version": RUNTIME_VERSION,
            "is_execution_authority": False,
        },
    )
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.status == "awaiting_clarification"


def test_unknown_fail_closed() -> None:
    session = "mai14-gate-unknown"
    d1 = _seed_pending(session=session)
    handle_mode_aware_erp(
        "um",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation={"relation": "UNKNOWN", "status": "PARTIAL"},
    )
    pending = load_pending_draft(
        session_id=session, tenant_id="t1", company_id="c1", draft_id=d1.draft_id
    )
    assert pending is not None
    assert pending.status == "awaiting_clarification"
    assert pending.payment_method is None


def test_legacy_none_still_merges() -> None:
    session = "mai14-gate-legacy"
    d1 = _seed_pending(session=session)
    result = handle_mode_aware_erp(
        "Rice at Rs 80 per kg, paid in cash.",
        orbix_mode="accountant",
        session_id=session,
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="accountant",
        turn_relation=None,
    )
    assert result is not None
    assert result.draft_id == d1.draft_id


def test_frozen_eval_gate_expectations() -> None:
    import json
    from pathlib import Path as P

    path = (
        P(__file__).resolve().parents[4]
        / "evals"
        / "mai14"
        / "frozen"
        / "turn_relation_merge_gate_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        allowed = allows_pending_merge(
            {
                "relation": case["relation"],
                "status": case.get("status", "READY"),
            }
        )
        assert allowed is case["allows_pending_merge"], case["case_id"]
