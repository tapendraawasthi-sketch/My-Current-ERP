"""MAI-46 slice 2 — consume backup/restore/DR/lifecycle policy into candidates.

Default: CANDIDATE_ONLY (build DR candidate; never claims DR proven).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never silent purge or production DR approval.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.backup_restore_disaster_lifecycle import (
    BackupRestoreDisasterLifecycleBundleV1,
    BackupRestoreDisasterLifecycleReadiness,
    BackupRestoreDisasterLifecycleStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-46.0.2-slice2"
AUTHORITY = "ADR_0063"


def _as_brdl_meta(
    bundle: Mapping[str, Any] | BackupRestoreDisasterLifecycleBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, BackupRestoreDisasterLifecycleBundleV1):
        from .backup_restore_disaster_lifecycle_service import (
            backup_restore_disaster_lifecycle_to_metadata,
        )

        return backup_restore_disaster_lifecycle_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("dr_authority_claimed") is True
        or data.get("backup_proven") is True
        or data.get("restore_proven") is True
        or data.get("disaster_recovery_proven") is True
        or data.get("rpo_rto_proven") is True
        or data.get("data_lifecycle_applied") is True
        or data.get("retention_enforced") is True
        or data.get("archival_proven") is True
        or data.get("silent_purge_allowed") is True
        or data.get("purge_executed") is True
        or data.get("production_dr_approved") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(
            data.get("pilot_scope")
            or "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY"
        )
        != "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY"
    )


def resolve_backup_restore_disaster_lifecycle_consume_mode(
    bundle: Mapping[str, Any] | BackupRestoreDisasterLifecycleBundleV1 | None,
    *,
    allow_dr_drill: bool = False,
    allow_purge_apply: bool = False,
) -> str:
    """Return consume mode (never implies DR proven on default path)."""
    data = _as_brdl_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != BackupRestoreDisasterLifecycleStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("backup_restore_disaster_lifecycle_readiness") or ""
    )
    if readiness == BackupRestoreDisasterLifecycleReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == BackupRestoreDisasterLifecycleReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        BackupRestoreDisasterLifecycleReadiness.POLICY_DECLARED.value,
        BackupRestoreDisasterLifecycleReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_dr_drill:
        return "INVOKE_DR_DRILL"
    if allow_purge_apply:
        return "INVOKE_PURGE_APPLY"
    return "CANDIDATE_ONLY"


def build_backup_restore_disaster_lifecycle_candidate(
    bundle: Mapping[str, Any] | BackupRestoreDisasterLifecycleBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_dr_drill: bool = False,
    allow_purge_apply: bool = False,
) -> dict[str, Any]:
    """Build backup/restore/DR/lifecycle candidate (never claims DR proven)."""
    data = _as_brdl_meta(bundle)
    mode = resolve_backup_restore_disaster_lifecycle_consume_mode(
        data,
        allow_dr_drill=allow_dr_drill,
        allow_purge_apply=allow_purge_apply,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "backup_restore_disaster_lifecycle_consume_mode": mode,
        "backup_restore_disaster_lifecycle_consume_ready": False,
        "backup_restore_disaster_lifecycle_candidate": None,
        "mutation_tools_allowed": False,
        "dr_authority_claimed": False,
        "backup_proven": False,
        "restore_proven": False,
        "disaster_recovery_proven": False,
        "rpo_rto_proven": False,
        "data_lifecycle_applied": False,
        "retention_enforced": False,
        "archival_proven": False,
        "silent_purge_allowed": False,
        "purge_executed": False,
        "production_dr_approved": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_dr_drill": False,
        "allow_purge_apply": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    topics = data.get("in_scope_topics") or ()
    if isinstance(topics, tuple):
        topics = list(topics)
    unsupported = data.get("unsupported_topics") or ()
    if isinstance(unsupported, tuple):
        unsupported = list(unsupported)

    candidate = {
        "pilot_scope": "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY",
        "backup_restore_disaster_lifecycle_readiness": data.get(
            "backup_restore_disaster_lifecycle_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "backup_plan": None,
        "restore_runbook": None,
        "dr_plan": None,
        "rpo_rto_targets": None,
        "retention_schedule": None,
        "archival_plan": None,
        "purge_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "dr_authority_claimed": False,
        "backup_proven": False,
        "restore_proven": False,
        "disaster_recovery_proven": False,
        "rpo_rto_proven": False,
        "data_lifecycle_applied": False,
        "retention_enforced": False,
        "archival_proven": False,
        "silent_purge_allowed": False,
        "purge_executed": False,
        "production_dr_approved": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "backup_restore_disaster_lifecycle_consume_ready": ready,
            "backup_restore_disaster_lifecycle_candidate": candidate,
        }
    )
    return base


def backup_restore_disaster_lifecycle_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_dr_drill: bool = False,
    allow_purge_apply: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_dr_drill, allow_purge_apply
    built = build_backup_restore_disaster_lifecycle_candidate(
        request.backup_restore_disaster_lifecycle_bundle,
        field_overrides={},
        allow_dr_drill=False,
        allow_purge_apply=False,
    )
    return {
        "backup_restore_disaster_lifecycle_consume_mode": built[
            "backup_restore_disaster_lifecycle_consume_mode"
        ],
        "backup_restore_disaster_lifecycle_consume_ready": bool(
            built["backup_restore_disaster_lifecycle_consume_ready"]
        ),
        "backup_restore_disaster_lifecycle_candidate": built.get(
            "backup_restore_disaster_lifecycle_candidate"
        ),
        "mutation_tools_allowed": False,
        "dr_authority_claimed": False,
        "backup_proven": False,
        "restore_proven": False,
        "disaster_recovery_proven": False,
        "rpo_rto_proven": False,
        "data_lifecycle_applied": False,
        "retention_enforced": False,
        "archival_proven": False,
        "silent_purge_allowed": False,
        "purge_executed": False,
        "production_dr_approved": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_dr_drill": False,
        "allow_purge_apply": False,
    }


def assert_backup_restore_disaster_lifecycle_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("dr_authority_claimed") is True
        or obs.get("backup_proven") is True
        or obs.get("restore_proven") is True
        or obs.get("disaster_recovery_proven") is True
        or obs.get("rpo_rto_proven") is True
        or obs.get("data_lifecycle_applied") is True
        or obs.get("retention_enforced") is True
        or obs.get("archival_proven") is True
        or obs.get("silent_purge_allowed") is True
        or obs.get("purge_executed") is True
        or obs.get("production_dr_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_dr_drill") is True
        or obs.get("allow_purge_apply") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("BACKUP_RESTORE_DISASTER_LIFECYCLE_CONSUME_AUTHORITY")


def enrich_brdl_metadata_with_consume(
    brdl_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(brdl_meta)
    obs = backup_restore_disaster_lifecycle_consume_observability(
        request,
        allow_dr_drill=False,
        allow_purge_apply=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
