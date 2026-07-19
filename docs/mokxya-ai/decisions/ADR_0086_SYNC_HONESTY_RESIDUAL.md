# ADR_0086 — Sync Honesty Residual (PR-B3 / GAP-P1-002)

- **Status:** Accepted (2026-07-19)
- **Step:** PR-B3
- **Extends:** ADR_0074 accounting EVENT_SYNC_QUEUE; MAI-35 conflict policy
- **Gap:** GAP-P1-002 remains **REDUCED** (not CLOSED)

## Context

NEXT-04 classified accounting sync authority and blocked legacy outbox for
accounting entities. Residual dual badge aggregation (legacy outbox pending +
event queue) and staging conflict exercise still need an honesty residual pack
without thrashing `syncCoordinator`.

## Decision

1. **Queued ≠ synced** remains enforced for Orbix posting presentation
   (`syncStatusPresentation`: pending/queued/syncing → Waiting to sync) and
   aggregate badge (`pendingCount > 0` ⇒ state ≠ synced).
2. **Accounting entities** stay on `EVENT_SYNC_QUEUE` only
   (`isAccountingEntitySyncBlocked` unchanged).
3. **Conflict policy** remains `REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`;
   narrative documented under artifacts + baseline (staging operator exercise
   may remain PENDING with ticket blocking PR-C if not attested).
4. **Do not rewrite** `syncCoordinator` in this step.
5. **`gap_p1_002` runtime OPEN**; register REDUCED; not production_approved.

## Residual dual badge (documented, not deleted)

Aggregate pending counts may include **legacy non-accounting outbox** pending
plus **eventSyncQueue** pending. That is the written exception
`NON_ACCOUNTING_LEGACY_OUTBOX_AND_AGGREGATE_BADGE_RESIDUAL`. It must not cause
a Synced label while any pending remains.

## Rejected

| Alternative | Why |
|-------------|-----|
| Delete syncCoordinator / merge queues now | Blast radius; out of PR-B3 scope |
| Claim dual_sync CLOSED | Residual badge dual remains |
| Claim staging PASS without attestation | False hard-proof |

## Related

- `docs/mokxya-ai/MAI_SYNC_HONESTY_RESIDUAL_REGISTRY.json`
- `artifacts/prod-ready-pr-b3/`
- `src/features/orbix/presentation.ts::syncStatusPresentation`
- `src/platform/sync/syncStatusAggregate.ts`
