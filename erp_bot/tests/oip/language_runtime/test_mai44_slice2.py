"""MAI-44 slice 2 — security red-team candidate consume (never pen-test pass)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.security_tenant_red_team_consume_service import (
    RUNTIME_VERSION,
    assert_security_red_team_consume_authority,
    build_security_red_team_candidate,
    resolve_security_red_team_consume_mode,
    security_red_team_consume_observability,
)
from src.oip.modules.conversation.application.security_tenant_red_team_service import (
    assert_security_tenant_red_team_authority,
    attach_security_tenant_red_team_to_request,
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
    return attach_security_tenant_red_team_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-44.0.2-slice2"


def test_security_candidate_only() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    bundle = req.security_tenant_red_team_bundle
    assert_security_tenant_red_team_authority(bundle)
    mode = resolve_security_red_team_consume_mode(
        bundle, allow_pen_review=False, allow_zero_critical_claim=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_security_red_team_candidate(bundle)
    assert built["security_red_team_consume_mode"] == "CANDIDATE_ONLY"
    assert built["security_red_team_consume_ready"] is True
    cand = built["security_red_team_candidate"]
    assert cand is not None
    assert "TENANT_ISOLATION" in cand["in_scope_topics"]
    assert cand["threat_model_refs"] is None
    assert cand["adversarial_suite_refs"] is None
    assert cand["finding_register"] is None
    assert cand["remediation_register"] is None
    assert cand["pen_review_package"] is None
    assert cand["definitive_answer"] is None
    assert cand["pen_review_passed"] is False
    assert cand["zero_critical_findings_claimed"] is False
    assert cand["gap_p0_001_status"] == "OPEN"
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = security_red_team_consume_observability(req)
    assert_security_red_team_consume_authority(obs)
    assert obs["allow_pen_review"] is False
    assert obs["allow_zero_critical_claim"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "security_red_team_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["TENANT_ISOLATION"],
        "pilot_scope": "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p0_001_status": "OPEN",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "pen_review_passed": True,
        "is_execution_authority": False,
    }
    assert resolve_security_red_team_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_security_red_team_consume_mode(
            req.security_tenant_red_team_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    assert (
        resolve_security_red_team_consume_mode(
            req.security_tenant_red_team_bundle,
            allow_pen_review=True,
        )
        == "INVOKE_PEN_REVIEW"
    )
    assert (
        resolve_security_red_team_consume_mode(
            req.security_tenant_red_team_bundle,
            allow_zero_critical_claim=True,
        )
        == "INVOKE_ZERO_CRITICAL_CLAIM"
    )
    obs = security_red_team_consume_observability(
        req, allow_pen_review=False, allow_zero_critical_claim=False
    )
    assert obs["security_red_team_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_pen_review"] is False
    assert obs["pen_review_passed"] is False
    assert obs["zero_critical_findings_claimed"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("security_tenant_red_team") or {}
    assert meta.get("security_red_team_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("security_red_team_consume_ready") is True
    assert meta.get("pen_review_passed") is False
    assert meta.get("zero_critical_findings_claimed") is False
    assert meta.get("gap_p0_001_status") == "OPEN"
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_pen_review") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("security_red_team_candidate") or {}
    assert cand.get("threat_model_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai44"
        / "frozen"
        / "security_red_team_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_security_red_team_consume_mode(
                case["synthetic_meta"],
                allow_pen_review=bool(case.get("allow_pen_review", False)),
                allow_zero_critical_claim=bool(
                    case.get("allow_zero_critical_claim", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_security_red_team_consume_mode(
                req.security_tenant_red_team_bundle,
                allow_pen_review=bool(case.get("allow_pen_review", False)),
                allow_zero_critical_claim=bool(
                    case.get("allow_zero_critical_claim", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
