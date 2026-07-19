"""MAI-46 slice 1 — backup/restore/DR/lifecycle (never claims DR proven)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.backup_restore_disaster_lifecycle import (
    BackupRestoreDisasterLifecycleReadiness,
    BackupRestoreDisasterLifecycleStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.backup_restore_disaster_lifecycle_service import (
    RUNTIME_VERSION,
    assert_backup_restore_disaster_lifecycle_authority,
    attach_backup_restore_disaster_lifecycle_to_request,
    build_backup_restore_disaster_lifecycle_bundle,
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


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-46.0.1-slice1"


def test_backup_restore_policy_declared() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    bundle = req.backup_restore_disaster_lifecycle_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BackupRestoreDisasterLifecycleStatus.COMPLETE
    )
    assert (
        bundle.backup_restore_disaster_lifecycle_readiness
        == BackupRestoreDisasterLifecycleReadiness.POLICY_DECLARED
    )
    assert "BACKUP" in bundle.in_scope_topics
    assert "RESTORE" in bundle.in_scope_topics
    assert "RPO_RTO" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.backup_proven is False
    assert bundle.restore_proven is False
    assert bundle.disaster_recovery_proven is False
    assert bundle.rpo_rto_proven is False
    assert bundle.data_lifecycle_applied is False
    assert bundle.silent_purge_allowed is False
    assert bundle.purge_executed is False
    assert bundle.production_dr_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "NO_SILENT_PURGE" in bundle.reason_codes
    assert_backup_restore_disaster_lifecycle_authority(bundle)


def test_disaster_and_retention() -> None:
    req = _pipeline(
        "disaster recovery DR drill with retention policy and archival cold storage"
    )
    bundle = req.backup_restore_disaster_lifecycle_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BackupRestoreDisasterLifecycleStatus.COMPLETE
    )
    assert "DISASTER_RECOVERY" in bundle.in_scope_topics
    assert "RETENTION" in bundle.in_scope_topics
    assert "ARCHIVAL" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.backup_restore_disaster_lifecycle_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == BackupRestoreDisasterLifecycleStatus.SKIP
    )


def test_perf_without_dr_skips() -> None:
    req = _pipeline(
        "load test and latency SLO for Nepal deployment conditions"
    )
    bundle = req.backup_restore_disaster_lifecycle_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == BackupRestoreDisasterLifecycleStatus.SKIP
    )


def test_adapter_metadata() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("backup_restore_disaster_lifecycle") or {}
    assert meta.get("backup_proven") is False
    assert meta.get("restore_proven") is False
    assert meta.get("disaster_recovery_proven") is False
    assert meta.get("silent_purge_allowed") is False
    assert meta.get("production_dr_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="data lifecycle purge TTL purge with retention policy",
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
    bundle = build_backup_restore_disaster_lifecycle_bundle(req)
    assert (
        bundle.analysis_status
        == BackupRestoreDisasterLifecycleStatus.COMPLETE
    )
    assert "PURGE_LIFECYCLE" in bundle.in_scope_topics
    assert "RETENTION" in bundle.in_scope_topics
    assert bundle.purge_executed is False
    assert bundle.silent_purge_allowed is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai46"
        / "frozen"
        / "backup_restore_disaster_lifecycle_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.backup_restore_disaster_lifecycle_bundle
        assert bundle is not None
        assert bundle.backup_proven is False
        assert bundle.disaster_recovery_proven is False
        assert bundle.silent_purge_allowed is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.backup_restore_disaster_lifecycle_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
