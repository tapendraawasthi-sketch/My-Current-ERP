# UI-5 — Dashboard Chart and Comparison Spec

## Default chart set

| Chart | Status | Source |
|-------|--------|--------|
| Receivable ageing buckets | **Default (UI-5)** | `buildAgingReportFromProjection` → `DashboardChartModel` |
| Sales trend / sparklines | **Deferred** | No Home chart until period series authority is wired |
| Payable ageing | Deferred | Not on Home by default |
| recharts library on Home | **Not added** | Dependency may exist elsewhere; Home does not import it |

Shown only for workspaces: `owner`, `accountant`, `auditor`, `combined`, and only when the user can view `salesVoucher`.

## Presentation (no recharts)

Home renders ageing with:

1. **Accessible summary** — `sr-only` + `role="img"` `aria-label` from `accessibleSummary`
2. **CSS bar rows** — proportional width bars from bucket amounts
3. **Data table** — bucket / count / amount (`<table>` with caption)

Drill-down: navigate to `debtors-aging` (or model `drillDownRoute`). Unavailable charts show reason text, empty buckets.

## Comparisons

Metric `comparison` is optional on the type for future use. UI-5 Home does **not** invent period-over-period deltas. Favourability tones come only from `favourability` hints supplied by the adapter (`metricTone` in `format.ts`).

## Deferred

- Sales trend charts
- Adding `recharts` (or any chart lib) to the Home bundle
- Client-side synthetic series
