# NEXT-12 — End-to-End Launch Slice

**Date:** 2026-07-19  
**Step:** NEXT-12  
**ADR:** ADR_0079  

## Verticals (frozen launch events)

| Event | Path | Receipt | Sync honesty |
|-------|------|---------|--------------|
| `purchase_invoice_draft` | language → draft → preview → confirm → receipt | required | pending ≠ synced |
| `sales_invoice_draft` | language → draft → preview → confirm → receipt | required | pending ≠ synced |
| `ask_company_report` | language → report | none | N/A (no post) |

## Product write authority

Confirm/post for sales/purchase: `executeOrbixConfirm` → Dexie domain engines  
(ADR_0075 Model B tokens). No dual silent writers added.

## Automated evidence

- Connected (env `ORBIX_E2E_CONNECTED=true`):
  - `e2e/orbix-connected.spec.ts` (purchase)
  - `e2e/orbix-sales-connected.spec.ts` (sales language/clarify)
  - `e2e/orbix-next12-launch-slice.spec.ts` (named launch slice)
  - `e2e/orbix-sync.spec.ts` (queued≠synced)
- Unit/integration:
  - `src/__tests__/orbix/maiNext12LaunchSlice.test.ts`
  - `src/__tests__/orbix/postPurchaseTransaction.test.ts`
  - `src/__tests__/orbix/postSalesTransaction.test.ts`
  - `erp_bot/tests/oip/language_runtime/test_mai_next12_e2e_launch_slice.py`

## Manual script

Operator checklist (Accountant + Ask, one company):

1. **Purchase (mixed):** Accountant Mode → `Ram bata bike 1 pcs 50000 cash kineko` (or clarify qty/rate) → confirm preview → Confirm → see local receipt → badge Waiting to sync / pending (not Synced until push ack).
2. **Sales (EN):** Accountant Mode → `sold bike 1 pcs 60000 cash to Sita` → preview → Confirm → receipt → pending sync honesty.
3. **Ask report:** Ask Mode → `balance sheet dekhaunu` or `show balance sheet` → report shown; Confirm control absent; no new invoice/journal.
4. **Negative:** Ask Mode sale utterance → mode restriction; no post.
5. **Stale preview (optional):** edit after preview → confirm rejects / requires refresh.

## Explicit non-claims

- Not `production_approved` (NEXT-20).
- Not sole-OEC; GAP-P0-001 remains REDUCED/OPEN residual.
- GAP-P1-002 dual badge residual remains; GAP-P2-008 knowledge honesty OPEN.
- Settlement / receipt-payment / returns not in launch freeze.
