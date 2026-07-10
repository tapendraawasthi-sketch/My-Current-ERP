# Wave 1 Stage 1 — Independent Verification Report

**Role:** Independent QA Architect  
**Date:** 2026-07-10  
**Method:** First-principles code audit (no runtime execution — `npm`/`vitest` unavailable in audit environment)  
**Inputs:** `IMPLEMENTATION_REPORT.md`, `docs/WAVE1_ENGINEERING_PLAN.md`, full-repository static analysis  
**Code state:** Post Stage 1 implementation  

---

## 1. Executive verdict

| Dimension | Verdict |
|-----------|---------|
| **Stage 1 overall** | **PARTIAL PASS** — foundation is real but not complete or airtight |
| **Safe to claim “Stage 1 done”** | **No** — period-lock coverage has material bypasses; init fail-closed has race/partial-load gaps |
| **Safe to ship with flags ON (production)** | **Conditional** — acceptable only with documented bypass list and pilot scope cut |
| **Wave 1 / launch financial integrity** | **Not achieved** — Stages 2–5 and most FI items remain open |

Stage 1 delivered **genuine** Dexie v26 schema, a centralized lock service, fail-closed init **policy**, and tests **in source**. Static analysis shows **significant gaps** between the implementation report’s PASS claims and enforceable behavior across the full mutation surface.

---

## 2. Acceptance criteria audit (`IMPLEMENTATION_REPORT.md` §10)

| ID | Criterion | Report | **QA verdict** | Evidence / reason |
|----|-----------|--------|----------------|-------------------|
| **AC-1** | `periodLocks` in Dexie schema v26 | PASS | **PASS** | `src/lib/db.ts`: `periodLocks!: Table<DBPeriodLock>`, `version(26).stores({ periodLocks: "id, companyId, periodKey, fiscalYear, lockedAt, isUnlocked" })` |
| **AC-2** | Period Lock page persists locks across reload | PASS | **PASS** (with caveat) | `PeriodLockPage.tsx` reads/writes `db.periodLocks`. **Caveat:** on DB not yet at v26, `.catch(() => [])` hides errors — empty UI until upgrade completes |
| **AC-3** | Post to locked period fails with user-visible error | PASS | **FAIL** | Primary `addVoucher` / `addInvoice` paths enforce via `assertPeriodUnlockedForPosting`. **Many bypass paths** post journals without lock (§7). UI toast depends on caller `try/catch` — not verified uniformly |
| **AC-4** | Init failure → blocking screen; no silent `isDbReady: true` when flag on | PASS | **PARTIAL FAIL** | `initializeApp` catch uses `resolveInitFailureState` correctly. **Gaps:** (1) 10s `App.tsx` safety net races with 15s init timeout (§6); (2) session restore / login still set `isDbReady: true` after `_loadAllData` failure (§5) |
| **AC-5** | All changes behind feature flags | PASS | **PASS** | `W1_FAIL_CLOSED_INIT`, `W1_PERIOD_LOCK_ENFORCE` in `w1Registry.ts`; gating in `initFailurePolicy.ts` and `periodLockService.ts` |
| **AC-6** | Backward compatibility preserved | PASS | **PASS** | Flags default true but legacy paths when false; v26 additive |
| **AC-7** | Tests updated | PASS | **PARTIAL FAIL** | 4 test files exist (14 cases). **Gaps:** not in `.github/workflows/test.yml`; root `package-lock.json` has no `vitest` (only `khata-app/` lockfile); no `addVoucher`/store integration tests; audit environment could not execute `npm run test:accounting` |
| **AC-8** | Documentation updated | PASS | **PASS** | `docs/WAVE1_DEXIE_MIGRATION.md`, `nios/docs/dexie-pg-canonical.md` updated |
| **AC-9** | Migration docs updated | PASS | **PASS** | `docs/WAVE1_DEXIE_MIGRATION.md` |
| **AC-10** | Legacy localStorage locks migrated | PASS | **PARTIAL PASS** | v26 upgrade calls `importLegacyPeriodLocksIntoDexie(trans)`. **Gaps:** upgrade failure is swallowed (`console.warn` only); localStorage not cleared when all rows skipped as duplicates; dead guard `if (!db.table("periodLocks"))` always truthy |
| **AC-11** | Year-end close writes Dexie period locks | PASS | **PASS** | `YearEndProcess.tsx` `confirmLockFY` writes 12 `periodKeys` + `invalidatePeriodLockCache()` |
| **AC-12** | Non-fatal data load warning (W1-E08) | PASS | **PASS** | `DATA_LOAD_WARNING_MESSAGE` on login/session `_loadAllData` failure; `DataLoadWarningBanner` in `Layout.tsx` |

**Score: 7 PASS · 3 PARTIAL FAIL · 1 FAIL · 1 PARTIAL PASS** (out of 12)

---

## 3. Task-by-task verification

### Task 1 — `periodLocks` persisted in Dexie v26

**Verdict: PASS**

| Check | Result |
|-------|--------|
| Type exported | `DBPeriodLock` in `src/lib/db.ts` |
| Class property | `periodLocks!: Table<DBPeriodLock>` |
| Schema version | v26 adds indexed store |
| Upgrade hook | Imports legacy locks + invalidates cache |

**First-principles note:** Persistence is **correct for clients that open DB at v26+**. Existing users mid-upgrade depend on Dexie migration completing once; there is no runtime assertion that `periodLocks` exists before enforcement (service returns `[]` if table missing — **fail-open when table absent**, mitigated only after v26 applies).

---

### Task 2 — Migration from localStorage works

**Verdict: PARTIAL PASS**

**Works:**
- `importLegacyPeriodLocksIntoDexie()` normalizes `lockedMonth` → `periodKey`, dedupes, writes Dexie rows
- v26 `.upgrade()` invokes import inside transaction
- Integration test `periodLock.integration.test.ts` covers happy path
- Period Lock UI banner + manual import button

**Gaps:**

| Gap | Severity |
|-----|----------|
| Upgrade import errors caught and **non-fatal** — user may believe migration ran | Medium |
| localStorage cleared only when `imported > 0` — all-duplicate import leaves legacy data | Low |
| `if (!db.table("periodLocks"))` in import helper never false for Dexie | Low (dead code) |
| `scripts/migrate-period-locks-localStorage.ts` calls `getDB()` — not runnable headless without IndexedDB | Low |
| No test for v26 upgrade hook itself (only direct import function) | Medium |

---

### Task 3 — Every posting path enforces period locks

**Verdict: FAIL** (relative to “every posting path”)

**Enforced (via `assertPeriodUnlockedForPosting` / `enforcePeriodLockForPost`):**

| Path | File |
|------|------|
| `addVoucher` (status=posted) | `voucherSlice.ts` |
| `updateVoucher` (→ posted) | `voucherSlice.ts` |
| `addInvoice` (posted) | `voucherSlice.ts` |
| `updateInvoice` (willBePosted) | `voucherSlice.ts` |
| `postInvoiceJournal` | `store/index.ts` |
| `convertPDCToBank` (posted) | `voucherSlice.ts` |

**Also covered indirectly:** Most voucher pages (`SalesVoucher`, `PayrollRun`, `BankReconciliation`, `OpeningBalance`, etc.) call `addVoucher` → same enforcement.

**NOT enforced (documented Stage 4 or missing):**

| Path | File | Notes |
|------|------|-------|
| `cancelVoucher` reversal journal | `voucherSlice.ts` ~218–231 | Posts reversal with **today’s date**, no lock |
| `cancelInvoice` reversal journal | `voucherSlice.ts` ~426–439 | Same |
| Optional voucher “convert to actual” | `OptionalVouchers.tsx` ~171–175 | `db.vouchers.update({ status: "posted" })` — **no journal posting path, no lock** |
| Workflow posted documents | `workflowActions.ts` | Direct `db.vouchers.put` / `bulkPut`, status `"posted"` |
| Approval → posted | `permissionsStore.ts` ~172 | Status flip only, bypasses `addVoucher` |
| Year-end closing fallback | `YearEndProcess.tsx` ~608–612 | `db.table("vouchers").put` when `!addVoucher` |
| `postRecurringTemplate` | `store/index.ts` ~1872+ | Records metadata only — **does not create GL voucher** (separate bug) |

**Assessment vs Stage 1 scope:** Implementation report correctly scoped **cancel** to Stage 4. Claim that **all posting paths** enforce lock is **overstated** due to workflow/optional/approval/fallback bypasses.

---

### Task 4 — No write path bypasses `W1_PERIOD_LOCK_ENFORCE`

**Verdict: FAIL**

When `W1_PERIOD_LOCK_ENFORCE=false`, `isDateLocked()` returns `false` immediately — **central gate works**.

When flag is **true**, bypasses remain (Task 3 table). Flag does not wrap Dexie writes globally — only call sites that invoke `assertPeriodUnlockedForPosting`.

**Additional bypass class:** Stale in-memory lock cache (`periodLockService.ts` lines 66–71). Cache invalidated on Period Lock / year-end actions, but **not** across browser tabs. Tab B can post into a period locked in Tab A until reload or explicit invalidation.

---

### Task 5 — Fail-closed init cannot silently continue after DB failure

**Verdict: PARTIAL FAIL**

**PASS — fatal init failure path:**

```488:496:src/store/index.ts
      } catch (err: any) {
        console.error("[Sutra ERP] initializeApp failed:", err);
        const failure = resolveInitFailureState(err);
        set({
          authStage: failure.authStage,
          isInitializing: false,
          isDbReady: failure.isDbReady,
          initError: failure.initError,
        });
```

With `W1_FAIL_CLOSED_INIT=true`: `authStage: "error"`, `isDbReady: false`, `InitErrorScreen` blocks shell.

**FAIL — partial / non-fatal DB load still continues:**

```428:436:src/store/index.ts
                try {
                  await get()._loadAllData();
                } catch (loadErr) {
                  console.error("[initializeApp] _loadAllData failed during session restore:", loadErr);
                  if (isW1FlagEnabled("W1_FAIL_CLOSED_INIT")) {
                    set({ dataLoadWarning: DATA_LOAD_WARNING_MESSAGE });
                  }
                }
                return { action: "authenticated", ... };
```

Session restore and login still end in **`isDbReady: true` + authenticated** with only a banner — **not fail-closed** for data integrity.

**FAIL — init timeout race:** `initializeApp` uses 15s timeout; `App.tsx` safety net fires at **10s** while still `authStage === "checking"`. Slow successful init (10–15s) can show error UI before success overwrites state — flaky fail-closed behavior.

---

### Task 6 — Startup timeout respects `W1_FAIL_CLOSED_INIT`

**Verdict: PASS** (with race caveat)

```179:198:src/App.tsx
        if (isW1FlagEnabled("W1_FAIL_CLOSED_INIT")) {
          useStore.setState({
            isInitializing: false,
            isDbReady: false,
            authStage: "error",
            initError: { message: "...timed out...", code: "INIT_TIMEOUT", ... },
          });
        } else {
          useStore.setState({ ... isDbReady: true, authStage: "gateway" });
        }
```

Flag branching is **correct**. **`SUTRA_INIT_TIMEOUT`** (15s) in `initializeApp` also routes through `resolveInitFailureState` — consistent.

**Caveat:** Dual timeout layers (10s UI + 15s init) without coordination — see Task 5.

---

### Task 7 — Full mutation surface audit (accounting, inventory, banking, payroll, journals)

Classification: **E** = enforced · **B** = bypass · **N** = not applicable (no GL journal / master data only) · **S** = stock/inventory subledger (no period lock in Stage 1)

| Mutation surface | Lock | Notes |
|------------------|------|-------|
| `addVoucher` / `updateVoucher` (posted) | **E** | Core path |
| `addInvoice` / `updateInvoice` (posted) | **E** | Includes `postInvoiceJournal` |
| `postInvoiceJournal` / `repostInvoiceJournalAndStock` | **E** | Journal entry |
| `convertPDCToBank` | **E** | Banking journal |
| `cancelVoucher` / `cancelInvoice` | **B** | Reversal posts without lock (Stage 4) |
| `runRecurringVoucher` → `addVoucher` | **E** | Uses today’s date |
| `postRecurringTemplate` | **N/B** | No voucher created — accounting gap |
| `workflowActions` (GRN, DC, invoice chains) | **B** | Direct `db.vouchers.put`, posted |
| `permissionsStore.approveVoucher` | **B** | Status-only posted |
| `OptionalVouchers.handleConvert` | **B** | Status-only posted |
| `YearEndProcess` closing via `addVoucher` | **E** | When store wired |
| `YearEndProcess` closing `vouchers.put` fallback | **B** | No lock |
| `PayrollRun` → `addVoucher` | **E** | |
| `BankReconciliation` → `addVoucher` | **E** | |
| `OpeningBalance` → `addVoucher` | **E** | |
| `confirmKhata` → `deps.addVoucher` | **E** | |
| `postInvoiceStock` / `postPhysicalStock` / inventory slice | **S** | Stock movements — no GL period lock |
| `processPayrollRun` (store index) | **N** | Payroll rows only, no journal |
| `saveEPaymentBatch` / banking masters | **N** | Non-journal |
| `syncEngine` voucher/invoice put | **B** | Sync replay — no lock |
| Pages: `ReversingJournals` create | **E** | Uses `addVoucher` |
| Pages: `ReversingJournals` cancel | **B** | Direct `db.vouchers.update` |
| `POSBilling`, `CommunicationHub`, etc. | **E*** | *If routed through `addVoucher`/`addInvoice` — not exhaustively traced per line |

**Conclusion:** Stage 1 **centralized** lock for the **main store posting API** but did **not** close the **full mutation surface**. Workflow, approvals, optional vouchers, sync, and cancel reversals remain **launch-relevant bypasses**.

---

### Task 8 — Remaining `isDbReady: true` after initialization failures

| Location | Context | Fail-closed when `W1_FAIL_CLOSED_INIT=true`? |
|----------|---------|-----------------------------------------------|
| `store/index.ts` catch block | Fatal init | **No** — correctly sets `isDbReady: false` |
| `store/index.ts` success paths | no-company / gateway / authenticated | **OK** — successful init |
| `initFailurePolicy.ts` | Flag false legacy | **OK** — intentional rollback |
| `App.tsx` ~195 | 10s timeout, flag false | **OK** — intentional rollback |
| `App.tsx` / session restore | `_loadAllData` fails → still authenticated | **FAIL** — `isDbReady: true` |
| `e2e/bootstrapHarness.ts` | Test harness | **N/A** |

**No remaining `isDbReady: true` inside fatal init catch** — AC-4 sub-item **PASS** for that specific bug.

---

### Task 9 — Rollback flags disable behavior cleanly

| Flag | Expected | **QA verdict** |
|------|----------|----------------|
| `W1_PERIOD_LOCK_ENFORCE=false` | No lock checks | **PASS** — early return in `isDateLocked` |
| `W1_FAIL_CLOSED_INIT=false` | Legacy init on error | **PASS** — `resolveInitFailureState` → `no-company`, `isDbReady: true` |
| Env override `VITE_W1_*` | Build-time | **PASS** (requires rebuild — documented) |
| Runtime override without rebuild | Not supported | **Acceptable** — test-only `setW1FlagOverride` |

**Clean rollback: PASS** for documented mechanisms.

---

### Task 10 — Test completeness review

| Area | Covered? | Missing scenarios |
|------|----------|-------------------|
| `periodLockService` unit | Yes | Table-missing fail-open; invalid date strings; `lockedMonth`-only rows |
| Legacy import integration | Yes | Upgrade hook; duplicate-only import; failed upgrade |
| Init failure policy unit | Yes | — |
| Init integration | Minimal | No `initializeApp` / store test; no timeout race |
| `addVoucher` + lock | **No** | End-to-end posted voucher blocked |
| `updateInvoice` repost | **No** | |
| `convertPDCToBank` | **No** | |
| Cancel reversal bypass | **No** | Documented Stage 4 — should be negative test stub |
| Year-end period lock write | **No** | |
| Flag rollback via env | **No** | |
| CI execution | **No** | `.github/workflows/test.yml` unchanged |
| Multi-tab cache staleness | **No** | |

**Test suite verdict: PARTIAL FAIL** — good unit coverage of new modules; **insufficient** for Stage 1 acceptance and **not gated in CI**.

---

## 4. Remaining gaps (prioritized)

| Priority | Gap | Owner stage |
|----------|-----|-------------|
| **P0** | Workflow / optional / approval paths post without period lock | Stage 1 hotfix or Stage 2 posting boundary |
| **P0** | Cancel/reversal journals post without lock (today’s date) | Stage 4 (known) |
| **P1** | 10s App safety net vs 15s init timeout race | Stage 1 hotfix |
| **P1** | `_loadAllData` failure allows authenticated + writes | Design decision — warn vs block |
| **P1** | Multi-tab lock cache stale | Stage 1/6 |
| **P2** | `postRecurringTemplate` does not create vouchers | Pre-existing |
| **P2** | Year-end `vouchers.put` fallback bypasses lock | Stage 1 hotfix |
| **P2** | Accounting tests not in CI | Stage 5 |
| **P3** | Migration failure silent | Ops / Stage 1 |

---

## 5. Edge cases

1. **Nepali/AD date boundary:** `periodKeyFromDate` uses JS `Date` local timezone — month key may differ from `dateNepali` intent near boundaries.
2. **Zero-padded vs non-padded keys:** Normalization handles `2025-07` vs `2025-7` — **PASS** for enforcement; inconsistent storage still possible in UI rows.
3. **Lock row without `isUnlocked: false` explicit:** `isUnlocked !== true` treats undefined as active — **correct** for Period Lock page rows that omit field on older rows.
4. **Draft vouchers in locked period:** Allowed — correct (only posted checked).
5. **Invoice repost when period locked after original post:** `updateInvoice` checks lock at save — **correct**.
6. **`jnlExists` skip on draft→posted:** Stock/journal skip bug (FI-006) **still present** — not Stage 1 scope but affects lock-adjacent posting integrity.
7. **Init retry while `initializeApp` in flight:** `retryInitializeApp` resets flags then calls `initializeApp`; concurrent calls possible if user double-clicks.

---

## 6. Hidden regressions

| Regression | Mechanism |
|------------|-----------|
| **False init error on slow devices** | 10s spinner safety net before 15s init completes |
| **Error screen flash then gateway** | Safety net sets `error`, init later succeeds and overwrites |
| **Stricter posting with empty lock table pre-v26** | No enforcement until migration — then sudden blocks |
| **Legacy localStorage-only users** | Until import, Dexie enforcement missed; legacy `validateVoucherDate` in `periodLock.ts` **not used by voucher pages** (they use `voucherUtils.validateVoucherDate` — fiscal year only) |
| **Auto round-off still in `postInvoiceJournal`** | FI-003 not Stage 1 — silent imbalance masking continues |

---

## 7. Launch blockers still open

Stage 1 **does not close** Wave 1 launch blockers from the prior audit. Still open:

| Blocker | Status after Stage 1 |
|---------|----------------------|
| FI-001 Triple balance truth | **Open** (Stage 3) |
| FI-002 Denorm balance | **Open** |
| FI-003 Auto round-off | **Open** |
| FI-005 Golden CI | **Open** — tests exist, not in CI |
| FI-006 Invoice/stock saga | **Open** |
| FI-008 Full cancel lock | **Open** — partial post-only done |
| FI-012 Unified reports | **Open** |
| **Period lock full coverage** | **Open** — bypass matrix §7 |
| **Fail-closed data load** | **Open** — banner only |

**Stage 1-specific blockers before claiming “Stage 1 complete”:**

1. Close or explicitly accept workflow/optional/approval bypasses with risk sign-off  
2. Fix 10s/15s init timeout race  
3. Add `addVoucher` lock integration test + CI job  
4. Execute and record `npm run test:accounting` pass on CI  

---

## 8. Issue traceability (FI-021, FI-022, FI-008 partial)

| Issue | QA status | Notes |
|-------|-----------|-------|
| **FI-021** | **Substantially met** | v26 schema, service, UI, year-end locks, migration path |
| **FI-022** | **Partially met** | Fatal init fail-closed OK; partial load and timeout race not |
| **FI-008 partial** | **Partially met** | Main store post paths only; reversals and side doors open |

---

## 9. Recommended disposition

| Action | Recommendation |
|--------|----------------|
| Merge Stage 1 to pilot | **Yes**, with flags ON and bypass list communicated to CAs |
| Mark IMPLEMENTATION_REPORT all PASS | **No** — update to reflect PARTIAL |
| Begin Stage 2 | **Yes**, but allocate **Stage 1 hotfix sprint** for posting boundary (wrap all `db.vouchers` journal writes) |
| Nepal ERP launch | **No** — Wave 1 minimum (Stages 1–3 + 5) not complete |

---

## 10. Verification commands (for human QA sign-off)

```bash
npm install
npm run test:accounting
npx tsc --noEmit
npm run lint

# Static guards
rg "version\(26\)" src/lib/db.ts
rg "assertPeriodUnlockedForPosting" src/store src/lib
rg "isDbReady: true" src/store/index.ts src/App.tsx

# Manual
# 1. Lock current month → post sales voucher → expect error toast
# 2. Lock current month → workflow GRN-to-invoice (if used) → verify bypass
# 3. Block IndexedDB → reload → InitErrorScreen, no shell
# 4. VITE_W1_PERIOD_LOCK_ENFORCE=false build → post into locked month succeeds
```

---

*Independent verification complete. No code was modified.*
