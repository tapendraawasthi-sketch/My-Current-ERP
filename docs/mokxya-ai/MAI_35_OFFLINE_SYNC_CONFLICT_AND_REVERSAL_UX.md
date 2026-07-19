# MAI-35 — Offline, Sync, Conflict, and Reversal UX

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0052](decisions/ADR_0052_OFFLINE_SYNC_CONFLICT_REVERSAL_AUTHORITY.md)  
**Runtime:** `mai-35.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate offline/sync lifecycle, queueable vs online-only, conflict→reconfirm,
and governed-reversal policy without starting sync workers or mutating queues.

## Slice 1

1. Ingress `OFFLINE_SYNC_CONFLICT_REVERSAL_*` after EXPLICIT_CONFIRMATION_OEC_DISPATCH
2. `OfflineSyncConflictReversalBundleV1` from MAI-34 confirm state
3. `sync_policy_readiness=POLICY_DECLARED` when confirm module ready
4. Lifecycle: DRAFT / PREVIEW / QUEUED / SYNCED / CONFLICT / FAILED
5. Conflict → `REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`
6. Reversal → `GOVERNED_CORRECTION_ONLY` (not delete / silent edit)
7. `queued_must_not_label_synced=true`; dual sync + GAP-P1-002 remain OPEN
8. Never sync worker / enqueue / conflict resolve / reversal / badge mutate

## Slice 2 (later)

Sync/conflict/reversal candidates under allow flags — still no live sync.

## Gates

| Case | Expect |
|------|--------|
| purchase confirm ready | COMPLETE → POLICY_DECLARED sync policy |
| Confirm BLOCKED | SYNC POLICY BLOCKED |
| report / OOD / no ECO | SKIP |
| Any path | no sync/queue mutate; GAP-P1-002 OPEN |

## Non-goals

- Live syncCoordinator / eventSyncQueue / outbox mutations
- Closing GAP-P1-002 / GAP-P0-001
- Orbix badge UI (CR-35-02)
- Production approval
