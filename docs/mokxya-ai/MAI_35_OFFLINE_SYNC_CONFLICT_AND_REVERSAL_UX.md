# MAI-35 — Offline, Sync, Conflict, and Reversal UX

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0052](decisions/ADR_0052_OFFLINE_SYNC_CONFLICT_REVERSAL_AUTHORITY.md)  
**Runtime:** `mai-35.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate offline/sync lifecycle, queueable vs online-only, conflict→reconfirm,
and governed-reversal policy — then consume into sync/conflict/reversal
candidates — without starting sync workers or mutating queues.

## Slice 1

1. Ingress `OFFLINE_SYNC_CONFLICT_REVERSAL_*` after EXPLICIT_CONFIRMATION_OEC_DISPATCH
2. `OfflineSyncConflictReversalBundleV1` from MAI-34 confirm state
3. `sync_policy_readiness=POLICY_DECLARED` when confirm module ready
4. Lifecycle: DRAFT / PREVIEW / QUEUED / SYNCED / CONFLICT / FAILED
5. Conflict → `REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`
6. Reversal → `GOVERNED_CORRECTION_ONLY` (not delete / silent edit)
7. `queued_must_not_label_synced=true`; dual sync + GAP-P1-002 remain OPEN
8. Never sync worker / enqueue / conflict resolve / reversal / badge mutate

## Slice 2

1. `resolve_offline_sync_consume_mode` / `build_offline_sync_candidate`
2. Default `CANDIDATE_ONLY` — merges MAI-31 `field_overrides`; envelopes null
3. Blocked readiness / fake sync → `BLOCKED`; read-only → `SKIP`
4. Live path forces `allow_sync_push` / `allow_conflict_resolve` /
   `allow_reversal_dispatch` false
5. Metadata: `offline_sync_consume_ready` + `offline_sync_candidate`

## Gates

| Case | Expect |
|------|--------|
| purchase confirm ready | COMPLETE → `CANDIDATE_ONLY` offline/sync candidate |
| Blocked readiness / fake worker | `BLOCKED` |
| report / OOD / no ECO | SKIP |
| Any live path | never sync/queue; GAP-P1-002 OPEN |

## Non-goals

- Live syncCoordinator / eventSyncQueue / outbox mutations
- Closing GAP-P1-002 / GAP-P0-001
- Orbix badge UI (CR-35-02)
- Production approval
