# UI Dependency Map

Phase UI-0 — dependency order for safe visual migration.

## Hard rule

Visual migration must not change accounting calculations, posting, sync contracts, permissions, or period locks.

## Dependency layers

```text
Layer 0 — Governance (done in UI-0)
  tools/ui-governance/baselines/*
  scripts/ui-governance-check.mjs
  ui:audit / ui:governance

Layer 1 — Tokens & typography (UI Phase 1)
  design-tokens.css
  styles.css conflict resolution
  typography scale (>=12px essential)
        ↓
Layer 2 — Primitives (UI Phase 1)
  Button, IconButton, Input, Select, Dialog, Drawer, Popover,
  StatusChip, DataTable, PageHeader, Loading/Empty/Error
        ↓
Layer 3 — Shell chrome (UI Phase 2)
  AppShell, PrimarySideNav, TopCommandBar, CommandPalette,
  Sync indicator, Notifications
        ↓
Layer 4 — Entry surfaces (UI Phase 3)
  Auth, Company selector, Dashboard, Orbix
        ↓
Layer 5 — Transaction & master pages (UI Phase 4)
  Sales, Receipt/Payment, Parties, Day Book, GL
        ↓
Layer 6 — Banking & statements (UI Phase 5)
  Bank recon, Statement import, Financial statements
```

## Critical couplings

| UI surface | Domain coupling | Migration caution |
|------------|-----------------|-------------------|
| BillingInvoice / SalesInvoiceForm | Sales posting, VAT, stock | Visual-only; keep form data contracts |
| PurchaseVoucher | Purchase domain Phase 7/8 | No posting path edits |
| Receipt/Payment | Settlement Phase 9 | No outstanding math edits |
| BankReconciliation | Treasury Phase 10 | No match/confirm logic edits |
| Orbix workspace | Orbix routing + posting service | No AI authority / confirm edits |
| Day Book / GL / TB / P&L / BS | Report engines | Preserve number formatting semantics |
| SyncStatusControl | Event sync client | Preserve event contracts |

## Style dependency graph

```text
main.tsx
  → styles.css
      → tailwindcss
      → design-tokens.css   (modern)
  → feature pages
      → arbitrary Tailwind hex/size  (debt)
      → inline styles                 (debt)
      → BusyShell primitives          (legacy)
      → tally-green.css (Tally pages) (legacy)
```

## Shell dependency graph

```text
App → Layout → AppShell → page
                 ↓
         Falcon / NIOS / EKhata / SutraAi overlays
```

## Test dependency graph

```text
ui:audit → inventories
ui:governance → baselines
ui:baseline → Playwright screenshots (E2E harness)
ui:a11y → axe baseline
existing orbix/accounting vitest → regression gate (must stay green / no new fails)
```
