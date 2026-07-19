"""MAI-47 slice 2 — human review / pilot ops candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.human_review_pilot_operations_consume_service import (
    RUNTIME_VERSION,
    assert_human_review_pilot_operations_consume_authority,
    build_human_review_pilot_operations_candidate,
    human_review_pilot_operations_consume_observability,
    resolve_human_review_pilot_operations_consume_mode,
)
from src.oip.modules.conversation.application.human_review_pilot_operations_service import (
    assert_human_review_pilot_operations_authority,
    attach_human_review_pilot_operations_to_request,
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
    return attach_human_review_pilot_operations_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-47.0.2-slice2"


def test_review_candidate_only() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    bundle = req.human_review_pilot_operations_bundle
    assert_human_review_pilot_operations_authority(bundle)
    mode = resolve_human_review_pilot_operations_consume_mode(
        bundle, allow_reviewer_signoff=False, allow_go_live=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_human_review_pilot_operations_candidate(bundle)
    assert (
        built["human_review_pilot_operations_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["human_review_pilot_operations_consume_ready"] is True
    cand = built["human_review_pilot_operations_candidate"]
    assert cand is not None
    assert "HUMAN_REVIEW" in cand["in_scope_topics"]
    assert cand["review_packet"] is None
    assert cand["pilot_ops_plan"] is None
    assert cand["gold_suite_packet"] is None
    assert cand["signoff_packet"] is None
    assert cand["ops_runbook"] is None
    assert cand["acceptance_packet"] is None
    assert cand["go_live_packet"] is None
    assert cand["definitive_answer"] is None
    assert cand["human_review_complete"] is False
    assert cand["go_live_authorized"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = human_review_pilot_operations_consume_observability(req)
    assert_human_review_pilot_operations_consume_authority(obs)
    assert obs["allow_reviewer_signoff"] is False
    assert obs["allow_go_live"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "human_review_pilot_operations_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["HUMAN_REVIEW"],
        "pilot_scope": "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "human_review_complete": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_human_review_pilot_operations_consume_mode(meta) == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_human_review_pilot_operations_consume_mode(
            req.human_review_pilot_operations_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    assert (
        resolve_human_review_pilot_operations_consume_mode(
            req.human_review_pilot_operations_bundle,
            allow_reviewer_signoff=True,
        )
        == "INVOKE_REVIEWER_SIGNOFF"
    )
    assert (
        resolve_human_review_pilot_operations_consume_mode(
            req.human_review_pilot_operations_bundle,
            allow_go_live=True,
        )
        == "INVOKE_GO_LIVE"
    )
    obs = human_review_pilot_operations_consume_observability(
        req, allow_reviewer_signoff=False, allow_go_live=False
    )
    assert (
        obs["human_review_pilot_operations_consume_mode"] == "CANDIDATE_ONLY"
    )
    assert obs["allow_reviewer_signoff"] is False
    assert obs["human_review_complete"] is False
    assert obs["go_live_authorized"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("human_review_pilot_operations") or {}
    assert (
        meta.get("human_review_pilot_operations_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("human_review_pilot_operations_consume_ready") is True
    )
    assert meta.get("human_review_complete") is False
    assert meta.get("go_live_authorized") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_reviewer_signoff") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("human_review_pilot_operations_candidate") or {}
    assert cand.get("review_packet") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai47"
        / "frozen"
        / "human_review_pilot_operations_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_human_review_pilot_operations_consume_mode(
                case["synthetic_meta"],
                allow_reviewer_signoff=bool(
                    case.get("allow_reviewer_signoff", False)
                ),
                allow_go_live=bool(case.get("allow_go_live", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_human_review_pilot_operations_consume_mode(
                req.human_review_pilot_operations_bundle,
                allow_reviewer_signoff=bool(
                    case.get("allow_reviewer_signoff", False)
                ),
                allow_go_live=bool(case.get("allow_go_live", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
