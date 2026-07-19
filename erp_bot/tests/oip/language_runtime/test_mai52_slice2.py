"""MAI-52 slice 2 — CA-firm engagement / workpaper candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.ca_firm_engagement_workpaper_consume_service import (
    RUNTIME_VERSION,
    assert_ca_firm_engagement_workpaper_consume_authority,
    build_ca_firm_engagement_workpaper_candidate,
    ca_firm_engagement_workpaper_consume_observability,
    resolve_ca_firm_engagement_workpaper_consume_mode,
)
from src.oip.modules.conversation.application.ca_firm_engagement_workpaper_service import (
    assert_ca_firm_engagement_workpaper_authority,
    attach_ca_firm_engagement_workpaper_to_request,
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
    return attach_ca_firm_engagement_workpaper_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-52.0.2-slice2"


def test_engagement_candidate_only() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    bundle = req.ca_firm_engagement_workpaper_bundle
    assert_ca_firm_engagement_workpaper_authority(bundle)
    mode = resolve_ca_firm_engagement_workpaper_consume_mode(
        bundle, allow_open_engagement=False, allow_post_workpaper=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_ca_firm_engagement_workpaper_candidate(bundle)
    assert (
        built["ca_firm_engagement_workpaper_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["ca_firm_engagement_workpaper_consume_ready"] is True
    cand = built["ca_firm_engagement_workpaper_candidate"]
    assert cand is not None
    assert "CA_FIRM_ENGAGEMENT" in cand["in_scope_topics"]
    assert cand["engagement_plan"] is None
    assert cand["engagement_letter_plan"] is None
    assert cand["workpaper_workspace_plan"] is None
    assert cand["workpaper_review_plan"] is None
    assert cand["client_binder_plan"] is None
    assert cand["staff_assignment_plan"] is None
    assert cand["review_notes_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["engagement_opened"] is False
    assert cand["workpaper_posted"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = ca_firm_engagement_workpaper_consume_observability(req)
    assert_ca_firm_engagement_workpaper_consume_authority(obs)
    assert obs["allow_open_engagement"] is False
    assert obs["allow_post_workpaper"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "ca_firm_engagement_workpaper_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["WORKPAPER_WORKSPACE"],
        "pilot_scope": "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "engagement_opened": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_ca_firm_engagement_workpaper_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_ca_firm_engagement_workpaper_consume_mode(
            req.ca_firm_engagement_workpaper_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    assert (
        resolve_ca_firm_engagement_workpaper_consume_mode(
            req.ca_firm_engagement_workpaper_bundle,
            allow_open_engagement=True,
        )
        == "INVOKE_OPEN_ENGAGEMENT"
    )
    assert (
        resolve_ca_firm_engagement_workpaper_consume_mode(
            req.ca_firm_engagement_workpaper_bundle,
            allow_post_workpaper=True,
        )
        == "INVOKE_POST_WORKPAPER"
    )
    obs = ca_firm_engagement_workpaper_consume_observability(
        req, allow_open_engagement=False, allow_post_workpaper=False
    )
    assert (
        obs["ca_firm_engagement_workpaper_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_open_engagement"] is False
    assert obs["engagement_opened"] is False
    assert obs["workpaper_posted"] is False
    assert obs["ca_firm_workspace_enabled"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("ca_firm_engagement_workpaper") or {}
    assert (
        meta.get("ca_firm_engagement_workpaper_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert meta.get("ca_firm_engagement_workpaper_consume_ready") is True
    assert meta.get("engagement_opened") is False
    assert meta.get("workpaper_posted") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_open_engagement") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("ca_firm_engagement_workpaper_candidate") or {}
    assert cand.get("engagement_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai52"
        / "frozen"
        / "ca_firm_engagement_workpaper_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_ca_firm_engagement_workpaper_consume_mode(
                case["synthetic_meta"],
                allow_open_engagement=bool(
                    case.get("allow_open_engagement", False)
                ),
                allow_post_workpaper=bool(
                    case.get("allow_post_workpaper", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_ca_firm_engagement_workpaper_consume_mode(
                req.ca_firm_engagement_workpaper_bundle,
                allow_open_engagement=bool(
                    case.get("allow_open_engagement", False)
                ),
                allow_post_workpaper=bool(
                    case.get("allow_post_workpaper", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
