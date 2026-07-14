# UI-5 — Dashboard Data and Freshness Spec

**Types:** `src/features/home/types.ts`  
**Adapter:** `src/features/home/dashboardAdapter.ts`  
**Hook:** `src/features/home/useHomeDashboard.ts`

## `DashboardFreshness`

| Value | Meaning |
|-------|---------|
| `fresh` | Sync aggregate reports synced / healthy local read |
| `refreshing` | Soft refresh or syncing in progress |
| `stale` | Pending, offline, retry, or explicit stale sync |
| `local_only` | Device has no remote sync authority |
| `partial` | Conflict / failed sync, or some metric sources failed |
| `unavailable` | This metric/chart could not be computed |

Mapped from `getAggregatedSyncStatus` in the adapter (`mapSyncToFreshness`). Soft refresh forces `refreshing` while the request runs.

## Adapter contract

`buildHomeViewModel(input: HomeAdapterInput): Promise<HomeViewModel>`

**Inputs (read-only):** company identity, FY, user/role, permissions, store entity arrays, `online`, optional `refreshing`.

**Outputs:** typed `metrics`, `attention`, `quickActions`, `activity`, `charts`, `trust`, `sectionOrder`, `partialErrors`, flags (`isNewCompany`, `isEmptyActivity`).

**Must not:**

- Reimplement trial balance, P&L, settlement, or inventory valuation math
- Invent categories, deadlines, or CBMS connection claims
- Post vouchers or mutate ledgers

**May:**

- Call existing helpers (`readAllAccountBalances`, `buildProfitLossFromProjection`, `computeOutstanding*`, `buildAgingReportFromProjection`, `getAggregatedSyncStatus`, …)
- Return `formattedValue: "—"` and `freshness: "unavailable"` per failed metric
- Continue building remaining sections after a partial failure

## Metric shape (presentation contract)

Each `DashboardMetric` carries: `id`, `label`, `value` | null, `formattedValue`, `freshness`, `asOf`, `sourceLabel`, `permission`, `favourability`, optional drill-down and comparison. UI formats via adapter/`formatHomeAmount` — components do not recalculate.

## Refresh keeps prior data

| Event | `loading` | `refreshing` | `model` |
|-------|-----------|--------------|---------|
| First load | true → false | false | null → VM |
| Soft refresh (`refresh()`) | false | true → false | **previous VM until success** |
| Soft refresh error | false | false | **previous VM kept** |
| Hard failure (no prior) | false | false | null + error UI |

Company / fiscal year / user identity changes trigger a full reload. Presentation shows skeletons only when there is no retained model.
