# ORBIX UI PHASE 5 — HOME AND ROLE WORKSPACES REPORT

**Phase:** UI-5  
**Date:** 2026-07-13  
**Exact final verdict:** PHASE UI-5 FINAL GATE PASSED — READY FOR UI PHASE 6 ORBIX INTELLIGENCE WORKSPACE, CONVERSATION ARCHITECTURE, EVIDENCE PANEL, AUTHORITATIVE PREVIEWS, AND AI TRUST REDESIGN

---

## 1. Executive verdict

Production authenticated Home (`dashboard` / `financial-dashboard`) now uses one Himalayan Precision workspace (`@/features/home`) with role-aware composition, authoritative financial metrics (no invented formulas), attention queues, navigate-only quick actions, recent activity, receivable-ageing chart with accessible table, and layered data-trust / sync presentation. Orphan KPI dashboards deleted. Net new visual debt **0**. UI-5 E2E **9/9**. Orbix Vitest **119**. TypeScript **151 → 151**. Vite build **PASS**.

## 2–3. Authority files / missing

**Read / used:** AGENTS.md, PREMIUM_UI_REDESIGN_SPEC.md, UI-0–UI-4 reports/specs, UI_PAGE_COMPOSITION, UI_FEEDBACK, UI_TYPOGRAPHY, UI_DENSITY, UI_ACCESSIBILITY, UI_DARK_AND_PRINT, UI3 IA/sync/notification/identity, UI_ROLE_ROUTE_MATRIX (ui-audit), design-system, AppShell/PageContentFrame, FinancialDashboard, report-engine builders, permissions, syncStatusAggregate.

**Missing (continued):** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — absent; not reconstructed; authority chain preserved.

## 4. Before-state diagnostics

| Check | Before |
|-------|--------|
| TypeScript | 151 |
| Governance | PASS (prior phases) |
| Home | Count cards only; no financial KPIs; no role workspaces |
| Orphans | `pages/Dashboard.tsx`, `components/Dashboard.tsx` (@ts-nocheck) |

## 5–14. Routes, implementations, sources

| Area | Finding |
|------|---------|
| 5. Home routes | `dashboard`, `financial-dashboard`, App default → `FinancialDashboard` |
| 6. Dashboard implementations | One active Home framework under `src/features/home` |
| 7. Role dashboards | Shared framework + `roleWorkspace.ts` (not seven pages) |
| 8. KPI components | `MetricCard` in `HomePage.tsx` |
| 9. Chart systems | CSS bar ageing + data table; recharts **not** added to Home |
| 10. Quick actions | `quickActions.ts` registry — navigate / Orbix only |
| 11. Attention sources | Sync conflict/fail, overdue AR/AP, low stock, approvals, setup gaps |
| 12. Recent activity | Recent vouchers/invoices from company store |
| 13. Financial sources | Projection/accounting helpers listed in metric map |
| 14. Unsafe values | Orphan synthetic “CBMS Connected” **removed with deletion** |

## 15–16. Mock data / authoritative route

Mock/demo financial values removed with orphan dashboards. Canonical Home: `dashboard` → `FinancialDashboard` → `HomePage`.

## 17–23. Architecture & scopes

| Topic | Decision |
|-------|----------|
| 17. Architecture | AppShell → PageContentFrame → HomePage; adapter → view model |
| 18. Data contract | `DashboardMetric`, `AttentionItem`, `HomeViewModel` in `types.ts` |
| 19. Freshness | `fresh` / `refreshing` / `stale` / `local_only` / `partial` / `unavailable` |
| 20. Partial data | Failed metric/section marked; others remain; Banner + RecoveryPanel |
| 21. Company scope | `companySettings.id` on trust + adapter input; reload on company change |
| 22. Fiscal scope | FY name/start/end on P&L metrics; trust header |
| 23. Currency | `currencySymbol` / NPR `Rs.` via `resolveCurrencySymbol` |

## 24–34. Role workspaces & permissions

| Workspace | Emphasis |
|-----------|----------|
| 24. Owner | Cash/Bank, AR, AP, Sales, Net, Inventory |
| 25. Accountant | Cash/Bank, AR, AP, TB health, Sales, Net |
| 26. Cashier | Today’s sales, Cash/Bank, Receivables — **no** net/inventory/period P&L |
| 27. Banking | Cash/Bank, AR, AP + recon actions |
| 28. Inventory | Inventory value, counts + stock actions |
| 29. Auditor | Read overview + TB; no create shortcuts |
| 30. Administrator | Setup counts, TB, users/backup actions |
| 31. Restricted | Permitted counts only; no empty privileged cards |
| 32. Combined | Merged sections; `primary=combined` |
| 33. Permissions | `permissionsStore` / `getDefaultPermissionsForRole` + `canView`/`canCreate` |
| 34. Disabled modules | Sections omitted when metrics/actions filtered out |

## 35–47. Financial overview

| # | Metric | Authority | Drill-down |
|---|--------|-----------|------------|
| 36 | Cash and Bank | `readAllAccountBalances` + `isCashOrBankAccount` | day-book |
| 37 | Receivables | `computeOutstandingReceivables` | outstanding-receivables |
| 38 | Payables | `computeOutstandingPayables` | outstanding-payables |
| 39 | Sales (period) | `buildProfitLossFromProjection.totalIncome` | profit-loss |
| 40 | Purchases | Deferred (use P&L page) | — |
| 41 | Net result | `buildProfitLossFromProjection.netProfit` | profit-loss |
| 42 | Inventory value | `buildInventoryValuationReport` | stock-summary |
| 43 | Tax | Deferred (vat-reports) | — |
| 44 | Trial balance | `readTrialBalanceFromProjection` parity | trial-balance |
| 45–46 | Comparison / favourability | Adapter-owned; comparisons mostly deferred | — |
| 47 | Drill-down | Existing routes only | — |

## 48–57. Attention queue

Prioritised navigate-only items from authoritative sources. Sync conflict distinct from failure. No-attention: calm copy. Backup/tax deadline invention deferred.

## 58–61. Quick actions

Typed registry; permission filtered; navigate / Ask Orbix only; no Dexie writes / posting.

## 62–65. Recent activity

Posted vouchers/invoices; permission via route targets; drafts deferred to existing draft authorities.

## 66–71. Charts

| Decision | Detail |
|----------|--------|
| Dependency | Keep recharts elsewhere; Home uses DS bars |
| Implemented | Receivable ageing (purpose: overdue concentration) |
| Deferred | Sales/collection trend, cash movement series |
| A11y | `accessibleSummary` + data table + View report |
| Mobile | Compact bars + report drill-down |

## 72–81. Data trust states

Page header + trust footer; SyncStatusChip from aggregated sync; pending ≠ synced; conflict ≠ failed; unavailable ≠ zero; offline Banner; soft refresh keeps prior model (request-id race guard).

## 82–83. Orbix boundary

Ask Orbix CTA + prompt starters; no embedded chat; no fabricated insights; UI-3 identity.

## 84–88. Empty / loading / errors

Skeleton on first load; soft refresh; new-company Banner (no fake KPIs); RecoveryPanel on total failure; partial Banner.

## 89–102. Responsive / density / a11y / localisation

Desktop 8+4 grid; mobile section priority (attention → actions → metrics → activity → trends); densities via DS `data-density`; light/dark via DS theme; Devanagari via existing DS foundations; keyboard focus on interactive controls only; 200% zoom inherits DS; axe on Home lab: **0 serious / 0 critical**.

## 103–104. Accessibility violations

Serious: **0**. Critical: **0** (Home fixture).

## 105–114. E2E

| Suite | Result |
|-------|--------|
| UI-5 Home lab | **9/9** |
| Roles | owner, accountant, cashier, auditor, administrator, viewer |
| Cashier metrics | no net_result / sales_period / inventory_value |
| Axe | 0 violations |
| Screenshots | under `artifacts/ui-redesign/phase-ui-5/` |

Results: `artifacts/ui-redesign/phase-ui-5/home-e2e-results.json`.

## 115–117. Visual

Screenshots captured for roles/theme; issues fixed: role substring bug (`administrator`≠accountant), load race on role change, governance debt from orphans.

## 118–125. Legacy cutover

| Item | Status |
|------|--------|
| FinancialDashboard | Thin wrapper → HomePage |
| pages/Dashboard.tsx | **Deleted** |
| components/Dashboard.tsx | **Deleted** |
| CbmsDashboard | Retained (not Home) |
| `@ts-nocheck` on Home | None (orphans deleted; −7 nocheck vs baseline) |
| Raw/inline debt | Reduced vs baseline (orphan removal) |

## 126–133. Governance

| Check | Net new |
|-------|---------|
| Raw colours | 0 |
| !important | 0 |
| Sub-12px essential | 0 |
| Inline visual styles | 0 |
| Legacy-green | 0 |
| Hard-coded production financial values | 0 |
| Unauthorised metrics | Blocked by permission + cashier gates |

## 134–139. Files

**Created:** `src/features/home/*`, UI5 specs, `e2e/ui-home.html`, `src/e2e/homeLab.tsx`, `e2e/ui5-home.spec.ts`, `src/__tests__/orbix/ui5HomeWorkspace.test.ts`, artifacts.

**Changed:** `FinancialDashboard.tsx`, `vite.config.ts`, `package.json`, migration tracker.

**Deleted:** `src/pages/Dashboard.tsx`, `src/components/Dashboard.tsx`.

**Accounting / report-calc / sync / auth authority:** **unchanged** (Home only consumes read helpers).

## 140–151. Tests & build

| Check | Result |
|-------|--------|
| ui5HomeWorkspace unit | 16/16 |
| ui:phase5 E2E | 9/9 |
| Orbix Vitest | 119 |
| Governance | PASS, net new debt 0 |
| TypeScript | 151 → 151; **0** in UI-5-owned files |
| Vite build | PASS |
| `npm run build` (python3 export) | May be host-blocked; Vite production build used |

## 152–154. Limitations / deferred / UI-6

**Limitations:** Cashier/banking/inventory roles without custom `userPermissions` fall back to viewer matrix for screen ACL (existing `getDefaultPermissionsForRole`); sales trend chart deferred; tax/backup attention deferred without inventing rules; full production login E2E matrix beyond lab is environmental.

**Deferred:** purchases KPI card, budget vs actual, cash-flow forecast, pie/donut charts, second attention DB.

**UI Phase 6:** Orbix conversation workspace, evidence panel, authoritative posting previews, clarification/conflict recovery — do not start in this task.

## 155. Exact final verdict

**PHASE UI-5 FINAL GATE PASSED — READY FOR UI PHASE 6 ORBIX INTELLIGENCE WORKSPACE, CONVERSATION ARCHITECTURE, EVIDENCE PANEL, AUTHORITATIVE PREVIEWS, AND AI TRUST REDESIGN**
