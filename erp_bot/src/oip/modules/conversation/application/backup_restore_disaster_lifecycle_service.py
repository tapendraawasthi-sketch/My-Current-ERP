"""MAI-46 — backup/restore/disaster/lifecycle policy (never claims DR proven).

Slice 1: declare candidate backup/restore/DR/lifecycle policy from cue
detection. Never claims backup/restore/DR proven, never silent purge, never
production DR approval.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.backup_restore_disaster_lifecycle import (
    BackupRestoreDisasterLifecycleBundleV1,
    BackupRestoreDisasterLifecycleReadiness,
    BackupRestoreDisasterLifecycleStatus,
    BackupRestoreDisasterLifecycleTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-46.0.1-slice1"
AUTHORITY = "ADR_0063"

_BACKUP = re.compile(
    r"\b(?:backup(?:\s+job|\s+schedule|\s+policy)?|database\s+backup)\b",
    re.I,
)
_RESTORE = re.compile(
    r"\b(?:restore(?:\s+from\s+backup)?|point[- ]in[- ]time\s+restore)\b",
    re.I,
)
_DR = re.compile(
    r"\b(?:disaster\s+recovery|DR\s+drill|DR\s+plan|business\s+continuity)\b",
    re.I,
)
_RPO_RTO = re.compile(
    r"\b(?:RPO|RTO|recovery\s+point\s+objective|recovery\s+time\s+objective)\b",
    re.I,
)
_RETENTION = re.compile(
    r"\b(?:retention\s+policy|data\s+retention|retain\s+for)\b",
    re.I,
)
_ARCHIVAL = re.compile(
    r"\b(?:archival|cold\s+storage|archive\s+tier|data\s+archive)\b",
    re.I,
)
_PURGE = re.compile(
    r"\b(?:purge(?:\s+lifecycle)?|delete\s+lifecycle|data\s+lifecycle|TTL\s+purge)\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    raw = text or ""
    if _BACKUP.search(raw):
        in_scope.append(BackupRestoreDisasterLifecycleTopic.BACKUP.value)
    if _RESTORE.search(raw):
        in_scope.append(BackupRestoreDisasterLifecycleTopic.RESTORE.value)
    if _DR.search(raw):
        in_scope.append(
            BackupRestoreDisasterLifecycleTopic.DISASTER_RECOVERY.value
        )
    if _RPO_RTO.search(raw):
        in_scope.append(BackupRestoreDisasterLifecycleTopic.RPO_RTO.value)
    if _RETENTION.search(raw):
        in_scope.append(BackupRestoreDisasterLifecycleTopic.RETENTION.value)
    if _ARCHIVAL.search(raw):
        in_scope.append(BackupRestoreDisasterLifecycleTopic.ARCHIVAL.value)
    if _PURGE.search(raw):
        in_scope.append(
            BackupRestoreDisasterLifecycleTopic.PURGE_LIFECYCLE.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(
            BackupRestoreDisasterLifecycleTopic.UNSUPPORTED.value
        )
    return in_scope, unsupported


def build_backup_restore_disaster_lifecycle_bundle(
    request: CanonicalAIRequestV1,
) -> BackupRestoreDisasterLifecycleBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return BackupRestoreDisasterLifecycleBundleV1(
            analysis_status=BackupRestoreDisasterLifecycleStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            backup_restore_disaster_lifecycle_readiness=(
                BackupRestoreDisasterLifecycleReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "BACKUP_RESTORE_DISASTER_LIFECYCLE_BLOCKED",
                "NO_DR_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return BackupRestoreDisasterLifecycleBundleV1(
            analysis_status=BackupRestoreDisasterLifecycleStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            backup_restore_disaster_lifecycle_readiness=(
                BackupRestoreDisasterLifecycleReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_BACKUP_RESTORE_DISASTER_LIFECYCLE_TOPIC",
            ),
            warnings=("BACKUP_RESTORE_DISASTER_LIFECYCLE_NOT_APPLICABLE",),
        )

    pilot_ready = (
        BackupRestoreDisasterLifecycleReadiness.SCOPE_PARTIAL
        if unsupported
        else BackupRestoreDisasterLifecycleReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY",
        "DR_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_DR_AUTHORITY",
        "BACKUP_NOT_PROVEN",
        "RESTORE_NOT_PROVEN",
        "DISASTER_RECOVERY_NOT_PROVEN",
        "RPO_RTO_NOT_PROVEN",
        "DATA_LIFECYCLE_NOT_APPLIED",
        "RETENTION_NOT_ENFORCED",
        "ARCHIVAL_NOT_PROVEN",
        "NO_SILENT_PURGE",
        "PURGE_NOT_EXECUTED",
        "PRODUCTION_DR_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return BackupRestoreDisasterLifecycleBundleV1(
        analysis_status=BackupRestoreDisasterLifecycleStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        backup_restore_disaster_lifecycle_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY",
            "MUST_NOT_SILENT_PURGE",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_DR_APPROVED",
        ),
    )


def attach_backup_restore_disaster_lifecycle_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_backup_restore_disaster_lifecycle_bundle(request)
    return request.model_copy(
        update={"backup_restore_disaster_lifecycle_bundle": bundle}
    )


def assert_backup_restore_disaster_lifecycle_authority(
    bundle: BackupRestoreDisasterLifecycleBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.dr_authority_claimed
        or bundle.backup_proven
        or bundle.restore_proven
        or bundle.disaster_recovery_proven
        or bundle.rpo_rto_proven
        or bundle.data_lifecycle_applied
        or bundle.retention_enforced
        or bundle.archival_proven
        or bundle.silent_purge_allowed
        or bundle.purge_executed
        or bundle.production_dr_approved
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope
        != "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY"
    ):
        raise RuntimeError("BACKUP_RESTORE_DISASTER_LIFECYCLE_AUTHORITY")


def backup_restore_disaster_lifecycle_to_metadata(
    bundle: BackupRestoreDisasterLifecycleBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "backup_restore_disaster_lifecycle_readiness": (
            bundle.backup_restore_disaster_lifecycle_readiness.value
        ),
        "pilot_scope": "BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
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
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
