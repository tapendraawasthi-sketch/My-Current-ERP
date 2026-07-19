"""MAI-44 slice 1 — security/tenant red team (never pen-test pass)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.security_tenant_red_team import (
    SecurityRedTeamReadiness,
    SecurityTenantRedTeamStatus,
)
from src.oip.modules.conversation.application.security_tenant_red_team_service import (
    RUNTIME_VERSION,
    assert_security_tenant_red_team_authority,
    attach_security_tenant_red_team_to_request,
    build_security_tenant_red_team_bundle,
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


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-44.")


def test_tenant_isolation_policy_declared() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    bundle = req.security_tenant_red_team_bundle
    assert bundle is not None
    assert bundle.analysis_status == SecurityTenantRedTeamStatus.COMPLETE
    assert (
        bundle.security_red_team_readiness
        == SecurityRedTeamReadiness.POLICY_DECLARED
    )
    assert "TENANT_ISOLATION" in bundle.in_scope_topics
    assert "AUTHORIZATION" in bundle.in_scope_topics
    assert bundle.pilot_scope == "SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY"
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.isolation_proven is False
    assert bundle.zero_critical_findings_claimed is False
    assert bundle.pen_review_passed is False
    assert bundle.production_security_approved is False
    assert bundle.gap_p0_001_status == "OPEN"
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert_security_tenant_red_team_authority(bundle)


def test_prompt_and_confirmation() -> None:
    req = _pipeline(
        "prompt injection and confirmation attack with assent without token"
    )
    bundle = req.security_tenant_red_team_bundle
    assert bundle is not None
    assert bundle.analysis_status == SecurityTenantRedTeamStatus.COMPLETE
    assert "PROMPT_INJECTION" in bundle.in_scope_topics
    assert "CONFIRMATION_ATTACK" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.security_tenant_red_team_bundle
    assert bundle is not None
    assert bundle.analysis_status == SecurityTenantRedTeamStatus.SKIP


def test_vat_skips() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.security_tenant_red_team_bundle
    assert bundle is not None
    assert bundle.analysis_status == SecurityTenantRedTeamStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("security_tenant_red_team") or {}
    assert meta.get("isolation_proven") is False
    assert meta.get("zero_critical_findings_claimed") is False
    assert meta.get("pen_review_passed") is False
    assert meta.get("production_security_approved") is False
    assert meta.get("gap_p0_001_status") == "OPEN"
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="secret leakage and tool capability broadening probe",
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
    bundle = build_security_tenant_red_team_bundle(req)
    assert bundle.analysis_status == SecurityTenantRedTeamStatus.COMPLETE
    assert "SECRET_LEAKAGE" in bundle.in_scope_topics
    assert "TOOL_INJECTION" in bundle.in_scope_topics


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai44"
        / "frozen"
        / "security_tenant_red_team_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.security_tenant_red_team_bundle
        assert bundle is not None
        assert bundle.isolation_proven is False
        assert bundle.zero_critical_findings_claimed is False
        assert bundle.pen_review_passed is False
        assert bundle.gap_p0_001_status == "OPEN"
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.security_red_team_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
