# Wave 1 Engineering Execution Plan

**Derived from:** `docs/WAVE1_SOLUTION_ARCHITECTURE.md`  
**Status:** Pre-implementation — no code changes yet  
**Date:** 2026-07-10  
**Scope:** FI-001 through FI-022 + W1-E01–E09

---

## 0. Program overview

| Metric | Estimate |
|--------|----------|
| **Total net new/modified LOC** | ~9,500–12,500 (excludes fixture JSON) |
| **Calendar time (1 senior + 1 mid)** | 6–8 weeks |
| **Calendar time (2 senior parallel)** | 4–5 weeks |
| **Dexie schema versions** | v26 (Stage 1), v27 (Stage 2), v28 optional (Stage 4) |
| **New npm scripts** | 4 (`test:accounting`, `test:accounting-golden`, `reconcile:balances`, `repair:invoice-stock`) |
| **Files to delete** | 0 in Wave 1 (1 file deprecated → delete post-v1) |

### Implementation principle

Wire the **legacy Zustand/Dexie write path** through new modules in `src/lib/ledger/`. Reuse read-only helpers from `src/domains/accounting-engine/` where they already exist (`doubleEntryValidator`, shadow `journalBuilder`) but do **not** enable shadow-only `postingEngine` for production until parity tests pass. Production authority remains Dexie until Wave 1 AC pass.

### Existing code to leverage (do not duplicate)

| Existing module | Use in Wave 1 |
|-----------------|---------------|
| `src/domains/accounting-engine/doubleEntryValidator.ts` | Wrap in `postingValidator.ts` |
| `src/domains/accounting-engine/periodLockService.ts` | Merge into `src/lib/ledger/periodLockService.ts` |
| `src/domains/accounting-engine/journalBuilder.ts` | Reference for invoice line shape; production builder in `invoiceJournalBuilder.ts` |
| `src/domains/accounting-engine/accountBalanceCalculator.ts` | Reference for aggregation math |
| `src/lib/accounting.ts` | `validateDoubleEntry`, `generateId` — keep; deprecate `compute*` helpers in Stage 5 |
| `src/lib/voucherNumbering.ts` | Extend for number series (FI-009) |

---

## 1. Global dependency ordering

```
Stage 1 (FI-022, FI-021, FI-008 partial)
    ↓
Stage 2 (FI-002, FI-003, FI-004, FI-007, FI-009, FI-010, FI-017, W1-E03)
    ↓
Stage 3 (FI-001, FI-006, FI-011, FI-012, FI-019, FI-020)  ←── can overlap Stage 4 after Stage 2
    ↓
Stage 4 (FI-013, FI-014, FI-015, FI-016, FI-018, FI-008 full)  ←── parallel with Stage 3 tail
    ↓
Stage 5 (FI-005, docs, CI gate, ESLint rules)
```

**Hard blockers:**
- FI-021 before FI-008 full enforcement
- FI-010 before FI-004 (journal builder needs COA roles)
- Stage 2 PostingService before Stage 3 LedgerEngine read cutover
- Stage 3 minimum before Stage 5 golden snapshots

---

## 2. Stage 1 — Safety & period control

**Issues:** FI-022, FI-021, FI-008 (partial — enforce lock on **post** only; cancel lock deferred to Stage 4)  
**Goal:** Fail-closed startup; `periodLocks` persisted in Dexie; posting blocked in locked periods.

### 2.1 Files to modify

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add Dexie **v26**: `periodLocks` table; export `DBPeriodLock` type |
| `src/store/index.ts` | Fix `initializeApp` catch (~L474–475): set `authStage: 'error'`, `isDbReady: false`; separate fatal init vs `_loadAllData` warning |
| `src/store/store.types.ts` | Add `AuthStage` value `'error'`; export init error type |
| `src/App.tsx` | Render `InitErrorScreen` when `authStage === 'error'`; block shell when `!isDbReady` |
| `src/store/slices/voucherSlice.ts` | Replace inline `enforceperiodLock` with import from `periodLockService`; ensure all **post** paths call it (addVoucher, addInvoice, updateVoucher post branch, convertPDCToBank) |
| `src/store/index.ts` | Call period lock in `postInvoiceJournal` entry |
| `src/pages/PeriodLockPage.tsx` | Confirm v26 table usage; add migration banner if localStorage locks detected |
| `src/pages/YearEndProcess.tsx` | Ensure year-end writes to Dexie `periodLocks` (not localStorage) |
| `src/platform/flags/registry.ts` | Register `W1_FAIL_CLOSED_INIT`, `W1_PERIOD_LOCK_ENFORCE` |
| `src/platform/flags/index.ts` | Export Wave 1 flag helpers `isW1FlagEnabled()` |
| `src/lib/periodLock.ts` | Mark `@deprecated`; add one-time import helper used by v26 upgrade |
| `src/domains/accounting-engine/periodLockService.ts` | Re-export from ledger service or delete duplicate after merge (Stage 1 merge) |

### 2.2 New files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/lib/ledger/periodLockService.ts` | `isLocked(date)`, `assertUnlocked(date)`, in-memory cache | 120 |
| `src/lib/ledger/index.ts` | Barrel export | 15 |
| `src/components/InitErrorScreen.tsx` | Retry / clear IndexedDB / support link | 90 |
| `src/components/DataLoadWarningBanner.tsx` | Non-fatal `_loadAllData` failure banner (W1-E08) | 60 |
| `scripts/migrate-period-locks-localStorage.ts` | One-shot: `sutra_period_locks` → Dexie | 80 |
| `src/__tests__/accounting/periodLock.test.ts` | Unit tests for lock service | 100 |

### 2.3 Files to delete

| File | When |
|------|------|
| *(none in Stage 1)* | — |
| `src/lib/periodLock.ts` | **Post-v1** after confirming zero localStorage usage (Stage 5 doc only) |

### 2.4 Database migrations

| Version | Table / change | Migration logic |
|---------|----------------|-----------------|
| **Dexie v26** | `periodLocks: 'id, companyId, periodKey, fiscalYear, lockedAt, isUnlocked'` | On upgrade: (1) create table; (2) run localStorage import if `sutra_period_locks` exists; (3) dedupe by `periodKey` |

**No PostgreSQL migration** in Wave 1 (offline-first; PG sync Wave 6).

### 2.5 Feature flags

| Flag | Default (Stage 1 ship) | Behavior when false |
|------|------------------------|---------------------|
| `W1_FAIL_CLOSED_INIT` | `true` | Legacy: `isDbReady: true` on init failure |
| `W1_PERIOD_LOCK_ENFORCE` | `true` | `enforceperiodLock` = no-op` |

### 2.6 Unit tests

| Test file | Cases |
|-----------|-------|
| `src/__tests__/accounting/periodLock.test.ts` | `isLocked` true/false; missing table → false when flag off; cache invalidation |
| `src/__tests__/accounting/initError.test.ts` | Mock init throw → `authStage === 'error'`; writes blocked |

### 2.7 Integration tests

| Test file | Cases |
|-----------|-------|
| `src/__tests__/accounting/periodLock.integration.test.ts` | Seed v26 DB → lock month → `addVoucher` throws; unlock → succeeds |
| `src/__tests__/accounting/init.integration.test.ts` | fake-indexeddb open failure → error screen state |

### 2.8 Golden accounting tests

None in Stage 1 (foundation only). Stub fixture directory:

```
scripts/golden-fixtures/wave1/.gitkeep
```

### 2.9 Rollback plan

1. Set `W1_PERIOD_LOCK_ENFORCE=false` in env / localStorage flag override.
2. Set `W1_FAIL_CLOSED_INIT=false` to restore permissive init.
3. Dexie v26 is **additive** — no downgrade required; locks simply unused if enforce off.
4. Redeploy previous build if error screen blocks all users (P0).

### 2.10 Verification commands

```bash
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Stage 1 unit tests (after vitest wired in Stage 5; run locally with tsx until then)
npx vitest run src/__tests__/accounting/periodLock.test.ts
npx vitest run src/__tests__/accounting/initError.test.ts

# Manual smoke
npm run dev
# 1. Period Lock page → lock current month → reload → lock persists
# 2. Try post journal in locked month → error toast
# 3. DevTools → block IndexedDB → reload → InitErrorScreen shown

# Grep guard
rg "isDbReady: true" src/store/index.ts   # should NOT appear in catch block when flag true
rg "periodLocks" src/lib/db.ts            # must show v26 schema
```

### 2.11 Estimates

| Dimension | Value |
|-----------|-------|
| **LOC (new + modified)** | ~850–1,100 |
| **Risk** | **Medium** — init error screen can block users with corrupt IDB; period lock may block legacy backdated posts |
| **Implementation time** | **3–5 engineer-days** (1 senior) |

### 2.12 Dependency ordering (within stage)

```
FI-022 (init error) ──┐
                      ├──► FI-021 (v26 schema + PeriodLockService)
FI-021 ───────────────┘
                      └──► FI-008 partial (wire lock on post paths)
```

### 2.13 Stage 1 acceptance checklist

- [ ] `periodLocks` in Dexie schema v26
- [ ] Period Lock page survives browser reload
- [ ] Post to locked period fails with user-visible error
- [ ] Init failure shows blocking screen; no silent `isDbReady: true`

---

## 3. Stage 2 — Posting kernel (write path)

**Issues:** FI-002, FI-003, FI-004, FI-007, FI-009, FI-010, FI-017, W1-E03  
**Goal:** All new postings through `PostingService`; no silent round-off; COA mapping; atomic PDC; stable numbering.

### 3.1 Files to modify

| File | Change |
|------|--------|
| `src/store/index.ts` | Extract `postInvoiceJournal`, `reverseInvoiceJournal`, `repostInvoiceJournalAndStock` logic to ledger modules; replace balance loops with `PostingService`; remove auto round-off block (~L2221–2241); W1-E03: `reverseInvoiceJournal` → reversal voucher pattern |
| `src/store/slices/voucherSlice.ts` | Route `addVoucher`, `updateVoucher`, `cancelVoucher`, `addInvoice`, `updateInvoice`, `cancelInvoice`, `convertPDCToBank` through `PostingService`; remove inline `accounts.update` balance loops (~L108, L155, L184, L239, L445, L716); use `documentGuard` |
| `src/components/invoice/SalesInvoiceForm.tsx` | Pre-post journal preview via `invoiceJournalBuilder`; call `validateDoubleEntry` before posted save |
| `src/lib/accounting.ts` | Deprecate `generateSerialNumberSync` for posting; keep for draft preview label only |
| `src/lib/voucherNumbering.ts` | Delegate to `NumberSeriesService` when flag on |
| `src/lib/db.ts` | Dexie **v27**: `numberSeriesCounters`, `accountRoleMappings` tables; optional `invoices.postingVersion` index |
| `src/lib/db.ts` | Extend `DBCompanySettings` / seed: `allowAutoRoundOff`, `roundOffAccountId`, `defaultAccounts` map |
| `src/lib/ekhata/confirmKhata.ts` | Use `CoaMappingService` instead of hardcoded `KH-*` (partial — full Khata in Stage 3) |
| `src/domains/accounting-engine/accountingPolicies.ts` | Align `allowAutoRoundOff` with company settings (single source) |
| `src/pages/AccountsConfiguration.tsx` | UI: Default Accounts / round-off policy (minimal) |
| `src/platform/flags/registry.ts` | Stage 2 flags (6 flags) |

### 3.2 New files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/lib/ledger/postingService.ts` | Single write entry: voucher + lines + balance cache + audit | 350 |
| `src/lib/ledger/balanceCache.ts` | `applyPostingDelta`, `applyReversalDelta` | 150 |
| `src/lib/ledger/postingValidator.ts` | Balance, period, fiscal year, party active stub | 120 |
| `src/lib/ledger/invoiceJournalBuilder.ts` | Pure journal from invoice; shared preview/post | 400 |
| `src/lib/ledger/coaMappingService.ts` | `AccountRole` enum + resolve + seed | 200 |
| `src/lib/ledger/numberSeriesService.ts` | Atomic counter in Dexie transaction | 130 |
| `src/lib/ledger/documentGuard.ts` | `assertEditableVoucher`, `assertEditableInvoice` | 80 |
| `src/lib/ledger/cancellationService.ts` | Reversal voucher builder (Stage 2: structure only; lock in Stage 4) | 150 |
| `src/lib/ledger/types.ts` | Shared posting types | 60 |
| `scripts/seed-account-role-mappings.ts` | Seed from existing COA | 100 |
| `scripts/seed-number-series-counters.ts` | Max-scan seed per FY/series | 80 |
| `scripts/reconcile-balances.ts` | FI-001/002 one-time reconciliation report | 150 |
| `src/__tests__/accounting/postingService.test.ts` | Unit | 200 |
| `src/__tests__/accounting/invoiceJournalBuilder.test.ts` | Unit | 180 |
| `src/__tests__/accounting/coaMapping.test.ts` | Unit | 100 |
| `src/__tests__/accounting/numberSeries.test.ts` | Unit | 120 |

### 3.3 Files to delete

| File | When |
|------|------|
| *(none)* | Inline functions removed from `index.ts` / `voucherSlice.ts`, not separate files |

### 3.4 Database migrations

| Version | Change | Migration |
|---------|--------|-----------|
| **Dexie v27** | `numberSeriesCounters: 'id, seriesKey, fiscalYear'` | Seed from `max(voucherNo)` / `max(invoiceNo)` per prefix |
| **Dexie v27** | `accountRoleMappings: 'id, role, accountId, companyId'` | Seed from seed COA IDs (`acc-sales`, etc.) |
| **Data job** | Balance reconciliation | Run `npm run reconcile:balances` post-deploy; log drift > ₹0.01 |

### 3.5 Feature flags

| Flag | Default | Stage 2 ship |
|------|---------|--------------|
| `W1_BALANCE_CACHE_WRITES` | `true` | Balance via `balanceCache.ts` |
| `W1_ALLOW_AUTO_ROUND_OFF` | `false` | Silent round-off off |
| `W1_COA_MAPPING` | `true` | Role-based accounts |
| `W1_NUMBER_SERIES` | `true` | Counter table |
| `W1_STRICT_INVOICE_VALIDATE` | `true` | Form preview validation |
| `W1_STRICT_POSTED_IMMUTABILITY` | `true` | Document guard |

### 3.6 Unit tests

| File | Coverage |
|------|----------|
| `postingService.test.ts` | Post, reverse delta, transaction rollback |
| `invoiceJournalBuilder.test.ts` | Sales/purchase/return/TDS line sets |
| `coaMapping.test.ts` | All roles resolve; fallback when flag off |
| `numberSeries.test.ts` | Sequential; no duplicate under parallel mock |
| `postingValidator.test.ts` | Unbalanced throws; round-off policy |
| `documentGuard.test.ts` | Posted doc blocked |

### 3.7 Integration tests

| File | Coverage |
|------|----------|
| `posting.integration.test.ts` | Post invoice → accounts cache updated; cancel reverses |
| `pdc.integration.test.ts` | FI-007: convertPDCToBank atomic — inject mid-failure |
| `roundOff.integration.test.ts` | FI-003: 0.02 imbalance fails; user roundOff succeeds |
| `reverseJournal.integration.test.ts` | W1-E03: reversal creates voucher, original intact |

### 3.8 Golden accounting tests

| Fixture | Scenario |
|---------|----------|
| `scripts/golden-fixtures/wave1/posting-kernel-minimal.json` | 5 invoices + 3 vouchers; Dr=Cr per doc |
| `src/__tests__/accounting/golden-posting-kernel.test.ts` | Snapshot journal lines per fixture |

### 3.9 Rollback plan

1. Per-flag revert (see §3.5) — each flag independently disables new path.
2. `W1_COA_MAPPING=false` → frozen hardcoded map in `coaMappingService.fallback.ts`.
3. `W1_BALANCE_CACHE_WRITES=false` → legacy inline balance in store (keep legacy functions behind flag for 1 release).
4. Run `reconcile-balances` after rollback to verify denorm consistency.

### 3.10 Verification commands

```bash
npx tsc --noEmit && npm run lint

npx vitest run src/__tests__/accounting/postingService.test.ts
npx vitest run src/__tests__/accounting/invoiceJournalBuilder.test.ts
npx vitest run src/__tests__/accounting/golden-posting-kernel.test.ts

# CI grep rule (add in Stage 5; run manually in Stage 2)
rg "accounts\.update\(.*balance" src/store src/lib --glob "!**/balanceCache.ts" 
# Expected: 0 matches when W1_BALANCE_CACHE_WRITES=true

rg "acc-sales|acc-purchase|acc-indirect-expenses" src/lib/ledger src/store --glob "!**/*.test.ts"
# Expected: 0 in posting code when W1_COA_MAPPING=true

npm run reconcile:balances -- --dry-run
# Expected: report with ≤0.01 drift or listed exceptions

npm run dev
# Post sales invoice → inspect Dexie vouchers + accounts.balance
# PDC convert → verify atomic (no orphan voucher)
```

### 3.11 Estimates

| Dimension | Value |
|-----------|-------|
| **LOC** | ~2,800–3,600 |
| **Risk** | **High** — touches god store posting paths; stricter validation may block users |
| **Implementation time** | **10–14 engineer-days** |

### 3.12 Dependency ordering (within stage)

```
FI-010 (COA mapping) ──► FI-004 (invoice builder + validate)
FI-003 (round-off) ─────► postingValidator
FI-009 (number series) ─┐
FI-002 (balance cache) ─┼──► postingService (core)
FI-017 (document guard) ┘
postingService ──► FI-007 (PDC)
postingService ──► W1-E03 (reverse pattern)
```

### 3.13 Stage 2 acceptance checklist

- [ ] Zero `accounts.update({ balance })` outside `balanceCache.ts` (when flag on)
- [ ] New posts use `PostingService`
- [ ] Imbalance > ₹0.01 rejected without user round-off
- [ ] PDC conversion atomic
- [ ] Reconciliation job ≤ ₹0.01 unexplained drift

---

## 4. Stage 3 — Ledger truth reads

**Issues:** FI-001, FI-006, FI-011, FI-012, FI-019, FI-020  
**Goal:** One read engine for balances and reports; invoice+stock saga; inventory policy.

### 4.1 Files to modify

| File | Change |
|------|--------|
| `src/store/index.ts` | `_loadAllData` (~L660–678): stop overwriting balances when `W1_USE_LINE_BALANCE_READS`; optional cache refresh only |
| `src/components/ChartOfAccounts.tsx` | Read balances via `LedgerEngine` |
| `src/pages/Dashboard.tsx` | Cash/bank totals via `LedgerEngine` |
| `src/pages/TrialBalance.tsx` | Replace inline aggregation with `FinancialReportEngine.computeTrialBalance` |
| `src/pages/ProfitLoss.tsx` | Use unified report engine |
| `src/pages/BalanceSheet.tsx` | Use unified report engine |
| `src/pages/Parties.tsx` | Outstanding via `PartySubledger` |
| `src/pages/PartyLedgerStatement.tsx` | Subledger reads |
| `src/pages/OutstandingReceivables.tsx` | Subledger reads |
| `src/pages/OutstandingManagement.tsx` | Subledger reads |
| `src/pages/AdvancedReportHub.tsx` | Balance aggregates via engine |
| `src/store/slices/voucherSlice.ts` | FI-006: replace `jnlExists` skip with `InvoicePostingSaga` |
| `src/store/index.ts` | `addPhysicalStock` (~L1078): fix status; route to `inventorySlice.postPhysicalStock` |
| `src/store/slices/inventorySlice.ts` | Centralize negative stock via `StockPostingService` |
| `src/lib/profitLossEngine.ts` | Thin wrapper → `FinancialReportEngine` or deprecate |
| `src/lib/balanceSheetEngine.ts` | Thin wrapper → `FinancialReportEngine` |
| `src/lib/accounting.ts` | Mark `computeTrialBalance` etc. `@deprecated` |
| `src/lib/ekhata/confirmKhata.ts` | Full COA role convergence (FI-010 completion) |
| `src/ai/rag/LedgerQueryHandler.ts` | Use `PartySubledger` / `LedgerEngine` |
| `src/ai/rag/BatchQueryHandler.ts` | Same |
| `src/ai/rag/ReminderQueryHandler.ts` | Same |
| `src/ai/intelligence/OverdueReceivableEngine.ts` | Same |
| `src/ai/intelligence/ProactiveAlertEngine.ts` | Same |
| `src/pages/Warehouses.tsx` or `src/pages/AccountsConfiguration.tsx` | Negative stock policy UI |
| `nios/docs/dexie-pg-canonical.md` | Add §Client Ledger Truth |

### 4.2 New files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/lib/ledger/ledgerEngine.ts` | `getAccountBalance`, `aggregateByAccount`, `getAllBalances` | 280 |
| `src/lib/ledger/partySubledger.ts` | `getOutstanding(partyId)`, bill-wise + lines | 220 |
| `src/lib/ledger/invoicePostingSaga.ts` | Idempotent post; repair partial journal/stock | 250 |
| `src/lib/ledger/stockPostingService.ts` | Negative stock policy enforcement | 100 |
| `src/lib/reports/financialReportEngine.ts` | TB, P&L, BS unified | 450 |
| `src/lib/reports/reportTypes.ts` | Shared report DTOs | 80 |
| `scripts/repair-invoice-stock.ts` | Find partial posts; run repost | 120 |
| `scripts/repair-physical-stock-status.ts` | DRAFT→POSTED repair | 60 |
| `src/__tests__/accounting/ledgerEngine.test.ts` | Unit | 180 |
| `src/__tests__/accounting/partySubledger.test.ts` | Unit | 150 |
| `src/__tests__/accounting/invoicePostingSaga.test.ts` | Integration | 200 |
| `src/__tests__/accounting/financialReportEngine.test.ts` | Unit | 250 |
| `src/__tests__/accounting/golden-wave1.test.ts` | Full golden suite (expanded in Stage 5) | 400 |

### 4.3 Files to delete

| File | When |
|------|------|
| *(none)* | Keep `profitLossEngine.ts` / `balanceSheetEngine.ts` as thin wrappers until Stage 5 |

### 4.4 Database migrations

| Job | Purpose |
|-----|---------|
| `repair-invoice-stock` | FI-006: invoices with `jnl-*` but missing stock movements |
| `repair-physical-stock-status` | FI-019: physical stock DRAFT with movements |
| Party cache refresh | Recompute `parties.balance` from subledger (cache only) |
| Optional Dexie v28 | `invoices.postingVersion`, `invoices.postingChecksum` indexed fields |

No breaking schema change required if posting metadata stored on existing invoice records.

### 4.5 Feature flags

| Flag | Default |
|------|---------|
| `W1_USE_LINE_BALANCE_READS` | `true` |
| `W1_UNIFIED_REPORT_ENGINE` | `true` |
| `W1_PARTY_SUBLEDGER_READS` | `true` |
| `W1_INVOICE_POSTING_SAGA` | `true` |
| `W1_ENFORCE_NEGATIVE_STOCK` | `true` |

### 4.6 Unit tests

| File | Coverage |
|------|----------|
| `ledgerEngine.test.ts` | Balance = sum(lines); as-at date; opening balance |
| `partySubledger.test.ts` | Invoice outstanding + voucher lines |
| `financialReportEngine.test.ts` | TB/P&L/BS row totals |
| `stockPostingService.test.ts` | Negative blocked/allowed |

### 4.7 Integration tests

| File | Coverage |
|------|----------|
| `invoicePostingSaga.integration.test.ts` | FI-006: orphaned jnl → stock repaired |
| `readPathParity.integration.test.ts` | FI-001: account list = TB = engine |
| `reportTieOut.integration.test.ts` | FI-012: BS equity tie to P&L |
| `khataParty.integration.test.ts` | FI-011: khata confirm → party outstanding |

### 4.8 Golden accounting tests

| Fixture | Coverage |
|---------|----------|
| `scripts/golden-fixtures/wave1/mixed-100-vouchers.json` | FI-001, FI-012, W1-E07 (`jnl-*` in TB) |
| `scripts/golden-fixtures/wave1/fy-2081-82-snapshot.json` | Expected TB/P&L/BS totals |
| `scripts/golden-fixtures/wave1/invoice-stock-saga.json` | FI-006 draft→posted edge |
| `scripts/golden-fixtures/wave1/khata-party-outstanding.json` | FI-011 |

### 4.9 Rollback plan

1. `W1_USE_LINE_BALANCE_READS=false` → UI reads `accounts.balance` again (cache kept warm by Stage 2).
2. `W1_UNIFIED_REPORT_ENGINE=false` → pages call legacy engines.
3. `W1_PARTY_SUBLEDGER_READS=false` → `party.balance` field.
4. `W1_INVOICE_POSTING_SAGA=false` → legacy jnlExists path (document known bug).
5. Repair scripts are idempotent — safe to re-run after rollback.

### 4.10 Verification commands

```bash
npx vitest run src/__tests__/accounting/ledgerEngine.test.ts
npx vitest run src/__tests__/accounting/financialReportEngine.test.ts
npx vitest run src/__tests__/accounting/golden-wave1.test.ts

npm run repair:invoice-stock -- --dry-run
npm run repair:physical-stock-status -- --dry-run

npm run dev
# Cross-check: Chart of Accounts total = Trial Balance = Dashboard cash (±0.01)
# Edit posted invoice with items → stock reposted
# Oversell with allowNegativeStock=false → blocked
```

### 4.11 Estimates

| Dimension | Value |
|-----------|-------|
| **LOC** | ~3,200–4,200 |
| **Risk** | **High** — report numbers may shift; user-visible balance changes |
| **Implementation time** | **12–16 engineer-days** |

### 4.12 Dependency ordering (within stage)

```
FI-002 balance cache (Stage 2) ──► FI-001 LedgerEngine reads
LedgerEngine ──► FI-012 FinancialReportEngine
LedgerEngine + FI-010 ──► FI-011 PartySubledger
PostingService (Stage 2) ──► FI-006 InvoicePostingSaga
FI-019 physical stock fix ──► FI-020 negative stock policy
```

### 4.13 Stage 3 acceptance checklist

- [ ] TB = account list = P&L/BS inputs ± ₹0.01
- [ ] `jnl-*` vouchers included in TB (W1-E07)
- [ ] Invoice with items always has stock movements
- [ ] Party outstanding matches bill-wise report
- [ ] Khata uses same COA roles as ERP

---

## 5. Stage 4 — Governance & edge hardening

**Issues:** FI-013, FI-014, FI-015, FI-016, FI-018, FI-008 (full)  
**Goal:** Audit visibility; voucher integrity; banking atomicity; cancel lock + reversal date policy.

### 5.1 Files to modify

| File | Change |
|------|--------|
| `src/store/slices/voucherSlice.ts` | FI-014: full voucher replace on update; FI-013: audit via `AuditService`; FI-008: cancel calls `CancellationService` + period lock |
| `src/store/index.ts` | FI-013: audit in `postInvoiceJournal` path |
| `src/lib/ledger/cancellationService.ts` | Full implementation: reversal date policy, period lock |
| `src/lib/ledger/postingValidator.ts` | FI-015: `assertPartyActive` |
| `src/components/invoice/SalesInvoiceForm.tsx` | FI-016: replace `Math.random()` line ids with `generateId()`; FI-015: check `party.isActive` |
| `src/pages/BankReconciliation.tsx` | FI-018: wrap reco voucher save in Dexie transaction |
| `src/pages/AutoBankReconciliation.tsx` | Audit banking writes (launch scope: read-only or minimal) |
| `src/pages/PDCSummary.tsx` | Verify uses transactional convert from Stage 2 |
| `src/pages/AccountsConfiguration.tsx` | Reversal date policy setting |
| `src/lib/db.ts` | Optional v28: `auditFailures` table |
| `src/store/store.types.ts` | Company setting: `reversalDatePolicy`, `auditFailPolicy` |

### 5.2 New files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/lib/ledger/auditService.ts` | `log(event)` → toast on failure | 90 |
| `src/lib/ledger/bankingPostingService.ts` | Transactional banking batch helper | 150 |
| `src/lib/ledger/masterDataValidator.ts` | `assertPartyActive` | 50 |
| `src/__tests__/accounting/cancellationService.test.ts` | Unit | 120 |
| `src/__tests__/accounting/auditService.test.ts` | Unit | 80 |
| `src/__tests__/accounting/banking.integration.test.ts` | FI-018 | 150 |
| `src/__tests__/accounting/cancelPeriodLock.integration.test.ts` | FI-008 full | 100 |

### 5.3 Files to delete

| File | When |
|------|------|
| *(none)* | — |

### 5.4 Database migrations

| Version | Change |
|---------|--------|
| **Dexie v28** (optional) | `auditFailures: 'id, timestamp, eventType, payload'` |
| **Company settings** | Add `reversalDatePolicy`, `auditFailPolicy` fields (no version bump if JSON blob) |

### 5.5 Feature flags

| Flag | Default |
|------|---------|
| `W1_STRICT_CANCEL_LOCK` | `true` |
| `W1_INACTIVE_PARTY_BLOCK` | `true` |

### 5.6 Unit tests

| File | Coverage |
|------|----------|
| `cancellationService.test.ts` | Original vs today reversal date; lock rejection |
| `auditService.test.ts` | Failure → result object; warn policy |
| `masterDataValidator.test.ts` | Inactive party throws |

### 5.7 Integration tests

| File | Coverage |
|------|----------|
| `cancelPeriodLock.integration.test.ts` | Lock period → cancel fails |
| `banking.integration.test.ts` | Bank reco save atomic |
| `voucherUpdate.integration.test.ts` | FI-014: lines persist after reload |
| `inactiveParty.integration.test.ts` | FI-015: post blocked |

### 5.8 Golden accounting tests

| Fixture | Coverage |
|---------|----------|
| `scripts/golden-fixtures/wave1/cancel-locked-period.json` | FI-008 |
| `scripts/golden-fixtures/wave1/voucher-update-lines.json` | FI-014 |

Add cases to `golden-wave1.test.ts`.

### 5.9 Rollback plan

1. `W1_STRICT_CANCEL_LOCK=false` → cancel without lock check (emergency).
2. `W1_INACTIVE_PARTY_BLOCK=false` → allow inactive party posts.
3. Audit service failure policy revert to silent catch (not recommended).

### 5.10 Verification commands

```bash
npx vitest run src/__tests__/accounting/cancellationService.test.ts
npx vitest run src/__tests__/accounting/cancelPeriodLock.integration.test.ts
npx vitest run src/__tests__/accounting/banking.integration.test.ts

npm run dev
# Lock period → cancel invoice → must fail
# Deactivate party → post invoice → must fail
# Mock audit write failure → toast visible
# Edit voucher lines → reload → lines match
```

### 5.11 Estimates

| Dimension | Value |
|-----------|-------|
| **LOC** | ~1,200–1,700 |
| **Risk** | **Medium** — stricter cancel may surprise users |
| **Implementation time** | **5–7 engineer-days** |

### 5.12 Dependency ordering (within stage)

```
FI-021 (Stage 1) ──► FI-008 full (cancel lock)
CancellationService (Stage 2 stub) ──► FI-008 full
PostingService (Stage 2) ──► FI-013, FI-015
FI-007 (Stage 2) ──► FI-018 banking
```

### 5.13 Stage 4 acceptance checklist

- [ ] Cancel/reversal blocked in locked period
- [ ] Reversal date policy documented and enforced
- [ ] Audit failure surfaces toast
- [ ] Voucher update persists full line set
- [ ] Inactive party blocked at service layer
- [ ] New invoice lines use `generateId()`

---

## 6. Stage 5 — Certification (CI gate & documentation)

**Issues:** FI-005, SSOT docs, ESLint/CI guards, soft deprecation cleanup  
**Goal:** Wave 1 formally complete; regressions caught in CI.

### 6.1 Files to modify

| File | Change |
|------|--------|
| `package.json` | Add scripts: `test:accounting`, `test:accounting-golden`, `reconcile:balances`, `repair:invoice-stock` |
| `.github/workflows/test.yml` | Add `accounting-golden` job when `W1_GOLDEN_CI` |
| `.github/workflows/test.yml` | Add grep step: no direct balance writes |
| `src/platform/flags/registry.ts` | `W1_GOLDEN_CI` |
| `eslint.config.js` (or `.eslintrc`) | Rule: ban `accounts.update` with balance outside balanceCache |
| `nios/docs/dexie-pg-canonical.md` | Final SSOT § (if not done Stage 3) |
| `docs/WAVE1_SOLUTION_ARCHITECTURE.md` | Mark implemented sections |
| `src/lib/profitLossEngine.ts` | `@deprecated` JSDoc |
| `src/lib/balanceSheetEngine.ts` | `@deprecated` JSDoc |
| `src/lib/accounting.ts` | `@deprecated` on duplicate compute helpers |

### 6.2 New files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `vitest.config.ts` | fake-indexeddb setup | 40 |
| `src/__tests__/accounting/setup.ts` | Test DB bootstrap | 80 |
| `src/__tests__/accounting/golden-wave1.test.ts` | Complete if not finished Stage 3 | 400 |
| `src/__tests__/accounting/golden-period-lock.test.ts` | FI-021 |
| `src/__tests__/accounting/golden-round-off.test.ts` | FI-003 |
| `src/__tests__/accounting/golden-number-series.test.ts` | FI-009 |
| `scripts/ci/accounting-invariant-grep.sh` | CI grep rules | 40 |
| `docs/WAVE1_VERIFICATION_CHECKLIST.md` | Manual QA script for CAs | 150 |
| `scripts/golden-fixtures/wave1/*.json` | All fixtures (6–8 files) | ~2,000 JSON |

### 6.3 Files to delete

| File | When |
|------|------|
| `src/lib/periodLock.ts` | Only after telemetry shows 0 localStorage reads for 2 releases |

### 6.4 Database migrations

None.

### 6.5 Feature flags

| Flag | Default |
|------|---------|
| `W1_GOLDEN_CI` | `true` (required on main) |

Wire alias: `MIGRATION_GOLDEN_CI` → delegates to `W1_GOLDEN_CI` for backward compat.

### 6.6 Unit tests

All prior stage unit tests — must pass in aggregate.

### 6.7 Integration tests

Full suite:

```bash
npx vitest run src/__tests__/accounting/
```

### 6.8 Golden accounting tests (complete matrix)

| Test file | FI coverage |
|-----------|-------------|
| `golden-wave1.test.ts` | FI-001, FI-002, FI-006, FI-011, FI-012, W1-E07 |
| `golden-posting-kernel.test.ts` | FI-002, FI-003, FI-004, FI-010 |
| `golden-period-lock.test.ts` | FI-021, FI-008 |
| `golden-round-off.test.ts` | FI-003 |
| `golden-number-series.test.ts` | FI-009 |
| `cancelPeriodLock.integration.test.ts` | FI-008 |
| `pdc.integration.test.ts` | FI-007 |
| `invoicePostingSaga.integration.test.ts` | FI-006 |

### 6.9 Rollback plan

1. Set `W1_GOLDEN_CI=false` → CI job advisory only (temporary).
2. Do **not** disable production flags — only CI gate rollback.
3. Keep golden fixtures in repo for local verification.

### 6.10 Verification commands

```bash
# Full Wave 1 verification suite
npm run test:accounting-golden

# Individual
npm run test:accounting
npx vitest run src/__tests__/accounting/ --coverage

# CI invariant grep
bash scripts/ci/accounting-invariant-grep.sh

# Type + lint
npx tsc --noEmit && npm run lint

# Manual reconciliation on pilot export
npm run reconcile:balances -- --company-id=<id> --export=./pilot.json

# Re-audit checklist
# docs/WAVE1_VERIFICATION_CHECKLIST.md — all items PASS
```

### 6.11 Estimates

| Dimension | Value |
|-----------|-------|
| **LOC** | ~1,500–2,000 (mostly tests + fixtures) |
| **Risk** | **Low** — test/CI only; golden snapshots may need baseline tuning |
| **Implementation time** | **5–8 engineer-days** |

### 6.12 Dependency ordering (within stage)

```
Stages 1–3 complete ──► golden fixtures stable
Golden fixtures ──► CI job
CI job ──► WAVE1_VERIFICATION_CHECKLIST sign-off
```

### 6.13 Stage 5 acceptance checklist

- [ ] `npm run test:accounting-golden` green locally and on CI
- [ ] `accounting-invariant-grep.sh` passes
- [ ] All FI-001–FI-022 AC pass on re-audit
- [ ] SSOT doc updated
- [ ] Pilot reconciliation zero unexplained drift > ₹0.01

---

## 7. Cross-stage summary tables

### 7.1 Issues by implementation layer

| Layer | Issues |
|-------|--------|
| **DB migration** | FI-021 (v26), FI-009 (v27 counters), FI-010 (v27 mappings), FI-006/FI-019 (repair scripts), FI-028 optional auditFailures |
| **API / service** | All FI — internal TypeScript services in `src/lib/ledger/` |
| **UI** | FI-022, FI-004, FI-010, FI-012, FI-015, FI-016, FI-020, FI-021, FI-008 |
| **Accounting engine** | FI-001–004, FI-006–011, FI-017–020, W1-E03 |
| **Report engine** | FI-001, FI-012 |
| **AI** | FI-011 (RAG handlers), FI-010 (Khata COA) |
| **Sync** | FI-016 (stable line IDs — prep only) |
| **Feature flags** | All W1_* flags (16 total) |

### 7.2 Issues solvable together (by stage)

| Stage | Bundle |
|-------|--------|
| 1 | FI-022 + FI-021 + FI-008 partial |
| 2 | FI-002 + FI-003 + FI-004 + FI-007 + FI-009 + FI-010 + FI-017 + W1-E03 |
| 3 | FI-001 + FI-006 + FI-011 + FI-012 + FI-019 + FI-020 |
| 4 | FI-013 + FI-014 + FI-015 + FI-016 + FI-018 + FI-008 full |
| 5 | FI-005 + docs + CI |

### 7.3 Program-level estimates

| Stage | LOC | Risk | Duration (1 senior) | Can ship alone? |
|-------|-----|------|---------------------|-----------------|
| 1 | 850–1,100 | Medium | 3–5 days | Yes |
| 2 | 2,800–3,600 | **High** | 10–14 days | Yes (flags) |
| 3 | 3,200–4,200 | **High** | 12–16 days | Yes (flags) |
| 4 | 1,200–1,700 | Medium | 5–7 days | Yes |
| 5 | 1,500–2,000 | Low | 5–8 days | Yes |
| **Total** | **9,550–12,600** | — | **35–50 days** | — |

### 7.4 Recommended team split (parallel)

| Engineer A | Engineer B |
|------------|------------|
| Stage 1 → Stage 2 PostingService core | Stage 5 vitest scaffold early (week 1) |
| Stage 2 completion | Stage 3 FinancialReportEngine |
| Stage 4 cancel/audit | Stage 3 PartySubledger + AI handler updates |
| Stage 5 CI integration | Stage 4 banking |

---

## 8. npm scripts to add (Stage 5)

```json
{
  "test:accounting": "vitest run src/__tests__/accounting/",
  "test:accounting-golden": "vitest run src/__tests__/accounting/golden-*.test.ts src/__tests__/accounting/golden-wave1.test.ts",
  "reconcile:balances": "npx tsx scripts/reconcile-balances.ts",
  "repair:invoice-stock": "npx tsx scripts/repair-invoice-stock.ts"
}
```

**Dependencies to add:** `vitest`, `fake-indexeddb` (devDependencies).

---

## 9. CI workflow addition (Stage 5)

```yaml
# .github/workflows/test.yml — add job
accounting-golden:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: npm
    - run: npm ci
    - run: npm run test:accounting-golden
    - run: bash scripts/ci/accounting-invariant-grep.sh
```

Gate merge on `accounting-golden` when `W1_GOLDEN_CI=true`.

---

## 10. Risk register (engineering)

| ID | Risk | Stage | Mitigation |
|----|------|-------|------------|
| R1 | God store regression | 2 | Feature flags; golden tests; incremental extraction |
| R2 | Report number shift | 3 | Golden snapshots; release notes; pilot validation |
| R3 | Period lock blocks legitimate posts | 1, 4 | Admin unlock PIN; `W1_PERIOD_LOCK_ENFORCE` emergency off |
| R4 | COA mapping wrong | 2 | Settings UI; seed validation; golden per role |
| R5 | Duplicate stock on saga repair | 3 | Reverse-before-repost; idempotent checksum |
| R6 | Vitest + Dexie flakiness | 5 | fake-indexeddb; isolated DB per test |
| R7 | Team bypasses PostingService | 2, 5 | ESLint + CI grep |
| R8 | Init error screen false positive | 1 | Retry + clear cache; support runbook |

---

## 11. Definition of done (Wave 1 engineering)

1. All 5 stages deployed with flags defaulting to target state.
2. `npm run test:accounting-golden` green.
3. `scripts/ci/accounting-invariant-grep.sh` passes.
4. Dexie at v27+ in production.
5. `docs/WAVE1_VERIFICATION_CHECKLIST.md` signed by engineering + CA pilot.
6. No launch-scope file reads stale balance without cache invalidation path documented.

---

*End of Wave 1 Engineering Execution Plan. No application code modified.*
