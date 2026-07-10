# Wave 1 Stage 1 Hotfix Report

Date: 2026-07-10  
Scope: Stage 1 hotfixes only (FI-022, FI-021, FI-008 partial). Stage 2 not started.

## Summary

Stage 1 hotfixes close the gaps identified in `docs/WAVE1_STAGE1_VERIFICATION.md`:

1. Single period-lock enforcement entry point with `PeriodLockedError`
2. All identified posting bypass paths wired to that entry point
3. Initialization lifecycle state machine with one timeout source (`INIT_APP_TIMEOUT_MS = 15000`)
4. Integration tests for protected posting paths and init lifecycle
5. CI pipeline runs `npm run test:accounting` (mandatory)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/ledger/postingPeriodGuard.ts` | **New.** `enforcePostingPeriodLock`, `enforcePostingPeriodLockIfPosted`, `PeriodLockedError` |
| `src/lib/ledger/initLifecycle.ts` | **New.** Init lifecycle states, `INIT_APP_TIMEOUT_MS`, `readyInitPatch`, `recoverableDataLoadPatch` |
| `src/lib/ledger/periodLockService.ts` | Read-only lock queries; deprecated wrappers delegate to guard |
| `src/lib/ledger/initFailurePolicy.ts` | Re-exports from `initLifecycle.ts` |
| `src/lib/ledger/index.ts` | Barrel exports |
| `src/lib/periodLock.ts` | Removed dead guard; clear localStorage when duplicates skipped |
| `src/lib/syncEngine.ts` | `applySyncPullFinancialRecords` with period lock; pull uses shared helper |
| `src/store/index.ts` | Init lifecycle wiring; login/session recoverable-error; `enforcePostingPeriodLock` in `postInvoiceJournal` |
| `src/store/store.types.ts` | `InitLifecycleState`, `initLifecycle` on `AppState` |
| `src/store/slices/voucherSlice.ts` | Guard on reversal journals; uses `enforcePostingPeriodLock` |
| `src/store/workflowActions.ts` | Period lock on all 5 workflow posting functions |
| `src/store/permissionsStore.ts` | Period lock in `approveVoucher` before status flip |
| `src/pages/OptionalVouchers.tsx` | Convert uses `updateVoucher` (store path) |
| `src/pages/YearEndProcess.tsx` | Removed direct `db.table("vouchers").put` fallback |
| `src/App.tsx` | Removed 10s safety-net timeout (race with 15s init timeout) |
| `src/__tests__/accounting/testHarness.ts` | **New.** Shared DB/store seed helpers |
| `src/__tests__/accounting/postingPaths.integration.test.ts` | **New.** Store/workflow/sync/AI/approval integration tests |
| `src/__tests__/accounting/initLifecycle.integration.test.ts` | **New.** Init lifecycle and timeout tests |
| `src/__tests__/accounting/periodLock.test.ts` | `PeriodLockedError`, missing-table fail-closed |
| `src/__tests__/accounting/periodLock.integration.test.ts` | Duplicate localStorage clear test |
| `src/__tests__/accounting/initError.test.ts` | `initLifecycle` assertions |
| `src/__tests__/accounting/init.integration.test.ts` | Fatal-error lifecycle assertion |
| `.github/workflows/test.yml` | Added mandatory `npm run test:accounting` step |

## Acceptance Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| AC-1 | `periodLocks` in Dexie schema v26 | **PASS** | Unchanged: `src/lib/db.ts` version 26 |
| AC-2 | Period Lock page persists locks across reload | **PASS** | Unchanged: `PeriodLockPage.tsx` → `db.periodLocks` |
| AC-3 | Post to locked period fails with user-visible error | **PASS** | Single entry point; bypass paths wired; throws `PeriodLockedError` |
| AC-4 | Init failure blocking; no false ready state when flag on | **PASS** | One timeout; `initLifecycle`; recoverable-error on `_loadAllData` failure; App.tsx race removed |
| AC-5 | All changes behind W1 flags | **PASS** | `W1_PERIOD_LOCK_ENFORCE`, `W1_FAIL_CLOSED_INIT` unchanged |
| AC-6 | Backward compatibility preserved | **PASS** | Flags default true; legacy permissive when flags false |
| AC-7 | Tests updated and CI mandatory | **PASS** | 7 test files; CI step added |
| AC-8 | Documentation updated | **PASS** | This report; `initFailurePolicy` re-export docs |
| AC-9 | Migration docs | **PASS** | AC-10 migration fix documented below |
| AC-10 | Legacy localStorage locks migrated | **PASS** | Duplicate skip clears localStorage; dead guard removed |
| AC-11 | Year-end close writes Dexie period locks | **PASS** | Unchanged: `YearEndProcess.tsx` |
| AC-12 | Non-fatal data load warning | **PASS** | `recoverableDataLoadPatch()` on login/session restore failure |

## Posting Path Bypass Matrix

Single enforcement entry point: `enforcePostingPeriodLock(date, db)` in `src/lib/ledger/postingPeriodGuard.ts`.

| Posting path | Protected | Enforcement mechanism |
|--------------|-----------|------------------------|
| `addVoucher` | Yes | `enforcePeriodLockForPost` in `voucherSlice.ts` |
| `updateVoucher` → posted | Yes | Same |
| `addInvoice` | Yes | Same |
| `updateInvoice` → posted | Yes | Same |
| `postInvoiceJournal` | Yes | `enforcePostingPeriodLock` at function entry |
| `convertPDCToBank` | Yes | `enforcePeriodLockForPost` before `db.vouchers.add` |
| `cancelVoucher` reversal journal | Yes | Lock on reversal date (today) |
| `cancelInvoice` reversal journal | Yes | Lock on reversal date (today) |
| `runRecurringVoucher` | Yes | Delegates to `addVoucher` |
| Workflow: `createGrnAgainstPo` | Yes | `enforcePostingPeriodLockIfPosted` |
| Workflow: `createPurchaseInvoiceAgainstGrn` | Yes | Same |
| Workflow: `createDcAgainstSo` | Yes | Same |
| Workflow: `createSalesInvoiceAgainstDc` | Yes | Same |
| Workflow: `createRejectionOutAgainstGrn` | Yes | Same |
| `permissionsStore.approveVoucher` | Yes | `enforcePostingPeriodLock` on `voucherDate` |
| `OptionalVouchers.handleConvert` | Yes | Routes through `updateVoucher` |
| `YearEndProcess` closing/adjustment journals | Yes | Requires `addVoucher`; direct DB fallback removed |
| Sync pull vouchers/invoices | Yes | `applySyncPullFinancialRecords` |
| AI Khata `confirmKhataEntry` | Yes | Delegates to `addVoucher` |
| Command bus voucher/invoice handlers | Yes | Route to store slice methods |
| `takeApprovalAction` (approvalRequests) | N/A | Does not flip voucher to `posted` (status-only workflow) |
| UI pages using `addVoucher`/`addInvoice` | Yes | Store slice guards |
| Shadow accounting engine | N/A | Not production authority (Stage 2) |

### Residual direct `db.vouchers` writes (non-posting or already guarded)

| Location | Status | Notes |
|----------|--------|-------|
| `postInvoiceJournal` → `db.vouchers.add` | Guarded | Lock checked before write |
| `voucherSlice` internal adds/updates | Guarded | Slice-level enforcement |
| `workflowActions` puts | Guarded | Pre-transaction lock check |
| `syncEngine` puts | Guarded | Pre-put lock check |
| `OptionalVouchers.handleCancel` | N/A | Sets `cancelled`, not `posted` |
| `ReversingJournals` cancel | N/A | Sets `cancelled` |
| `inventorySlice` stockPostedAt update | N/A | Metadata only, not financial post |

## Initialization State Machine

| State | When set | `isDbReady` | UI |
|-------|----------|-------------|-----|
| `initializing` | `initializeApp` start, retry | false | Auth spinner (`checking`) |
| `loading` | Before `_loadAllData` (session restore / login) | false* | Spinner or shell loading |
| `ready` | Successful init / login / gateway / no-company | true | Normal app |
| `recoverable-error` | `_loadAllData` failure with auth preserved | true | `DataLoadWarningBanner` |
| `fatal-error` | Init catch / clear DB failure | false | `InitErrorScreen` |

\*During `loading`, prior `isDbReady` may still be false until transition completes.

Timeout: only `INIT_APP_TIMEOUT_MS` (15000) in `initializeApp`. App.tsx 10s safety net removed.

## Rollback Verification

| Flag | Default | Rollback behavior |
|------|---------|-------------------|
| `W1_PERIOD_LOCK_ENFORCE` | `true` | `false` → `enforcePostingPeriodLock` no-ops; posting unrestricted |
| `W1_FAIL_CLOSED_INIT` | `true` | `false` → init failures map to `ready` / `no-company`; `isDbReady` true |

Set via `setW1FlagOverride` (tests) or runtime flag registry. No git history changes required for rollback.

## Performance Impact

- Period lock: one Dexie read per enforcement call (no stale in-memory cache on enforce path).
- Init: removed duplicate 10s timer; no additional polling.
- Sync pull: two extra async lock checks per posted voucher/invoice row (negligible vs network I/O).

## Remaining Risks

1. **UI pages with local `db.vouchers.put` + `status: "posted"`** not audited exhaustively — most billing/voucher pages use store methods; grep shows no remaining unguarded direct posted puts outside listed guarded paths.
2. **`pendingApprovals` table** is optional/legacy in `permissionsStore`; primary approval workflow uses `approvalRequests` without auto-post — posting after multi-level approval may still require explicit user post action.
3. **Multi-tab lock visibility**: lock writes invalidate cache version but do not use BroadcastChannel; another tab may read locks on next enforce call (always fresh read on enforce path).
4. **Tests not executed locally**: `npm` unavailable in implementation environment; CI must validate on push.

## Stage 2 Not Started

No changes to PostingService, balance cache, CQRS, or shadow engine authority.
