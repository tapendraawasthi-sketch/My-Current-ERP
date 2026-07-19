# ADR_0052 — Offline / Sync / Conflict / Reversal Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-35-OFFLINE-SYNC-CONFLICT-AND-REVERSAL-UX (slice 1)
- **Extends:** ADR_0001, ADR_0051

## Context

MAI-34 annotates explicit-confirm / OEC policy and emits confirm candidates
without live post. Product sync today remains dual (`eventSyncQueue` + legacy
outbox / khata confirm). GAP-P1-002 tracks dual sync; GAP-P0-001 remains open.
MAI-35 must declare offline/sync/conflict/reversal policy before any sync
worker, queue mutation, conflict resolve, or reversal dispatch. CR-35 keeps
syncCoordinator / Orbix badge UI / reversal writers off the heavy Cursor lane.

## Decision

1. MAI-35 owns `OfflineSyncConflictReversalBundleV1` on
   `CanonicalAIRequestV1` after EXPLICIT_CONFIRMATION_OEC_DISPATCH.
2. Slice 1: when confirm is COMPLETE + POLICY_DECLARED with a module, declare
   `sync_policy_readiness=POLICY_DECLARED`,
   lifecycle states DRAFT/PREVIEW/QUEUED/SYNCED/CONFLICT/FAILED,
   queueable vs online-only as DECLARED_NOT_ENFORCED,
   `conflict_policy=REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`,
   `reversal_policy=GOVERNED_CORRECTION_ONLY`,
   `queued_must_not_label_synced=true`,
   `dual_sync_status=OPEN`,
   `gap_p1_002_status=OPEN`,
   `gap_p0_001_status=OPEN`.
3. Slice 1 never starts sync workers, enqueues, resolves conflicts, dispatches
   reversals, edits posted history, or mutates UI badges: all execute/mutate
   flags false / zero; `is_execution_authority=false`.
4. Confirm BLOCKED → sync policy BLOCKED; missing/incomplete confirm → SKIP.
   Do not invent synced success.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Start sync workers in annotation | Side effects / wrong slice |
| Auto-resolve / LWW overwrite | Material conflict must reconfirm |
| Label queued as synced | Acceptance gate violation |
| Silent posted-history edit | Reversal must be governed |
| Close GAP-P1-002 in slice 1 | Needs single-path convergence + E2E |

## Related

- `docs/mokxya-ai/MAI_35_OFFLINE_SYNC_CONFLICT_AND_REVERSAL_UX.md`
- `docs/mokxya-ai/baselines/MAI_35_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/offline_sync_conflict_reversal_service.py`
