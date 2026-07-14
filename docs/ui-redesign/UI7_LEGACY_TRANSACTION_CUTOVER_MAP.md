# UI-7 — Legacy Transaction Cutover Map

| Path | Status | Replacement |
|------|--------|-------------|
| `BillingInvoice` + `SalesInvoiceForm` | Migrated shell + posting | TransactionWorkspace |
| `SalesVoucher` | Route `sales` → BillingInvoice | Deprecated parallel entry |
| `PurchaseVoucher` | Migrated shell + `postPurchaseTransaction` | Same page, authoritative command |
| `ReceiptVoucher` / Form | Migrated shell | TransactionWorkspace |
| `PaymentVoucher` / Form | Migrated shell | TransactionWorkspace |
| `ContraVoucher` | Migrated shell | TransactionWorkspace |
| `JournalEntries` / Form | Migrated shell | TransactionWorkspace |
| `JournalVoucher.tsx` | Unused placeholder | Retain until deletion condition |
| `PurchaseInvoiceForm` / `ReturnInvoiceForm` | Dead | Do not revive |
| `addInvoice` for new posted inventory SI/PI | Reduced | Domain `post*Transaction` |

Deletion of dead files: only when zero imports + tests green + documented.
