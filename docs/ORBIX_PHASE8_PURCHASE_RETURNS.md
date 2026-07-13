# Orbix Phase 8 — Purchase Returns & Supplier Debit Notes

**Date:** 2026-07-13

## Final verdict

### PHASE 8 FINAL GATE PASSED — READY FOR THE RECOMMENDED NEXT PHASE

Supporting statements:

- **PHASE 8 TYPESCRIPT REGRESSION GATE PASSED** — Phase 8-owned diagnostics: **0**
- **PHASE 7 TYPESCRIPT REGRESSION GATE PASSED** (unchanged)
- **FULL-PROJECT TYPESCRIPT BASELINE REMAINS RED DUE TO PRE-EXISTING DEBT** — root `tsc --noEmit`: **151** diagnostics (not claimed green)

---

## Gate scores

| Suite | Result |
|-------|--------|
| Connected Orbix purchase returns A–H + refresh | **10/10** |
| Two-device sync + conflict | **4/4** |
| Phase 7 connected regression | **10/10** |
| Domain vitest (purchase adj + remote apply + purchase + sales adj + sales) | **36/36** |
| Backend `tsc` | **exit 0** |
| Vite build | **exit 0** |
| Phase 8-owned TypeScript | **0** |

Artifacts: `artifacts/orbix-phase8/`

---

## Audit summary (8.1)

Pre-Phase-8 purchase returns were legacy-only:

- Billing → `SalesInvoiceForm` → `addInvoice` (standalone PR, no original link / remaining qty)
- Nav `purchase-return` previously misrouted to `PurchaseVoucher` (fixed → `BillingInvoice`)
- `DebitNoteVoucher` broken / now routes to `postPurchaseAdjustmentTransaction`
- Orbix `khata_purchase_return` was journal-only via `confirmKhataEntry`
- No `purchase_return_posted` sync events

Canonical authority selected: **`postPurchaseAdjustmentTransaction`** (mirrors Phase 7 sales).

---

## Architecture

```
Manual PR form / DebitNoteVoucher / Orbix Accountant
  → postPurchaseAdjustmentTransaction
  → new purchase-return | debit-note (original purchase-invoice immutable)
  → historical input-VAT + inventory-cost removal (facts only)
  → purchase_return_posted | supplier_debit_note_posted
  → Device B applyRemoteEvent (no current rate/cost recalc)
```

Dexie **v31**: `purchaseInvoiceAdjustmentState`

---

## Key deliverables

| Area | Status |
|------|--------|
| Remaining qty / amount engine | PASS |
| Historical VAT/cost reversal | PASS |
| Physical stock outward (inventory return) | PASS |
| Financial DN no stock | PASS |
| Settlement methods | PASS |
| Sync events + remote apply | PASS |
| Concurrent over-return conflict | PASS |
| Orbix chat UI (real) | PASS 10/10 |
| Clarification / preview refresh | PASS |
| Phase 7 non-regression | PASS 10/10 |
| Reconciliation purchase findings | PASS (unit) |

---

## Recommended next phase

Inventory/warehouse advanced workflows, GRN hardening, or Production readiness — **not** another accounting command engine until product priorities dictate.

---

## PHASE 8 FINAL GATE PASSED — READY FOR THE RECOMMENDED NEXT PHASE