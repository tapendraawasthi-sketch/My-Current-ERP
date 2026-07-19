"""MAI-49 slice 2 — production capability release candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.production_capability_release_consume_service import (
    RUNTIME_VERSION,
    assert_production_capability_release_consume_authority,
    build_production_capability_release_candidate,
    production_capability_release_consume_observability,
    resolve_production_capability_release_consume_mode,
)
from src.oip.modules.conversation.application.production_capability_release_service import (
    assert_production_capability_release_authority,
    attach_production_capability_release_to_request,
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
    return attach_production_capability_release_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-49.0.2-slice2"


def test_release_candidate_only() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    bundle = req.production_capability_release_bundle
    assert_production_capability_release_authority(bundle)
    mode = resolve_production_capability_release_consume_mode(
        bundle, allow_cutover=False, allow_traffic=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_production_capability_release_candidate(bundle)
    assert (
        built["production_capability_release_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["production_capability_release_consume_ready"] is True
    cand = built["production_capability_release_candidate"]
    assert cand is not None
    assert "PRODUCTION_RELEASE" in cand["in_scope_topics"]
    assert cand["capability_checklist"] is None
    assert cand["residual_risk_register"] is None
    assert cand["owner_signoff_record"] is None
    assert cand["cutover_plan"] is None
    assert cand["rollback_plan"] is None
    assert cand["release_gate_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["production_approved"] is False
    assert cand["cutover_authorized"] is False
    assert cand["production_traffic_enabled"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = production_capability_release_consume_observability(req)
    assert_production_capability_release_consume_authority(obs)
    assert obs["allow_cutover"] is False
    assert obs["allow_traffic"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "production_capability_release_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["CUTOVER_PLAN"],
        "pilot_scope": "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "cutover_authorized": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_production_capability_release_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_production_capability_release_consume_mode(
            req.production_capability_release_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    assert (
        resolve_production_capability_release_consume_mode(
            req.production_capability_release_bundle,
            allow_cutover=True,
        )
        == "INVOKE_CUTOVER"
    )
    assert (
        resolve_production_capability_release_consume_mode(
            req.production_capability_release_bundle,
            allow_traffic=True,
        )
        == "INVOKE_TRAFFIC"
    )
    obs = production_capability_release_consume_observability(
        req, allow_cutover=False, allow_traffic=False
    )
    assert (
        obs["production_capability_release_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_cutover"] is False
    assert obs["cutover_authorized"] is False
    assert obs["production_traffic_enabled"] is False
    assert obs["production_approved"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("production_capability_release") or {}
    assert (
        meta.get("production_capability_release_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("production_capability_release_consume_ready") is True
    )
    assert meta.get("production_approved") is False
    assert meta.get("cutover_authorized") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_cutover") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("production_capability_release_candidate") or {}
    assert cand.get("cutover_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai49"
        / "frozen"
        / "production_capability_release_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_production_capability_release_consume_mode(
                case["synthetic_meta"],
                allow_cutover=bool(case.get("allow_cutover", False)),
                allow_traffic=bool(case.get("allow_traffic", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_production_capability_release_consume_mode(
                req.production_capability_release_bundle,
                allow_cutover=bool(case.get("allow_cutover", False)),
                allow_traffic=bool(case.get("allow_traffic", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
