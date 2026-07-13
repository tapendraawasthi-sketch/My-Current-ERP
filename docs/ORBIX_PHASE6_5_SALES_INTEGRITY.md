# Phase 6.5 — Sales Accounting Integrity

## Architecture (unchanged authority)

```
Manual SalesInvoiceForm ─┐
                         ├→ postSalesTransaction (single command)
Orbix Typed Confirm ─────┘
         │
         ├ invoice + revenue journal (+ VAT)
         ├ cost allocation (salesCostAllocations)
         ├ perpetual COGS journal (when configured)
         ├ stock-out
         ├ orbixPostingReceipts
         └ sales_posted → eventSyncQueue → push/pull → Device B apply facts
```

## Inventory accounting policy

Company settings fields:

- `inventoryAccountingMode`: `periodic` | `perpetual` (default **periodic** for backward compatibility)
- `stockValuationMethod`: `fifo` | `moving_weighted_average` | `standard_cost` | `current_item_cost_legacy`
- `negativeStockPolicy`: `block` | `warn_and_allow` | `allow`

E2E Sales company seeds **perpetual + moving_weighted_average**.

## Cost allocation

- Persisted in Dexie `salesCostAllocations` (schema v29)
- Embedded on `sales_posted` line facts (`cost_rate`, `cogs_amount`, `cost_layers`, `valuation_method`)
- Device B applies event facts; does **not** revalue from `item.costPrice`

## Perpetual COGS

When `inventoryAccountingMode === perpetual`:

- Voucher `jnl-cogs-{invoiceId}`: Dr COGS / Cr Inventory
- Amount = exact allocation total

Periodic companies do not receive Sales-time COGS journals.

## VAT

- Deterministic engine: `src/domains/sales/salesVatEngine.ts`
- Rule version: `configured-rates-v1` (configured rates; not statutory Nepal ingestion)
- Historical invoices retain `taxRuleVersion`

## Device registration

- Server module: `packages/backend/src/lib/deviceRegistration.ts`
- Routes: `POST /api/sync/devices/register`, `POST /api/sync/devices/revoke`
- Push/pull require active registration (auto-activate allowed in `ORBIX_SYNC_TEST_MODE`)
- Revoked / unknown / wrong-company devices are rejected with structured codes
- Local posting remains valid when remote sync is denied

## Reconciliation

- `runSalesReconciliation(companyId)` — read-only
- UI route: `sales-reconciliation` → `SalesReconciliationPanel`

## Security limitation

Browser-local Dexie remains the posting authority. This phase improves determinism, tamper evidence via hashes, device accountability, and reconciliation — not hardware-backed non-repudiation or server-authoritative posting.

## Phase 7 (not started)

Sales Returns and Credit Notes remain out of scope.
