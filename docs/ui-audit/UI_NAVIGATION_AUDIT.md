# UI Navigation & Information Architecture Audit

Generated: 2026-07-13 (Phase UI-0.7)

## Sources

- Primary sidebar: `src/components/shell/PrimarySideNav.tsx` ← `SHELL_NAV` in `navConfig.ts`
- Top command bar: `src/components/shell/TopCommandBar.tsx`
- Command palette: `src/components/shell/CommandPalette.tsx` (Ctrl/Cmd+K, `/`)
- Legacy: `Sidebar.tsx` (unused), `BusyMenuBar.tsx`, `topbar/TopMenuBar.tsx`, `topbar/GoToPanel.tsx`
- Mobile: AppShell mobile nav drawer
- Orbix: `orbix` page + Orbix panel maximize from nav
- Breadcrumbs: `src/components/Breadcrumb.tsx` (feature-local usage)

## Destination counts

From route inventory + navConfig extraction:

| Metric | Value |
|--------|------:|
| Authenticated page IDs (App.tsx) | 156 |
| Unique page components | 102 |
| Nav destinations (`page:` in SHELL_NAV) | see inventory |
| Routes with nav entry | 64 |
| Routes without nav entry | 92 |
| Nav destinations missing App route | 0 |

## Duplicate destinations (same page, multiple nav entries)

Verified in `SHELL_NAV`:

| Page ID | Labels / locations |
|---------|-------------------|
| `receipt` | Transactions → Receipt; Banking → Receipt |
| `payment` | Transactions → Payment; Banking → Payment |
| `contra` | Transactions → Contra; Banking → Contra |
| `day-book` | Banking → Day Book; Reports → Day Book |
| `ratio-analysis` | Reports → Ratio Analysis; Analytics → Ratios |
| `vat-reports` | Reports → VAT Reports; Compliance → VAT Reports |
| `fiscal-year` | Masters → Fiscal Year; Settings → Fiscal Year |
| `pdc-*` | Masters PDC vs Banking PDC Register (related, overlapping concepts) |
| `dashboard` / `financial-dashboard` | Home vs Analytics → Financial Dashboard (alias group in App) |

## Label inconsistency examples

| Concept | Labels seen |
|---------|-------------|
| Chart of accounts | "Chart of Accounts" / page aliases `accounts`, `chart-of-accounts` |
| Items | "Item Master" vs page ids `items` / `stock-book` / `item-master` |
| Sales invoice | "Sales Invoice" (`billing`) vs `sales` / `SalesVoucher` separate route |
| Backup | `backup` / `backup-restore` |

## Structural issues

- **Feature-oriented nav**, not role-oriented (owner/cashier/auditor see same tree).
- **Excessive nesting risk** in Transactions + Reports groups.
- **Many routes orphaned** from nav (92) — reachable via palette/goto/default only or dead.
- **Disabled modules** visibility: not centrally gated in `SHELL_NAV` (permissions largely runtime/unknown).
- **Mobile overflow**: sidenav drawer exists; dense groups still long on small screens (see responsive baseline).

## Role maps (current reality → proposed access)

These are **analytical**, not implemented.

| Role | Primary destinations today | Gaps |
|------|---------------------------|------|
| Business owner | Home, Orbix, Analytics dashboard, P&L, BS, receivables | Mixed with deep masters |
| Accountant | Transactions, Day Book, GL, TB, journals, VAT | Banking recon buried |
| Cashier | Receipt, Payment, POS-ish pages | Also sees full masters tree |
| Auditor | Audit log, reports, TB/BS | Audit not first-class top entry |
| Inventory user | Inventory group | Stock reports also under Reports |
| Banking user | Banking group | Missing bank recon / statement import in SHELL_NAV banking items |
| Administrator | Settings, Users, Backup, Configuration | Duplicated fiscal year |

### Banking nav gap (important)

`SHELL_NAV` banking items currently emphasize receipt/payment/contra/PDC/day-book but **do not list** `bank-reconciliation` or `bank-statement-import`, despite those being critical Phase 10 screens and App routes.

## Proposed target IA (from redesign blueprint — **NOT IMPLEMENTED**)

> Status: **proposed only**. Do not treat as shipped.

1. **Home** — dashboard, favourites, recents  
2. **Ask Orbix** — single AI workspace entry  
3. **Sell** — invoices, receipts, customers, sales registers  
4. **Buy** — purchases, payments, suppliers  
5. **Cash & Bank** — receipts/payments, recon, statement import, cheques, PDC  
6. **Stock** — items, movements, valuation  
7. **Books** — day book, ledger, journals  
8. **Reports** — TB, P&L, BS, ageing, VAT  
9. **Compliance & Audit**  
10. **Settings & Admin** — role-filtered  

Role-oriented filters would hide irrelevant modules rather than showing one mega-tree.

## Favourites / recents

No first-class favourites store identified in shell nav. Command palette provides search-like jump. Recents not verified as a durable IA feature.
