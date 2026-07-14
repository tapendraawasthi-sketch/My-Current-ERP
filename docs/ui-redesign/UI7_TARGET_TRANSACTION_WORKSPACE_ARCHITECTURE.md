# UI-7 — Target Transaction Workspace Architecture

## Hierarchy

```
AppShell
→ PageContentFrame
→ RouteAccessGate
→ TransactionWorkspace          (@/features/transactions)
  → TransactionHeader             (title, company, FY, status, sync)
  → TransactionContextBar         (mode chip, permission/lock chips)
  → DocumentCanvas
      → PrimaryFields (slot)
      → LineEntryArea | VoucherGrid (slot)
      → FinancialSummary (slot)
      → SupportingDetails (slot)
  → TransactionInspector (optional / collapsible)
  → StickyTransactionActions
  → PostingResultPanel (when result present)
```

## Controlled modes

| Mode | Families |
|------|----------|
| `inventory-document` | Sales, Purchases |
| `settlement-document` | Receipts, Payments |
| `transfer-document` | Contra |
| `journal-document` | Journal |

## State boundaries

- Form state: existing page/form components (not a second draft DB)
- Posting: domain commands only
- Sync presentation: command `sync_status` + UI-3 adapters
- Company/FY: `useStore` — no duplicate providers

## Layout

- Desktop: canvas + optional inspector ~320px
- Laptop: inspector collapses
- Tablet/mobile: single column; inspector Drawer; Journal mobile limitation documented

## Cutover

1. Introduce shell + status helpers  
2. Converge purchase posting  
3. Point `sales` route at BillingInvoice  
4. Wrap six family pages  
5. Lab E2E + governance  

Rollback: revert page wrappers; domain commands unchanged.
