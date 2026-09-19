from pathlib import Path

def w(path, text):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("wrote", path, len(p.read_bytes()))

# tsconfig.phase10.json
w("tsconfig.phase10.json", '''{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": [
    "src/domains/treasury/**/*.ts",
    "src/domains/settlement/**/*.ts",
    "src/domains/purchase/money.ts",
    "src/domains/purchase/e2eSeed.ts",
    "src/domains/purchase/postPurchaseTransaction.ts",
    "src/store/invoicePostingWriters.ts",
    "src/platform/sync/applyRemoteEvent.ts",
    "src/platform/sync/accountingSyncContract.ts",
    "src/platform/sync/enqueueFinancialSync.ts",
    "src/platform/sync/enqueueBankSync.ts",
    "src/platform/sync/reconciliation.ts",
    "src/platform/sync/syncStatusAggregate.ts",
    "src/platform/sync/syncTransport.ts",
    "src/platform/sync/payloadHash.ts",
    "src/platform/sync/companySyncPolicy.ts",
    "src/platform/sync/localSequence.ts",
    "src/platform/sync/syncQueue.ts",
    "src/platform/sync/vectorClock.ts",
    "src/platform/sync/syncServerContracts.ts",
    "src/platform/sync/syncDiagnostics.ts",
    "src/lib/db.ts",
    "src/__tests__/orbix/phase10Treasury.test.ts"
  ]
}
''')

# docs
w("docs/ORBIX_PHASE10_BANK_RECONCILIATION.md", '''# Orbix Phase 10 — Bank Reconciliation, Cheque Lifecycle & Treasury Control

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

## Known gaps / follow-ups

- Legacy `bankStatementRows` phantom table may still appear in older UI reads; new imports write domain `bankStatementLines`.
- Digital-payment commission path now uses Phase 9 adjustment; full digital recon UX not redesigned.
- Full 114-point audit checklist not claimed green in this summary.
''')

print("tsconfig+docs done")