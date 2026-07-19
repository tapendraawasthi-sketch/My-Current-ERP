# ADR_0074 — Sync Authority Hardening (GAP-P1-002)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-04 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0001; ADR_0072 (Model B product mutation); MAI-35 offline/sync policy
- **Gap:** GAP-P1-002

## Context

Accounting posts (Model B Dexie) enqueue durable **event sync** rows
(`eventSyncQueue` via `enqueue*Sync` + `syncCoordinator`). A legacy
`syncOutbox` path still exists for some non-accounting entities. Dual workers
and badge aggregation create risk of “queued” being shown as “synced” and of
silent double-sync for invoices/vouchers.

MAI-35 already declares:
`conflict_policy=REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`,
`queued_must_not_label_synced=true`, AI `allow_sync_*=false`.

## Decision

1. **Authoritative accounting sync path:** `EVENT_SYNC_QUEUE`  
   (domain post → `enqueue*Sync` → `eventSyncQueue` → `syncCoordinator` cycle).
2. **Legacy `syncOutbox` for accounting entity types is BLOCKED**  
   (`syncEnqueueRouter.isAccountingEntitySyncBlocked` — invoice/voucher/
   stockMovement/orbixPostingReceipt). Proven by existing
   `noDoubleSync.test.ts`.
3. **Conflict policy:** material conflicts require reconfirm  
   (`REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`). Auto-overwrite forbidden.
4. **Queued ≠ synced:** UI/AI must not label queued/pending as synced.
5. **AI path:** never starts sync workers, push/pull, enqueue, conflict
   resolve, or reversal (`allow_*=false` on live ingress).
6. **Written exception for residual dual:** non-accounting legacy outbox and
   aggregated badge counts may still see legacy pending. Therefore runtime
   `dual_sync_status` / `gap_p1_002_status` remain **OPEN** until a later
   step proves a single worker end-to-end. Gap **register** may be REDUCED
   because accounting authority is documented, classified, and gated.

## Rejected

| Alternative | Why |
|-------------|-----|
| Delete legacy outbox now | Breaks non-accounting sync / large UI blast radius |
| Claim dual_sync CLOSED | Residual dual still present |
| AI-driven sync push | Violates fail-closed MAI-35 |

## Related

- `docs/mokxya-ai/MAI_SYNC_AUTHORITY_REGISTRY.json`
- `erp_bot/.../sync_authority_policy.py`
- `src/store/syncEnqueueRouter.ts`
- `src/__tests__/orbix/noDoubleSync.test.ts`
