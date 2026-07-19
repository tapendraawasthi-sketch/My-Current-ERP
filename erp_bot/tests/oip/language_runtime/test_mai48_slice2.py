"""MAI-48 slice 2 — governed improvement / fine-tuning candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.governed_improvement_fine_tuning_consume_service import (
    RUNTIME_VERSION,
    assert_governed_improvement_fine_tuning_consume_authority,
    build_governed_improvement_fine_tuning_candidate,
    governed_improvement_fine_tuning_consume_observability,
    resolve_governed_improvement_fine_tuning_consume_mode,
)
from src.oip.modules.conversation.application.governed_improvement_fine_tuning_service import (
    assert_governed_improvement_fine_tuning_authority,
    attach_governed_improvement_fine_tuning_to_request,
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
    return attach_governed_improvement_fine_tuning_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-48.0.2-slice2"


def test_improvement_candidate_only() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    bundle = req.governed_improvement_fine_tuning_bundle
    assert_governed_improvement_fine_tuning_authority(bundle)
    mode = resolve_governed_improvement_fine_tuning_consume_mode(
        bundle, allow_fine_tune=False, allow_model_swap=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_governed_improvement_fine_tuning_candidate(bundle)
    assert (
        built["governed_improvement_fine_tuning_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["governed_improvement_fine_tuning_consume_ready"] is True
    cand = built["governed_improvement_fine_tuning_candidate"]
    assert cand is not None
    assert "GOVERNED_IMPROVEMENT" in cand["in_scope_topics"]
    assert cand["improvement_proposal"] is None
    assert cand["fine_tune_plan"] is None
    assert cand["eval_regression_plan"] is None
    assert cand["dataset_curation_plan"] is None
    assert cand["prompt_iteration_plan"] is None
    assert cand["model_swap_plan"] is None
    assert cand["ablation_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["improvement_applied"] is False
    assert cand["fine_tuning_executed"] is False
    assert cand["production_model_swapped"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = governed_improvement_fine_tuning_consume_observability(req)
    assert_governed_improvement_fine_tuning_consume_authority(obs)
    assert obs["allow_fine_tune"] is False
    assert obs["allow_model_swap"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "governed_improvement_fine_tuning_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["FINE_TUNING"],
        "pilot_scope": "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "fine_tuning_executed": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_governed_improvement_fine_tuning_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_governed_improvement_fine_tuning_consume_mode(
            req.governed_improvement_fine_tuning_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    assert (
        resolve_governed_improvement_fine_tuning_consume_mode(
            req.governed_improvement_fine_tuning_bundle,
            allow_fine_tune=True,
        )
        == "INVOKE_FINE_TUNE"
    )
    assert (
        resolve_governed_improvement_fine_tuning_consume_mode(
            req.governed_improvement_fine_tuning_bundle,
            allow_model_swap=True,
        )
        == "INVOKE_MODEL_SWAP"
    )
    obs = governed_improvement_fine_tuning_consume_observability(
        req, allow_fine_tune=False, allow_model_swap=False
    )
    assert (
        obs["governed_improvement_fine_tuning_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_fine_tune"] is False
    assert obs["fine_tuning_executed"] is False
    assert obs["production_model_swapped"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("governed_improvement_fine_tuning") or {}
    assert (
        meta.get("governed_improvement_fine_tuning_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("governed_improvement_fine_tuning_consume_ready") is True
    )
    assert meta.get("improvement_applied") is False
    assert meta.get("fine_tuning_executed") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_fine_tune") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("governed_improvement_fine_tuning_candidate") or {}
    assert cand.get("improvement_proposal") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai48"
        / "frozen"
        / "governed_improvement_fine_tuning_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_governed_improvement_fine_tuning_consume_mode(
                case["synthetic_meta"],
                allow_fine_tune=bool(case.get("allow_fine_tune", False)),
                allow_model_swap=bool(case.get("allow_model_swap", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_governed_improvement_fine_tuning_consume_mode(
                req.governed_improvement_fine_tuning_bundle,
                allow_fine_tune=bool(case.get("allow_fine_tune", False)),
                allow_model_swap=bool(case.get("allow_model_swap", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
