# UI-7 — Transaction Surface and Authority Audit

**Phase:** UI-7.1  
**Date:** 2026-07-13  
**UI-6 correction:** Intermediate shell `tsc` exits (151 baseline / temporary 152 / min-font) were superseded. Final UI-6 gate **passed**. Deep-research file remains **absent**.

**Before-state TypeScript:** **151** root diagnostics (verified). Governance: **PASS**.

## Production routes (six families)

| Family | Route key(s) | Page | Form | New-posted command | Orbix same? |
|--------|--------------|------|------|--------------------|-------------|
| Sales | `billing` (+ legacy `sales`) | `BillingInvoice` / was `SalesVoucher` | `SalesInvoiceForm` type=sales | `postSalesTransaction` | YES |
| Purchases | `purchase` | `PurchaseVoucher` | inline page form | **was** `addInvoice` → **UI-7 →** `postPurchaseTransaction` | YES after UI-7 |
| Receipts | `receipt` | `ReceiptVoucher` | `ReceiptVoucherForm` | `postReceiptTransaction` | YES |
| Payments | `payment` | `PaymentVoucher` | `PaymentVoucherForm` | `postPaymentTransaction` | YES |
| Contra | `contra` | `ContraVoucher` | inline | `postContraTransaction` | YES |
| Journal | `journal` | `JournalEntries` | `JournalVoucherForm` | `postJournalTransaction` | YES |

## Related (minimal compatibility — not full redesign)

| Surface | Route | Command |
|---------|-------|---------|
| Sales return | `sales-return` → BillingInvoice | `postSalesAdjustmentTransaction` |
| Purchase return | `purchase-return` → BillingInvoice | `postPurchaseAdjustmentTransaction` |
| Credit note | `credit-note` | `postSalesAdjustmentTransaction` |
| Debit note | `debit-note` | `postPurchaseAdjustmentTransaction` (linked) |

## Authority files

| Role | Path |
|------|------|
| Sales | `src/domains/sales/postSalesTransaction.ts` |
| Purchase | `src/domains/purchase/postPurchaseTransaction.ts` |
| Receipt/Payment/Contra/Journal | `src/domains/settlement/post*.ts` |
| Orbix router | `src/lib/ekhata/orbixPostingService.ts` |
| Legacy writers | `src/store/slices/voucherSlice.ts` → `invoicePostingWriters.ts` (drafts/edits/non-inventory) |

## Pre-UI-7 divergence (purchase)

Manual `PurchaseVoucher` and BillingInvoice purchase tab used `addInvoice` / `postInvoiceJournal` while Orbix used `postPurchaseTransaction`. Domain file already states both must converge. UI-7 migrates new posted inventory purchases to `postPurchaseTransaction` with `source: "manual_form"`.

## Dead / unused

- `PurchaseInvoiceForm.tsx`, `ReturnInvoiceForm.tsx`, `StockItems.tsx` (AGENTS.md)
- `JournalVoucher.tsx` placeholder (App uses `JournalEntries`)
- Orphan `VoucherHeader` / `VoucherFooter` / `BillAllocationPanel` (no active consumers)

## Risks closed by UI-7

- Competing purchase posting path
- Competing `sales` vs `billing` entry (route `sales` → BillingInvoice)
- Missing shared document canvas / status truth (local vs sync)
- `@ts-nocheck` on migrated page shells

## Risks retained (honest)

- Draft/edit paths may still use `addVoucher`/`addInvoice` where domain commands do not yet cover edits
- Full mobile Journal remains constrained (row editor / desktop preference)
- Registers, bank recon, cheque, print templates out of scope
