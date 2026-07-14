# UI-7 — Transaction Posting and State Source Map

```
User opens transaction route
→ AppShell / PageContentFrame / RouteAccessGate (nav role soft gate)
→ TransactionWorkspace (UI-7 shell)
→ companySettings + currentFiscalYear (UI-3 store context)
→ draft loader (page/form local state + addInvoice/addVoucher drafts)
→ DocumentCanvas + entry grid
→ field / form validation (UI)
→ authoritative domain command (post*Transaction)
→ Dexie atomic commit inside domain command
→ posting receipt payload (invoice_number / voucher_number / posting_id)
→ sync enqueue inside domain (company sync policy)
→ UI shows Posted locally + sync_status from command result
→ remote acknowledgement updates sync presentation (UI-3 adapter)
→ conflict remains structured (not generic failure)
```

| Displayed state | Authority |
|-----------------|-----------|
| Draft | Local form / `VoucherStatus.DRAFT` via store writers |
| Validation error | Form + domain `safe_message` |
| Posted locally | Domain `posting_completed` |
| Waiting to sync / Synced / Conflict | Domain `sync_status` + UI-3 sync aggregate — never invent Synced |
| Period lock | `enforcePostingPeriodLock` / domain validation |
| Permission | Domain `isAccountantOrAdmin` (+ role checks); shell is not authorization |
| Idempotent replay | Domain receipt lookup |

Manual and Orbix both call the same `post*Transaction` for new posted inventory/settlement documents after UI-7.
