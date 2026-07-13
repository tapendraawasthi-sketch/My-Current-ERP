# Orbix Phase 10 — Bank Reconciliation, Cheque Lifecycle & Treasury Control

**Date:** 2026-07-13

## Architecture summary

Phase 10 makes bank reconciliation, cheque lifecycle, and treasury position **domain-authoritative** under `src/domains/treasury/`. Manual UI and Orbix both call typed commands; they must not treat `voucher.reconciled` or `addVoucher` as authority for bank adjustments.

```
Manual BankStatementImport / BankReconciliation
Orbix Accountant Mode (bank_recon_draft.py)
        |
        v
createStatementBatch | confirmBankMatch | reverseBankMatch
postBankAdjustmentFromStatement (→ Phase 9 RPCJ)
postChequeStatusChange | open/closeBankReconciliation
computeTreasuryPosition | cashFlowForecast
        |
        v
bankAccounts + bankStatementBatches/Lines
+ bankReconciliationLinks/Sessions + chequeInstruments
+ audit + orbixPostingReceipts + eventSyncQueue (enqueueBankSync)
        |
        v
remote ingest (facts-only applyRemoteEvent) — never rematch
```

## Key rules

1. **UTF-8 only** source files.
2. Bank charge / interest / direct deposit / debit / transfer → Phase 9 `postPayment` / `postReceipt` / `postContra` / `postJournal` via `postBankAdjustmentFromStatement`. **Never `addVoucher`.**
3. Statement import → `createStatementBatch` (duplicate `sourceHash` conflicts unless supersede).
4. Match confirm → versioned `confirmBankMatch` (overmatch + stale line version conflicts).
5. Cheque clear is evidence link; bounce posts corrective Phase 9 journal.
6. Close session rejects nonzero difference beyond tolerance.
7. Treasury position distinguishes **book** vs **available** cash.
8. Ask mode and explanation queries never mutate.

## Manual UI adapters

`src/domains/treasury/uiAdapters.ts` — thin wrappers used by:
- `BankStatementImport.tsx` commit path
- `BankReconciliation.tsx` save / adjustment / close paths

## Orbix

- Draft: `erp_bot/src/khata/bank_recon_draft.py`
- Routing: `mode_aware_erp.py` prefers bank recon for reconcile/statement/cheque cleared/available cash language (does not steal purchase/sales/settlement)
- Posting: `orbixPostingService.ts` routes `bank_recon_kind` before `confirmKhata`

## Tests & gates

| Suite | Gate env |
|-------|----------|
| Domain Vitest | `src/__tests__/orbix/phase10Treasury.test.ts` |
| Connected Orbix | `ORBIX_E2E_CONNECTED` + `ORBIX_BANK_RECON_E2E` |
| Sync | `ORBIX_SYNC_E2E` + `ORBIX_BANK_RECON_E2E` |
| Conflict | `ORBIX_BANK_CONFLICT_E2E` |
| Phase TS | `tsconfig.phase10.json` |

## Gate results (2026-07-13 final connected gate)

| Suite | Result |
|-------|--------|
| Phase 10 domain Vitest | **14/14 passed** |
| Connected Orbix bank recon | **16/16 passed** |
| Two-device sync | **3/3 passed** |
| Conflict | **4/4 passed** |
| Backend `tsc` | **passed** |
| Vite production build | **passed** |
| `check:no-emitted-js` | **passed** |
| Phase 10-owned TypeScript | **0** new diagnostics |
| Full-project TypeScript | **152** (baseline debt; not claimed green) |

**PHASE 10 FINAL GATE PASSED — READY FOR THE RECOMMENDED NEXT PHASE**

See `docs/ORBIX_PHASE10_FINAL_GATE.md` for the full 76-point gate report.
