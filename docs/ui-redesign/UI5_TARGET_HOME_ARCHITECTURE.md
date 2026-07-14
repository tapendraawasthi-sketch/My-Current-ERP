# UI-5 — Target Home Architecture

**Phase:** UI-5 (Himalayan Precision)  
**Canonical Home:** `src/features/home/HomePage.tsx`  
**Route wrapper:** `src/pages/FinancialDashboard.tsx` → thin re-export of `HomePage`

## Hierarchy

```text
App (authenticated)
  → Layout
    → AppShell (chrome: nav, top bar, sync, notifications)
      → PageContentFrame
        → FinancialDashboard (page id: dashboard | financial-dashboard | default)
          → HomePage
            → useHomeDashboard
              → buildHomeViewModel (dashboardAdapter)
```

Home is a **feature page** inside AppShell. It does not own shell chrome, sync authority, or accounting math.

## Hybrid one-framework model

One `HomePage` composition serves all roles. Role differences are **section order and metric/action selection**, not separate page trees:

| Concern | Source |
|---------|--------|
| Workspace id / label | `resolveWorkspaces` (`roleWorkspace.ts`) |
| Metric shortlist | `WORKSPACE_METRICS` |
| Section order (desktop) | `WORKSPACE_SECTION_ORDER` |
| Section order (mobile) | `MOBILE_SECTION_ORDER` |
| Quick actions | `selectQuickActions` + permission gates |
| Charts | Adapter: receivable ageing only for eligible workspaces |

Sections rendered: `attention`, `financial`, `quickActions`, `trends`, `activity`, `orbix` — present or omitted per workspace order and data availability.

## Data flow

```text
useStore (company, FY, user, accounts, parties, items, invoices, vouchers)
  + permissionsStore
    → useHomeDashboard.load()
      → buildHomeViewModel(HomeAdapterInput)
        → authoritative readers/helpers (balances, P&L, TB, ageing, outstanding, sync aggregate)
        → typed HomeViewModel
          → HomePage presentation only
```

Rules:

- Presentation never invents totals, favourability, or freshness.
- Adapter may mark metrics `unavailable` / freshness `partial` when a source fails; other sections remain.
- Quick actions and attention items **navigate only** (`setCurrentPage` / Orbix panel open).

## Refresh / partial policy

| Mode | Behaviour |
|------|-----------|
| Initial load | `loading=true`; no prior model → skeleton |
| Soft refresh | `refreshing=true`; **prior model kept** until new VM arrives |
| Soft refresh failure | Prior model retained; error message optional |
| Hard retry (no model) | Clears to error/recovery panel |
| Company / FY / user identity change | Full reload |

Partial source failures populate `partialErrors` and may set trust freshness to `partial` without blanking the page.

## Cutover

| Before | After |
|--------|-------|
| `FinancialDashboard` owned Home UI | `FinancialDashboard` wraps `HomePage` |
| App routes unchanged (`dashboard`, aliases) | Same page ids → same wrapper |
| Orphan `pages/Dashboard.tsx`, `components/Dashboard.tsx` | Deprecated; not Home |
| `CbmsDashboard` | Not Home (statutory/CBMS monitor) |

See `UI5_LEGACY_DASHBOARD_CUTOVER_MAP.md`.
