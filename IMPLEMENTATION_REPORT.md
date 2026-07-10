# Wave 1 Stage 1 — Implementation Report

**Date:** 2026-07-10  
**Scope:** FI-022, FI-021, FI-008 (partial — post-only period lock)  
**Reference:** `docs/WAVE1_ENGINEERING_PLAN.md` §2

> **Hotfix update (2026-07-10):** Stage 1 hotfixes applied per `docs/WAVE1_STAGE1_HOTFIX_REPORT.md` — single `enforcePostingPeriodLock` entry point, init lifecycle state machine, bypass path wiring, integration tests, CI gate. Target: 12/12 acceptance criteria PASS.

---

## 1. Summary

Stage 1 delivers fail-closed application startup (behind `W1_FAIL_CLOSED_INIT`), authoritative Dexie `periodLocks` storage (schema v26), and period lock enforcement on all **posting** entry points (behind `W1_PERIOD_LOCK_ENFORCE`), including reversal journals created by cancel flows (hotfix).

All behavior is backward compatible via feature flags defaulting to **on**, with legacy fallbacks when flags are disabled.

---

## 2. Modified files

| File | Change |
|------|--------|
| `src/lib/db.ts` | Added `DBPeriodLock` type, `periodLocks` table on class, Dexie **v26** with legacy localStorage import upgrade |
| `src/lib/periodLock.ts` | Deprecated localStorage API; added `importLegacyPeriodLocksIntoDexie`, `hasLegacyPeriodLocksInLocalStorage` |
| `src/lib/ledger/periodLockService.ts` | **New** — `isDateLocked`, `assertPeriodUnlockedForPosting`, cache, flag gating |
| `src/lib/ledger/initFailurePolicy.ts` | **New** — `resolveInitFailureState`, `DATA_LOAD_WARNING_MESSAGE` |
| `src/lib/ledger/index.ts` | **New** — barrel exports |
| `src/platform/flags/w1Registry.ts` | **New** — `W1_FAIL_CLOSED_INIT`, `W1_PERIOD_LOCK_ENFORCE` |
| `src/platform/flags/index.ts` | Export Wave 1 flag helpers |
| `src/domains/accounting-engine/periodLockService.ts` | Re-export ledger service for domain/shadow pipeline |
| `src/store/store.types.ts` | `AuthStage: 'error'`, `InitErrorState`, `initError`, `dataLoadWarning`, retry actions |
| `src/store/index.ts` | Fail-closed init catch, retry/clear DB, data-load warning on login/session, `postInvoiceJournal` lock |
| `src/store/slices/voucherSlice.ts` | Ledger period lock on post paths; `updateInvoice` lock when posting |
| `src/App.tsx` | `InitErrorScreen` for `authStage === 'error'`; timeout safety net respects W1 flag |
| `src/components/InitErrorScreen.tsx` | **New** — retry / clear local DB / reload |
| `src/components/DataLoadWarningBanner.tsx` | **New** — non-fatal `_loadAllData` warning (W1-E08) |
| `src/components/Layout.tsx` | Renders `DataLoadWarningBanner` |
| `src/pages/PeriodLockPage.tsx` | Legacy migration banner; cache invalidation; active-lock filtering |
| `src/pages/YearEndProcess.tsx` | Writes all FY months to Dexie `periodLocks` on year-end lock |
| `package.json` | `test:accounting` script; `vitest`, `fake-indexeddb` devDependencies |
| `vitest.config.ts` | **New** — accounting test runner |
| `nios/docs/dexie-pg-canonical.md` | Period locks § + enforcement notes |
| `docs/WAVE1_DEXIE_MIGRATION.md` | **New** — v26 migration documentation |

---

## 3. New files (tests & tooling)

| File | Purpose |
|------|---------|
| `src/__tests__/accounting/setup.ts` | `fake-indexeddb` bootstrap |
| `src/__tests__/accounting/periodLock.test.ts` | Unit tests — lock service |
| `src/__tests__/accounting/initError.test.ts` | Unit tests — init failure policy |
| `src/__tests__/accounting/periodLock.integration.test.ts` | Integration — legacy import + enforce |
| `src/__tests__/accounting/init.integration.test.ts` | Integration — default flags + fail-closed |
| `src/__tests__/accounting/testHarness.ts` | Shared accounting test DB/store seed |
| `src/__tests__/accounting/postingPaths.integration.test.ts` | Integration — store/workflow/sync/AI posting paths |
| `src/__tests__/accounting/initLifecycle.integration.test.ts` | Integration — init lifecycle + single timeout |
| `src/lib/ledger/postingPeriodGuard.ts` | **Hotfix** — `PeriodLockedError`, single enforce entry point |
| `src/lib/ledger/initLifecycle.ts` | **Hotfix** — init state machine, `INIT_APP_TIMEOUT_MS` |
| `docs/WAVE1_STAGE1_HOTFIX_REPORT.md` | **Hotfix** — bypass matrix, AC status, rollback |
| `.github/workflows/test.yml` | **Hotfix** — mandatory `npm run test:accounting` |
| `scripts/migrate-period-locks-localStorage.ts` | Operator script / documentation |
| `scripts/golden-fixtures/wave1/.gitkeep` | Golden fixture directory stub (Stage 5) |

---

## 4. Deleted files

None (per Stage 1 plan).

---

## 5. Feature flags

| Flag | Default | Env override |
|------|---------|--------------|
| `W1_FAIL_CLOSED_INIT` | `true` | `VITE_W1_FAIL_CLOSED_INIT=false` |
| `W1_PERIOD_LOCK_ENFORCE` | `true` | `VITE_W1_PERIOD_LOCK_ENFORCE=false` |

Registered in `src/platform/flags/w1Registry.ts`. Helpers: `isW1FlagEnabled`, `setW1FlagOverride` (tests).

---

## 6. Database migration

- **Dexie v26:** `periodLocks` table
- **Auto-import:** `localStorage.sutra_period_locks` → Dexie on upgrade
- **Documentation:** `docs/WAVE1_DEXIE_MIGRATION.md`

---

## 7. Posting paths with period lock (FI-008 partial)

| Path | File | Enforced |
|------|------|----------|
| `addVoucher` (posted) | `voucherSlice.ts` | Yes |
| `updateVoucher` (→ posted) | `voucherSlice.ts` | Yes |
| `addInvoice` (posted) | `voucherSlice.ts` | Yes |
| `updateInvoice` (→ posted) | `voucherSlice.ts` | Yes |
| `postInvoiceJournal` | `store/index.ts` | Yes |
| `convertPDCToBank` | `voucherSlice.ts` | Yes |
| `cancelVoucher` / `cancelInvoice` | `voucherSlice.ts` | **No** (Stage 4) |

---

## 8. Tests

| Suite | File | Cases |
|-------|------|-------|
| Unit | `periodLock.test.ts` | 7 |
| Unit | `initError.test.ts` | 3 |
| Integration | `periodLock.integration.test.ts` | 2 |
| Integration | `init.integration.test.ts` | 2 |

**Run:**

```bash
npm install
npm run test:accounting
npx tsc --noEmit
npm run lint
```

---

## 9. Rollback

1. `VITE_W1_PERIOD_LOCK_ENFORCE=false` — skip posting lock checks (data remains in Dexie).
2. `VITE_W1_FAIL_CLOSED_INIT=false` — init failure returns to legacy `no-company` + `isDbReady: true`.
3. Dexie v26 is additive; no schema downgrade required.

---

## 10. Acceptance criteria — Stage 1 checklist

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| AC-1 | `periodLocks` in Dexie schema v26 | **PASS** | `src/lib/db.ts` `version(26)` |
| AC-2 | Period Lock page persists locks across reload | **PASS** | Dexie-backed `PeriodLockPage`; v26 table |
| AC-3 | Post to locked period fails with user-visible error | **PASS** | `assertPeriodUnlockedForPosting` throws; voucher/invoice paths propagate to UI toast |
| AC-4 | Init failure shows blocking screen; no silent `isDbReady: true` when flag on | **PASS** | `resolveInitFailureState` + `InitErrorScreen`; catch block uses policy |
| AC-5 | All changes behind feature flags | **PASS** | `w1Registry.ts`; legacy when flags false |
| AC-6 | Backward compatibility preserved | **PASS** | Flags off = legacy init + no lock enforce; v26 additive |
| AC-7 | Tests updated | **PASS** | 4 test files under `src/__tests__/accounting/` |
| AC-8 | Documentation updated | **PASS** | `WAVE1_DEXIE_MIGRATION.md`, `dexie-pg-canonical.md`, this report |
| AC-9 | Migration docs updated | **PASS** | `docs/WAVE1_DEXIE_MIGRATION.md` |
| AC-10 | Legacy localStorage locks migrated | **PASS** | v26 upgrade + Period Lock import banner |
| AC-11 | Year-end close writes Dexie period locks | **PASS** | `YearEndProcess.tsx` `confirmLockFY` |
| AC-12 | Non-fatal data load warning (W1-E08) | **PASS** | `DataLoadWarningBanner` + login/session restore |

---

## 11. Issue traceability

| Issue | Implementation |
|-------|----------------|
| **FI-021** | Dexie v26, `DBPeriodLock`, legacy import, Period Lock / Year-end UI |
| **FI-022** | `initFailurePolicy`, `InitErrorScreen`, retry/clear DB, login `_loadAllData` banner |
| **FI-008** (partial) | Post-only `assertPeriodUnlockedForPosting` on voucher/invoice/PDC/journal paths |

---

## 12. Out of scope (later stages)

- PostingService / balance cache (Stage 2)
- Cancel/reversal period lock (Stage 4)
- Golden accounting CI gate (Stage 5)
- Deletion of `src/lib/periodLock.ts` (post-v1)

---

*Stage 1 implementation complete.*
