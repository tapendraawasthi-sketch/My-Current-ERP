"""MAI-17 slice 2 — OOD abstain / family gate into mode_aware."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.oip.integration.mode_aware_erp import handle_mode_aware_erp
from src.oip.modules.conversation.application.hierarchical_router_service import (
    RUNTIME_VERSION,
    build_router_decision_bundle,
    router_decision_to_metadata,
    should_abstain_router_decision,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from datetime import datetime, timezone


@pytest.fixture(autouse=True)
def _isolate_draft_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import src.khata.purchase_draft as pd

    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    pd._MEMORY.clear()
    yield
    pd._MEMORY.clear()


def _meta_for(text: str) -> dict:
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
    return router_decision_to_metadata(build_router_decision_bundle(req))


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-17.0.2-slice2"


def test_none_router_keeps_legacy() -> None:
    assert should_abstain_router_decision(None) is False


def test_gibberish_abstains() -> None:
    meta = _meta_for("asdf qwer zxcv")
    assert should_abstain_router_decision(meta) is True
    result = handle_mode_aware_erp(
        "asdf qwer zxcv",
        orbix_mode="ask",
        session_id="s1",
        tenant_id="t1",
        company_id="co-1",
        router_decision=meta,
    )
    assert result is not None
    assert result.skip_llm is True
    assert result.method == "mai17_router_ood_gate"
    assert result.intent == "router_ood_abstain"
    assert result.error and result.error.get("code") == "ROUTER_OOD_ABSTAIN"
    assert result.draft_id is None


def test_purchase_does_not_abstain() -> None:
    meta = _meta_for("Ram bata 500 ko saman kine")
    assert should_abstain_router_decision(meta) is False
    result = handle_mode_aware_erp(
        "Ram bata 500 ko saman kine",
        orbix_mode="ask",
        session_id="s1",
        tenant_id="t1",
        company_id="co-1",
        router_decision=meta,
    )
    assert result is not None
    assert result.method != "mai17_router_ood_gate"
    assert result.intent != "router_ood_abstain"


def test_pending_clarify_not_blocked() -> None:
    meta = _meta_for("asdf qwer zxcv")
    # Force abstain metadata but pending clarify + allow-merge relation.
    assert should_abstain_router_decision(
        meta,
        has_pending_clarify=True,
        turn_relation={"relation": "ANSWER_CLARIFICATION", "status": "READY"},
    ) is False


def test_soft_ood_blocks_mutating_only() -> None:
    meta = {
        "domain": "UNKNOWN",
        "intent_family": "TRANSACTION",
        "operation_class": "transaction_create",
        "ood": {
            "score": 0.72,
            "is_ood": True,
            "abstain_recommended": False,
            "reason_codes": ["DOMAIN_UNKNOWN"],
        },
    }
    assert (
        should_abstain_router_decision(
            meta, operation_class="transaction_create"
        )
        is True
    )
    assert (
        should_abstain_router_decision(
            meta, operation_class="general_question"
        )
        is False
    )


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path as P

    path = (
        P(__file__).resolve().parents[4]
        / "evals"
        / "mai17"
        / "frozen"
        / "router_ood_gate_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        meta = _meta_for(case["text"]) if case.get("build_from_text") else case.get(
            "router_decision"
        )
        allowed = not should_abstain_router_decision(
            meta,
            has_pending_clarify=bool(case.get("has_pending_clarify")),
            turn_relation=case.get("turn_relation"),
            operation_class=case.get("operation_class"),
        )
        # expected_abstain True means gate fires (not allowed through).
        assert (not allowed) is case["expected_abstain"], case["case_id"]
