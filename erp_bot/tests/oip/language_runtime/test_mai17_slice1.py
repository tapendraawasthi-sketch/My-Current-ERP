"""MAI-17 slice 1 — hierarchical router + OOD annotation."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.dialogue import ContractStatus, TurnRelationKind, TurnRelationV1
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.router_decision import (
    IntentFamily,
    RouterAnalysisStatus,
    RouterDomain,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    RUNTIME_VERSION,
    attach_router_decision_to_request,
    build_router_decision_bundle,
)


def _request(
    text: str,
    *,
    turn_relation: TurnRelationKind | None = None,
) -> CanonicalAIRequestV1:
    tr = None
    if turn_relation is not None:
        tr = TurnRelationV1(
            relation=turn_relation,
            classifier_version="mai-14.0.2-slice2",
            status=ContractStatus.READY,
        )
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
        turn_relation=tr,
    )


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-17.")


def test_purchase_routes_erp_ops_transaction() -> None:
    bundle = build_router_decision_bundle(
        _request("Ram bata 500 ko saman kine")
    )
    assert bundle.analysis_status == RouterAnalysisStatus.COMPLETE
    assert bundle.domain == RouterDomain.ERP_OPS
    assert bundle.intent_family == IntentFamily.TRANSACTION
    assert bundle.is_execution_authority is False
    assert bundle.silent_applications == 0
    assert bundle.draft_mutations == 0
    assert bundle.ood.is_ood is False


def test_report_routes_reporting() -> None:
    bundle = build_router_decision_bundle(_request("show balance sheet"))
    assert bundle.domain == RouterDomain.REPORTING
    assert bundle.intent_family == IntentFamily.REPORT


def test_accounting_qa_domain() -> None:
    bundle = build_router_decision_bundle(
        _request("what is depreciation in journal ledger")
    )
    assert bundle.domain == RouterDomain.ACCOUNTING
    assert bundle.intent_family == IntentFamily.QA


def test_weak_gibberish_ood() -> None:
    bundle = build_router_decision_bundle(_request("asdf qwer zxcv"))
    assert bundle.ood.score >= 0.7
    assert bundle.ood.is_ood is True


def test_clarification_turn_grounds_ood() -> None:
    bundle = build_router_decision_bundle(
        _request(
            "cash",
            turn_relation=TurnRelationKind.ANSWER_CLARIFICATION,
        )
    )
    assert bundle.intent_family == IntentFamily.CLARIFY
    assert bundle.ood.score < 0.7


def test_attach_preserves_raw_text() -> None:
    req = _request("aaja ko bikri kati")
    updated = attach_router_decision_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.router_decision_bundle is not None
    assert updated.router_decision_bundle.runtime_version == RUNTIME_VERSION


def test_adapter_metadata() -> None:
    from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter

    req = attach_router_decision_to_request(_request("show trial balance"))
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    rd = (dto.metadata or {}).get("router_decision")
    assert isinstance(rd, dict)
    assert rd.get("runtime_version") == RUNTIME_VERSION
    assert rd.get("domain") == "REPORTING"
    assert rd.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai17"
        / "frozen"
        / "hierarchical_router_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        tr = None
        if case.get("turn_relation"):
            tr = TurnRelationKind(case["turn_relation"])
        bundle = build_router_decision_bundle(
            _request(case["text"], turn_relation=tr)
        )
        assert bundle.silent_applications == 0
        assert bundle.draft_mutations == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_domain"):
            assert bundle.domain.value == case["expected_domain"], case["case_id"]
        if case.get("expected_family"):
            assert bundle.intent_family.value == case["expected_family"], case[
                "case_id"
            ]
        if "expected_is_ood" in case:
            assert bundle.ood.is_ood is case["expected_is_ood"], case["case_id"]
