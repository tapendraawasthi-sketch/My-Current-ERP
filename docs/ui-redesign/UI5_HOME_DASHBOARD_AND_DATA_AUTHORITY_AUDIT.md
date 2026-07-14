# UI-5 — Home, Dashboard, KPI and Data-Authority Audit

**Phase:** UI-5.1  
**Date:** 2026-07-13  
**Missing authority file:** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — still absent; not reconstructed.

## Authority chain used

1. `AGENTS.md`
2. Phase UI-5 prompt
3. `docs/PREMIUM_UI_REDESIGN_SPEC.md`
4. Phase UI-0–UI-4 reports and specs
5. Production dashboard as behaviour evidence only

## Before-state capture

| Check | Result |
|-------|--------|
| Canonical Home | `src/pages/FinancialDashboard.tsx` via `dashboard` / `financial-dashboard` |
| Financial KPIs on Home | None (entity counts only) |
| Charts on Home | None |
| Role workspaces | None |
| `runDashboardQuery` wired to UI | No |
| Orphan KPI dashboards | `src/pages/Dashboard.tsx`, `src/components/Dashboard.tsx` (unimported, `@ts-nocheck`) |
| Chart library | `recharts` present; not used on Home |
| Role matrix | `docs/ui-audit/UI_ROLE_ROUTE_MATRIX.json` (analytical; not runtime) |
| Sync on Home | None (shell `SyncStatusControl` only) |

## Routes

| Page id | Component | Classification |
|---------|-----------|----------------|
| `dashboard` | `FinancialDashboard` | **Active canonical Home** |
| `financial-dashboard` | `FinancialDashboard` | Alias |
| App `default` | `FinancialDashboard` | Fallback |
| Post-login | `currentPage: "dashboard"` | Store authority |

No React Router `/home` path — Zustand `currentPage` only.

## Dashboard implementations

| Path | Status | Notes |
|------|--------|-------|
| `src/pages/FinancialDashboard.tsx` | Active | Counts + setup attention + recent lists + Orbix CTA |
| `src/pages/Dashboard.tsx` | Legacy orphan | Client-side KPIs; synthetic “CBMS Connected”; `@ts-nocheck` |
| `src/components/Dashboard.tsx` | Legacy orphan | Client-side KPIs + alerts; `@ts-nocheck` |
| `src/pages/CbmsDashboard.tsx` | Orphan (not Home) | CBMS monitor; live UI in StatutoryCompliance |
| `src/domains/report-engine/dashboardQueryEngine.ts` | Engine only | TB + inventory valuation + account count |

## Active Home metrics (pre-UI-5)

| Metric | Source | Authority | Risk |
|--------|--------|-----------|------|
| Parties count | `useStore.parties.length` | Store entity list | Non-financial; OK |
| Items count | `useStore.items.length` | Store entity list | Non-financial; OK |
| Invoices count | `useStore.invoices.length` | Store entity list | Non-financial; OK |
| Vouchers count | `useStore.vouchers.length` | Store entity list | Non-financial; OK |

No hard-coded financial amounts on active Home.

## Authoritative financial sources (to consume — not reimplement)

| Metric | Authority | Scope | Drill-down |
|--------|-----------|-------|------------|
| Cash & Bank | `readAllAccountBalances` + `isCashOrBankAccount` classification | Company; as-of balances | `day-book` / bank pages |
| Receivables | `computeOutstandingReceivables` | Company; posted sales | `outstanding-receivables` |
| Payables | `computeOutstandingPayables` | Company; posted purchases | `outstanding-payables` |
| Sales (period income) | `buildProfitLossFromProjection` → `totalIncome` | FY start–end | `profit-loss` |
| Net result | `buildProfitLossFromProjection` → `netProfit` | FY start–end | `profit-loss` |
| Inventory value | `buildInventoryValuationReport` → `totalValue` | Company stock projection | `stock-summary` |
| Trial-balance health | `readTrialBalanceFromProjection` debit/credit parity | Company | `trial-balance` |
| Ageing buckets | `buildAgingReportFromProjection` / `computeAgingReport` | As-of | `aging-report` / debtors/creditors |
| Dashboard aggregate | `runDashboardQuery` | Company projection | Supporting |

## Attention sources (authoritative)

| Category | Source | Status |
|----------|--------|--------|
| Empty parties / items | Store lengths | Active on Home |
| Overdue receivables/payables | Aging / outstanding helpers | Available; not on Home |
| Sync conflict / failed / pending | `getAggregatedSyncStatus` | Shell only |
| Trial-balance imbalance | TB projection totals | Available |
| Low stock | Item reorder vs qty (store) | Used in orphan dashboards |
| Pending approvals | Voucher `submitted` / `pending_approval` | Orphan dashboards |
| Backup / tax deadlines | No safe Home authority without invention | **Deferred** |

## Unsafe / synthetic (orphan only)

- Hard-coded “CBMS Connected” badge in `pages/Dashboard.tsx`
- Client-side cash/bank name heuristics without freshness labelling
- Falcon knowledge claiming charts/filters on Financial Dashboard (stale docs — out of UI-5 migration scope)

## Recent activity

| Source | Consumer | Home use |
|--------|----------|----------|
| Store vouchers/invoices (last 5) | Active Home | Yes |
| `useRecentActivity` (localStorage) | Dead `Gateway.tsx` only | Reuse for navigation continuity |

## Charts

| Surface | Library | Decision purpose |
|---------|---------|------------------|
| Home (pre) | None | — |
| Orphan Dashboard | CSS bars | Sales vs expenses (unsafe client sum) |
| Elsewhere | recharts | Not Home |

UI-5 chart policy: only ageing composition (authoritative buckets) by default; sales/cash trend deferred unless period series from report authority is proven.

## Permissions

- `src/lib/permissions.ts` screen matrix is authoritative for view/create.
- Home widgets must filter by `screenPermissions` / role defaults — not role-name alone when granular map exists.
- Soft shell nav filter is not a substitute for metric permission metadata.

## Classification summary

| Item | Active / Legacy / Experimental |
|------|--------------------------------|
| FinancialDashboard Home | Active (to migrate) |
| pages/Dashboard | Legacy orphan → cutover delete when unused |
| components/Dashboard | Legacy orphan → cutover delete when unused |
| CbmsDashboard | Orphan compliance; retain file, not Home |
| dashboardQueryEngine | Active engine; wire via Home adapter |
| Fake KPIs | None on production Home |

## Gate for UI-5.2+

Every displayed financial metric must appear in `UI5_DASHBOARD_METRIC_AUTHORITY_MAP.json` with company, fiscal/date, permission, freshness, and drill-down. Metrics without authority are deferred or removed — never invented in React.
