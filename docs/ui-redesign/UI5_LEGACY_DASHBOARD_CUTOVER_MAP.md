# UI-5 — Legacy Dashboard Cutover Map

## Active Home cutover

| Page id | Before | After |
|---------|--------|-------|
| `dashboard` | `FinancialDashboard` (counts-only UI) | `FinancialDashboard` → **`HomePage`** |
| `financial-dashboard` | Same | Same wrapper |
| App `default` fallback | `FinancialDashboard` | Same |

```tsx
// src/pages/FinancialDashboard.tsx
import { HomePage } from "@/features/home/HomePage";
const FinancialDashboard = () => <HomePage />;
```

Routing and store `currentPage: "dashboard"` are unchanged. No React Router `/home` path.

## Orphan / deprecated (not Home)

| Path | Status | Notes |
|------|--------|-------|
| `src/pages/Dashboard.tsx` | **Deleted** | Orphan KPI dashboard; zero imports; removed in UI-5 cutover |
| `src/components/Dashboard.tsx` | **Deleted** | Orphan KPI dashboard; zero imports; removed in UI-5 cutover |
| `src/pages/CbmsDashboard.tsx` | **Not Home** | CBMS / statutory monitor; live UI elsewhere (e.g. StatutoryCompliance) — do not treat as Home cutover |

## Do not migrate as Home

- Falcon stale docs claiming charts on Financial Dashboard
- Orphan dashboard hard-coded connection badges
- Reimplementing KPI math inside page components

## Verification before deleting orphans

1. Repo-wide import search for `pages/Dashboard` and `components/Dashboard`
2. Confirm no dynamic import / falcon-only runtime load in production App
3. Then delete deprecated files in a follow-up cleanup PR
