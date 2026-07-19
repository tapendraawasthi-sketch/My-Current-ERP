"""MAI-45 slice 2 — load/latency/failover candidate consume (never SLOs met)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.load_latency_failover_consume_service import (
    RUNTIME_VERSION,
    assert_load_latency_failover_consume_authority,
    build_load_latency_failover_candidate,
    load_latency_failover_consume_observability,
    resolve_load_latency_failover_consume_mode,
)
from src.oip.modules.conversation.application.load_latency_failover_service import (
    assert_load_latency_failover_authority,
    attach_load_latency_failover_to_request,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-45.0.2-slice2"


def test_perf_candidate_only() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    bundle = req.load_latency_failover_bundle
    assert_load_latency_failover_authority(bundle)
    mode = resolve_load_latency_failover_consume_mode(
        bundle, allow_load_test=False, allow_slo_claim=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_load_latency_failover_candidate(bundle)
    assert built["load_latency_failover_consume_mode"] == "CANDIDATE_ONLY"
    assert built["load_latency_failover_consume_ready"] is True
    cand = built["load_latency_failover_candidate"]
    assert cand is not None
    assert "LOAD_TEST" in cand["in_scope_topics"]
    assert cand["stage_profiles"] is None
    assert cand["cascade_tuning"] is None
    assert cand["index_benchmarks"] is None
    assert cand["load_soak_plan"] is None
    assert cand["capacity_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["pilot_slos_met"] is False
    assert cand["safety_bypass_under_timeout"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = load_latency_failover_consume_observability(req)
    assert_load_latency_failover_consume_authority(obs)
    assert obs["allow_load_test"] is False
    assert obs["allow_slo_claim"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "load_latency_failover_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["LOAD_TEST"],
        "pilot_scope": "LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "pilot_slos_met": True,
        "is_execution_authority": False,
    }
    assert resolve_load_latency_failover_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_load_latency_failover_consume_mode(
            req.load_latency_failover_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    assert (
        resolve_load_latency_failover_consume_mode(
            req.load_latency_failover_bundle,
            allow_load_test=True,
        )
        == "INVOKE_LOAD_TEST"
    )
    assert (
        resolve_load_latency_failover_consume_mode(
            req.load_latency_failover_bundle,
            allow_slo_claim=True,
        )
        == "INVOKE_SLO_CLAIM"
    )
    obs = load_latency_failover_consume_observability(
        req, allow_load_test=False, allow_slo_claim=False
    )
    assert obs["load_latency_failover_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_load_test"] is False
    assert obs["pilot_slos_met"] is False
    assert obs["safety_bypass_under_timeout"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("load_latency_failover") or {}
    assert meta.get("load_latency_failover_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("load_latency_failover_consume_ready") is True
    assert meta.get("pilot_slos_met") is False
    assert meta.get("safety_bypass_under_timeout") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_load_test") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("load_latency_failover_candidate") or {}
    assert cand.get("stage_profiles") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai45"
        / "frozen"
        / "load_latency_failover_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_load_latency_failover_consume_mode(
                case["synthetic_meta"],
                allow_load_test=bool(case.get("allow_load_test", False)),
                allow_slo_claim=bool(case.get("allow_slo_claim", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_load_latency_failover_consume_mode(
                req.load_latency_failover_bundle,
                allow_load_test=bool(case.get("allow_load_test", False)),
                allow_slo_claim=bool(case.get("allow_slo_claim", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
