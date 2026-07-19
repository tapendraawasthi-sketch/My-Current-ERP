# PR-B4 — Paisa spot-check (launch fixtures)

**Date:** 2026-07-19  
**ADR:** ADR_0087  

| Fixture | Display estimate | Posted ledger | Drift (paisa) |
|---------|------------------|---------------|---------------|
| LAUNCH_SALE_CASH_UNTAXED | 60000.00 (1 × 60000) | postSalesTransaction grandTotal | 0 |
| LAUNCH_PURCHASE_CASH | 50000.00 (1 × 50000) | postPurchaseTransaction grandTotal | 0 |
| LAUNCH_SALE_VAT_EXCLUSIVE | 2260.00 (computeInvoiceVAT 2 × 1000 @ 13%) | salesVatEngine + postSalesTransaction | 0 |

**Result:** No known paisa drift on launch item fixtures.  
**Gap:** GAP-P2-002 remains REDUCED (display estimates still present; not CLOSED).
