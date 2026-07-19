"""MAI-46 slice 2 — backup/restore/DR candidate consume (never DR proven)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.backup_restore_disaster_lifecycle_consume_service import (
    RUNTIME_VERSION,
    assert_backup_restore_disaster_lifecycle_consume_authority,
    build_backup_restore_disaster_lifecycle_candidate,
    backup_restore_disaster_lifecycle_consume_observability,
    resolve_backup_restore_disaster_lifecycle_consume_mode,
)
from src.oip.modules.conversation.application.backup_restore_disaster_lifecycle_service import (
    assert_backup_restore_disaster_lifecycle_authority,
    attach_backup_restore_disaster_lifecycle_to_request,
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
    return attach_backup_restore_disaster_lifecycle_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-46.0.2-slice2"


def test_dr_candidate_only() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    bundle = req.backup_restore_disaster_lifecycle_bundle
    assert_backup_restore_disaster_lifecycle_authority(bundle)
    mode = resolve_backup_restore_disaster_lifecycle_consume_mode(
        bundle, allow_dr_drill=False, allow_purge_apply=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_backup_restore_disaster_lifecycle_candidate(bundle)
    assert (
        built["backup_restore_disaster_lifecycle_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["backup_restore_disaster_lifecycle_consume_ready"] is True
    cand = built["backup_restore_disaster_lifecycle_candidate"]
    assert cand is not None
    assert "BACKUP" in cand["in_scope_topics"]
    assert cand["backup_plan"] is None
    assert cand["restore_runbook"] is None
    assert cand["dr_plan"] is None
    assert cand["rpo_rto_targets"] is None
    assert cand["retention_schedule"] is None
    assert cand["archival_plan"] is None
    assert cand["purge_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["backup_proven"] is False
    assert cand["disaster_recovery_proven"] is False
    assert cand["silent_purge_allowed"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = backup_restore_disaster_lifecycle_consume_observability(req)
    assert_backup_restore_disaster_lifecycle_consume_authority(obs)
    assert obs["allow_dr_drill"] is False
    assert obs["allow_purge_apply"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "backup_restore_disaster_lifecycle_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["BACKUP"],
        "pilot_scope": "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "disaster_recovery_proven": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_backup_restore_disaster_lifecycle_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_backup_restore_disaster_lifecycle_consume_mode(
            req.backup_restore_disaster_lifecycle_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    assert (
        resolve_backup_restore_disaster_lifecycle_consume_mode(
            req.backup_restore_disaster_lifecycle_bundle,
            allow_dr_drill=True,
        )
        == "INVOKE_DR_DRILL"
    )
    assert (
        resolve_backup_restore_disaster_lifecycle_consume_mode(
            req.backup_restore_disaster_lifecycle_bundle,
            allow_purge_apply=True,
        )
        == "INVOKE_PURGE_APPLY"
    )
    obs = backup_restore_disaster_lifecycle_consume_observability(
        req, allow_dr_drill=False, allow_purge_apply=False
    )
    assert (
        obs["backup_restore_disaster_lifecycle_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_dr_drill"] is False
    assert obs["disaster_recovery_proven"] is False
    assert obs["silent_purge_allowed"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("backup_restore_disaster_lifecycle") or {}
    assert (
        meta.get("backup_restore_disaster_lifecycle_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("backup_restore_disaster_lifecycle_consume_ready") is True
    )
    assert meta.get("backup_proven") is False
    assert meta.get("silent_purge_allowed") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_dr_drill") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("backup_restore_disaster_lifecycle_candidate") or {}
    assert cand.get("backup_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai46"
        / "frozen"
        / "backup_restore_disaster_lifecycle_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_backup_restore_disaster_lifecycle_consume_mode(
                case["synthetic_meta"],
                allow_dr_drill=bool(case.get("allow_dr_drill", False)),
                allow_purge_apply=bool(case.get("allow_purge_apply", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_backup_restore_disaster_lifecycle_consume_mode(
                req.backup_restore_disaster_lifecycle_bundle,
                allow_dr_drill=bool(case.get("allow_dr_drill", False)),
                allow_purge_apply=bool(case.get("allow_purge_apply", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
