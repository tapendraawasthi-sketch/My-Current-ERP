"""MAI-45 slice 1 — load/latency/failover (never claims SLOs met)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.load_latency_failover import (
    LoadLatencyFailoverReadiness,
    LoadLatencyFailoverStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.load_latency_failover_service import (
    RUNTIME_VERSION,
    assert_load_latency_failover_authority,
    attach_load_latency_failover_to_request,
    build_load_latency_failover_bundle,
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
    return attach_load_latency_failover_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-45.")


def test_load_latency_policy_declared() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    bundle = req.load_latency_failover_bundle
    assert bundle is not None
    assert bundle.analysis_status == LoadLatencyFailoverStatus.COMPLETE
    assert (
        bundle.load_latency_failover_readiness
        == LoadLatencyFailoverReadiness.POLICY_DECLARED
    )
    assert "LOAD_TEST" in bundle.in_scope_topics
    assert "LATENCY_SLO" in bundle.in_scope_topics
    assert "CAPACITY_PLAN" in bundle.in_scope_topics
    assert bundle.pilot_scope == "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY"
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.pilot_slos_met is False
    assert bundle.safety_bypass_under_timeout is False
    assert bundle.capacity_proven is False
    assert bundle.load_test_passed is False
    assert bundle.failover_proven is False
    assert bundle.production_perf_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "NO_SAFETY_BYPASS_UNDER_TIMEOUT" in bundle.reason_codes
    assert_load_latency_failover_authority(bundle)


def test_failover_and_cascade() -> None:
    req = _pipeline(
        "failover and cascade tuning under timeout with resource budget"
    )
    bundle = req.load_latency_failover_bundle
    assert bundle is not None
    assert bundle.analysis_status == LoadLatencyFailoverStatus.COMPLETE
    assert "FAILOVER" in bundle.in_scope_topics
    assert "CASCADE_TUNING" in bundle.in_scope_topics
    assert "RESOURCE_BUDGET" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.load_latency_failover_bundle
    assert bundle is not None
    assert bundle.analysis_status == LoadLatencyFailoverStatus.SKIP


def test_security_without_perf_skips() -> None:
    req = _pipeline(
        "red-team cross-tenant isolation and authorization bypass probe"
    )
    bundle = req.load_latency_failover_bundle
    assert bundle is not None
    assert bundle.analysis_status == LoadLatencyFailoverStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("load_latency_failover") or {}
    assert meta.get("pilot_slos_met") is False
    assert meta.get("safety_bypass_under_timeout") is False
    assert meta.get("capacity_proven") is False
    assert meta.get("production_perf_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="soak test and capacity plan for Nepal deployment conditions",
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
    bundle = build_load_latency_failover_bundle(req)
    assert bundle.analysis_status == LoadLatencyFailoverStatus.COMPLETE
    assert "SOAK_TEST" in bundle.in_scope_topics
    assert "CAPACITY_PLAN" in bundle.in_scope_topics


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai45"
        / "frozen"
        / "load_latency_failover_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.load_latency_failover_bundle
        assert bundle is not None
        assert bundle.pilot_slos_met is False
        assert bundle.safety_bypass_under_timeout is False
        assert bundle.capacity_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.load_latency_failover_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
