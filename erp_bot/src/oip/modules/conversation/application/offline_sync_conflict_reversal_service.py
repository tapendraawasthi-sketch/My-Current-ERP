"""MAI-35 — offline / sync / conflict / reversal policy annotation (never syncs).

Slice 1: declare lifecycle, queueable/online-only, conflict→reconfirm, and
governed-reversal policy from MAI-34 confirm state. Never starts sync workers,
enqueues, resolves conflicts, or edits posted history.
"""

from __future__ import annotations

from typing import Any

from ....contracts.explicit_confirmation_oec_dispatch import (
    ConfirmReadiness,
    ExplicitConfirmationOecDispatchStatus,
)
from ....contracts.offline_sync_conflict_reversal import (
    ConflictPolicy,
    DualSyncStatus,
    OfflineSyncConflictReversalBundleV1,
    OfflineSyncConflictReversalStatus,
    ReversalPolicy,
    SyncPolicyReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-35.0.2-slice2"
AUTHORITY = "ADR_0052"

_LIFECYCLE = (
    "DRAFT",
    "PREVIEW",
    "QUEUED",
    "SYNCED",
    "CONFLICT",
    "FAILED",
)


def build_offline_sync_conflict_reversal_bundle(
    request: CanonicalAIRequestV1,
) -> OfflineSyncConflictReversalBundleV1:
    eco = request.explicit_confirmation_oec_dispatch_bundle
    if eco is None:
        return OfflineSyncConflictReversalBundleV1(
            analysis_status=OfflineSyncConflictReversalStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            sync_policy_readiness=SyncPolicyReadiness.NOT_APPLICABLE,
            reason_codes=("NO_EXPLICIT_CONFIRMATION_OEC_DISPATCH",),
            warnings=("NO_EXPLICIT_CONFIRMATION_OEC_DISPATCH",),
        )

    if eco.analysis_status != ExplicitConfirmationOecDispatchStatus.COMPLETE:
        return OfflineSyncConflictReversalBundleV1(
            analysis_status=OfflineSyncConflictReversalStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=eco.event_type or "unknown",
            sync_policy_readiness=SyncPolicyReadiness.NOT_APPLICABLE,
            reason_codes=(
                "CONFIRM_OEC_NOT_COMPLETE",
                "SYNC_POLICY_NOT_APPLICABLE",
            ),
            warnings=("SYNC_POLICY_NOT_APPLICABLE",),
        )

    event_type = eco.event_type or "unknown"
    port_id = eco.selected_port_id
    module_id = eco.draft_module_id

    if eco.confirm_readiness == ConfirmReadiness.BLOCKED:
        return OfflineSyncConflictReversalBundleV1(
            analysis_status=OfflineSyncConflictReversalStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            draft_module_id=module_id,
            event_type=event_type,
            sync_policy_readiness=SyncPolicyReadiness.BLOCKED,
            lifecycle_states_declared=_LIFECYCLE,
            conflict_policy=ConflictPolicy.NOT_APPLICABLE,
            reversal_policy=ReversalPolicy.NOT_APPLICABLE,
            dual_sync_status=DualSyncStatus.OPEN,
            reason_codes=(
                "CONFIRM_BLOCKED_UNTIL_READY",
                "SYNC_POLICY_BLOCKED",
                "NO_SYNC_WORKER",
                "NO_QUEUE_ENQUEUE",
                "NO_CONFLICT_RESOLVE",
                "NO_REVERSAL_DISPATCH",
                "GAP_P1_002_OPEN",
                "GAP_P0_001_OPEN",
            ),
            warnings=(
                "GAP_P1_002_REMAINS_OPEN",
                "GAP_P0_001_REMAINS_OPEN",
                "DUAL_SYNC_STILL_ACTIVE",
            ),
        )

    if eco.confirm_readiness != ConfirmReadiness.POLICY_DECLARED or not module_id:
        return OfflineSyncConflictReversalBundleV1(
            analysis_status=OfflineSyncConflictReversalStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            sync_policy_readiness=SyncPolicyReadiness.NOT_APPLICABLE,
            reason_codes=("SYNC_POLICY_NOT_APPLICABLE",),
            warnings=("SYNC_POLICY_NOT_APPLICABLE",),
        )

    reasons = (
        "PORT_SUPPORTED",
        "SYNC_POLICY_DECLARED",
        "LIFECYCLE_STATES_DECLARED",
        "QUEUEABLE_VS_ONLINE_ONLY_DECLARED_NOT_ENFORCED",
        "CONFLICT_REQUIRES_RECONFIRM",
        "REVERSAL_GOVERNED_CORRECTION_ONLY",
        "QUEUED_MUST_NOT_LABEL_SYNCED",
        "RETRY_MUST_BE_IDEMPOTENT",
        "POSTED_HISTORY_IMMUTABLE_EXCEPT_GOVERNED_REVERSAL",
        "DUAL_SYNC_STATUS_OPEN",
        "GAP_P1_002_OPEN",
        "GAP_P0_001_OPEN",
        "NO_SYNC_WORKER",
        "NO_QUEUE_ENQUEUE",
        "NO_CONFLICT_RESOLVE",
        "NO_REVERSAL_DISPATCH",
        "NO_UI_BADGE_MUTATE",
        "CROSS_COMPANY_DENY",
        "TENANT_ISOLATION_REQUIRED",
    )
    return OfflineSyncConflictReversalBundleV1(
        analysis_status=OfflineSyncConflictReversalStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        selected_port_id=port_id,
        draft_module_id=module_id,
        event_type=event_type,
        sync_policy_readiness=SyncPolicyReadiness.POLICY_DECLARED,
        lifecycle_states_declared=_LIFECYCLE,
        conflict_policy=ConflictPolicy.REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT,
        reversal_policy=ReversalPolicy.GOVERNED_CORRECTION_ONLY,
        dual_sync_status=DualSyncStatus.OPEN,
        reason_codes=reasons,
        warnings=(
            "GAP_P1_002_REMAINS_OPEN",
            "GAP_P0_001_REMAINS_OPEN",
            "DUAL_SYNC_STILL_ACTIVE",
            "EVENT_SYNC_AND_LEGACY_OUTBOX_BOTH_PRESENT",
            "SYNC_ENFORCEMENT_PENDING_LATER_SLICE",
        ),
    )


def attach_offline_sync_conflict_reversal_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_offline_sync_conflict_reversal_bundle(request)
    return request.model_copy(
        update={"offline_sync_conflict_reversal_bundle": bundle}
    )


def assert_offline_sync_conflict_reversal_authority(
    bundle: OfflineSyncConflictReversalBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.sync_workers_started
        or bundle.sync_push_invoked
        or bundle.sync_pull_invoked
        or bundle.queue_enqueued
        or bundle.conflict_resolved
        or bundle.conflict_auto_overwrite
        or bundle.reversal_dispatched
        or bundle.posted_history_edited
        or bundle.ui_badge_mutated
        or bundle.queued_labeled_synced
        or bundle.queue_mutations != 0
        or bundle.sync_mutations != 0
        or bundle.reversal_mutations != 0
        or bundle.gap_p1_002_status != "OPEN"
        or bundle.gap_p0_001_status != "OPEN"
        or not bundle.queued_must_not_label_synced
        or not bundle.retry_must_be_idempotent
        or not bundle.posted_history_immutable_except_governed_reversal
    ):
        raise RuntimeError("OFFLINE_SYNC_CONFLICT_REVERSAL_AUTHORITY")


def offline_sync_conflict_reversal_to_metadata(
    bundle: OfflineSyncConflictReversalBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_port_id": bundle.selected_port_id,
        "draft_module_id": bundle.draft_module_id,
        "event_type": bundle.event_type,
        "sync_policy_readiness": bundle.sync_policy_readiness.value,
        "lifecycle_states_declared": list(bundle.lifecycle_states_declared),
        "queueable_class_policy": bundle.queueable_class_policy,
        "online_only_class_policy": bundle.online_only_class_policy,
        "conflict_policy": bundle.conflict_policy.value,
        "reversal_policy": bundle.reversal_policy.value,
        "queued_must_not_label_synced": True,
        "retry_must_be_idempotent": True,
        "posted_history_immutable_except_governed_reversal": True,
        "dual_sync_status": bundle.dual_sync_status.value,
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "sync_workers_started": False,
        "sync_push_invoked": False,
        "sync_pull_invoked": False,
        "queue_enqueued": False,
        "conflict_resolved": False,
        "reversal_dispatched": False,
        "ui_badge_mutated": False,
        "queue_mutations": 0,
        "sync_mutations": 0,
        "reversal_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
