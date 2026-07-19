"""MAI-35 slice 2 — consume offline/sync policy into candidates.

Default: CANDIDATE_ONLY (build sync/conflict/reversal candidate; never syncs).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never sync workers, queues, conflict resolve, or reversal.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.offline_sync_conflict_reversal import (
    OfflineSyncConflictReversalBundleV1,
    OfflineSyncConflictReversalStatus,
    SyncPolicyReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-35.0.2-slice2"
AUTHORITY = "ADR_0052"


def _as_osc_meta(
    bundle: Mapping[str, Any] | OfflineSyncConflictReversalBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, OfflineSyncConflictReversalBundleV1):
        from .offline_sync_conflict_reversal_service import (
            offline_sync_conflict_reversal_to_metadata,
        )

        return offline_sync_conflict_reversal_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("sync_workers_started") is True
        or data.get("sync_push_invoked") is True
        or data.get("sync_pull_invoked") is True
        or data.get("queue_enqueued") is True
        or data.get("conflict_resolved") is True
        or data.get("conflict_auto_overwrite") is True
        or data.get("reversal_dispatched") is True
        or data.get("posted_history_edited") is True
        or data.get("ui_badge_mutated") is True
        or data.get("queued_labeled_synced") is True
        or int(data.get("queue_mutations") or 0) != 0
        or int(data.get("sync_mutations") or 0) != 0
        or int(data.get("reversal_mutations") or 0) != 0
        or str(data.get("gap_p1_002_status") or "OPEN") != "OPEN"
        or str(data.get("gap_p0_001_status") or "OPEN") != "OPEN"
        or data.get("queued_must_not_label_synced") is False
        or data.get("retry_must_be_idempotent") is False
        or data.get("posted_history_immutable_except_governed_reversal") is False
    )


def resolve_offline_sync_consume_mode(
    bundle: Mapping[str, Any] | OfflineSyncConflictReversalBundleV1 | None,
    *,
    allow_sync_push: bool = False,
    allow_conflict_resolve: bool = False,
    allow_reversal_dispatch: bool = False,
) -> str:
    """Return consume mode (never implies sync on default path)."""
    data = _as_osc_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != OfflineSyncConflictReversalStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("sync_policy_readiness") or "")
    if readiness == SyncPolicyReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == SyncPolicyReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness != SyncPolicyReadiness.POLICY_DECLARED.value:
        return "SKIP"
    if not data.get("draft_module_id"):
        return "BLOCKED"
    if allow_reversal_dispatch:
        return "INVOKE_REVERSAL_DISPATCH"
    if allow_conflict_resolve:
        return "INVOKE_CONFLICT_RESOLVE"
    if allow_sync_push:
        return "INVOKE_SYNC_PUSH"
    return "CANDIDATE_ONLY"


def build_offline_sync_candidate(
    bundle: Mapping[str, Any] | OfflineSyncConflictReversalBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_sync_push: bool = False,
    allow_conflict_resolve: bool = False,
    allow_reversal_dispatch: bool = False,
) -> dict[str, Any]:
    """Build sync/conflict/reversal candidate (never syncs or mutates queues)."""
    data = _as_osc_meta(bundle)
    mode = resolve_offline_sync_consume_mode(
        data,
        allow_sync_push=allow_sync_push,
        allow_conflict_resolve=allow_conflict_resolve,
        allow_reversal_dispatch=allow_reversal_dispatch,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "offline_sync_consume_mode": mode,
        "offline_sync_consume_ready": False,
        "offline_sync_candidate": None,
        "sync_workers_started": False,
        "sync_push_invoked": False,
        "sync_pull_invoked": False,
        "queue_enqueued": False,
        "conflict_resolved": False,
        "reversal_dispatched": False,
        "ui_badge_mutated": False,
        "queued_labeled_synced": False,
        "queue_mutations": 0,
        "sync_mutations": 0,
        "reversal_mutations": 0,
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_sync_push": False,
        "allow_conflict_resolve": False,
        "allow_reversal_dispatch": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    lifecycle = data.get("lifecycle_states_declared") or [
        "DRAFT",
        "PREVIEW",
        "QUEUED",
        "SYNCED",
        "CONFLICT",
        "FAILED",
    ]
    if isinstance(lifecycle, tuple):
        lifecycle = list(lifecycle)

    candidate = {
        "draft_module_id": data.get("draft_module_id"),
        "port_id": data.get("selected_port_id"),
        "event_type": data.get("event_type"),
        "lifecycle_states": lifecycle,
        "queueable_class_policy": data.get("queueable_class_policy")
        or "DECLARED_NOT_ENFORCED",
        "online_only_class_policy": data.get("online_only_class_policy")
        or "DECLARED_NOT_ENFORCED",
        "conflict_policy": data.get("conflict_policy")
        or "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT",
        "reversal_policy": data.get("reversal_policy")
        or "GOVERNED_CORRECTION_ONLY",
        "queued_must_not_label_synced": True,
        "retry_must_be_idempotent": True,
        "posted_history_immutable_except_governed_reversal": True,
        "dual_sync_status": data.get("dual_sync_status") or "OPEN",
        "sync_envelope": None,
        "conflict_diff": None,
        "reversal_envelope": None,
        "field_overrides": overrides,
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["draft_module_id"])
    base.update(
        {
            "offline_sync_consume_ready": ready,
            "offline_sync_candidate": candidate,
        }
    )
    return base


def offline_sync_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_sync_push: bool = False,
    allow_conflict_resolve: bool = False,
    allow_reversal_dispatch: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; pull MAI-31 field_overrides when present."""
    del allow_sync_push, allow_conflict_resolve, allow_reversal_dispatch
    overrides: dict[str, Any] = {}
    try:
        from .domain_port_consume_service import build_draft_payload_candidate

        payload = build_draft_payload_candidate(
            request.domain_port_mapping_bundle,
            request.event_frame,
            allow_port_invoke=False,
        )
        if isinstance(payload.get("field_overrides"), dict):
            overrides = dict(payload["field_overrides"])
    except Exception:  # noqa: BLE001
        overrides = {}

    built = build_offline_sync_candidate(
        request.offline_sync_conflict_reversal_bundle,
        field_overrides=overrides,
        allow_sync_push=False,
        allow_conflict_resolve=False,
        allow_reversal_dispatch=False,
    )
    return {
        "offline_sync_consume_mode": built["offline_sync_consume_mode"],
        "offline_sync_consume_ready": bool(built["offline_sync_consume_ready"]),
        "offline_sync_candidate": built.get("offline_sync_candidate"),
        "sync_workers_started": False,
        "sync_push_invoked": False,
        "sync_pull_invoked": False,
        "queue_enqueued": False,
        "conflict_resolved": False,
        "reversal_dispatched": False,
        "ui_badge_mutated": False,
        "queued_labeled_synced": False,
        "queue_mutations": 0,
        "sync_mutations": 0,
        "reversal_mutations": 0,
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_sync_push": False,
        "allow_conflict_resolve": False,
        "allow_reversal_dispatch": False,
    }


def assert_offline_sync_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("sync_workers_started") is True
        or obs.get("sync_push_invoked") is True
        or obs.get("sync_pull_invoked") is True
        or obs.get("queue_enqueued") is True
        or obs.get("conflict_resolved") is True
        or obs.get("reversal_dispatched") is True
        or obs.get("ui_badge_mutated") is True
        or obs.get("queued_labeled_synced") is True
        or int(obs.get("queue_mutations") or 0) != 0
        or int(obs.get("sync_mutations") or 0) != 0
        or int(obs.get("reversal_mutations") or 0) != 0
        or obs.get("allow_sync_push") is True
        or obs.get("allow_conflict_resolve") is True
        or obs.get("allow_reversal_dispatch") is True
        or str(obs.get("gap_p1_002_status") or "OPEN") != "OPEN"
        or str(obs.get("gap_p0_001_status") or "OPEN") != "OPEN"
    ):
        raise RuntimeError("OFFLINE_SYNC_CONSUME_AUTHORITY")


def enrich_osc_metadata_with_consume(
    osc_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(osc_meta)
    obs = offline_sync_consume_observability(
        request,
        allow_sync_push=False,
        allow_conflict_resolve=False,
        allow_reversal_dispatch=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
