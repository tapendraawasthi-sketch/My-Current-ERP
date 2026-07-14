# UI-5 — Data Trust Presentation Spec

**Model:** `DataTrustContext` on `HomeViewModel.trust`  
**Sync authority:** `getAggregatedSyncStatus` (`src/platform/sync/syncStatusAggregate.ts`) — Home **presents**, does not redefine sync truth.

## Layered trust (what the user sees)

| Layer | Content |
|-------|---------|
| Page header | Workspace label, company name, freshness `StatusChip`, FY, as-of date, currency, `SyncStatusChip` |
| Banners | Offline, sync conflict, partial source failures, new-company empty state |
| Aside / mobile strip | Basis label, loaded-at, sync state + pending count |
| Per metric | Freshness label, period, unavailable reason |
| Attention | Sync conflict / failed items from aggregate |

## Sync mapping (presentation)

| Aggregate state | Freshness (typical) | Chip / banner |
|-----------------|---------------------|---------------|
| `synced` | `fresh` | Synced |
| `syncing` | `refreshing` | Syncing |
| `pending` / `retry_scheduled` / `offline` / `stale` | `stale` | Pending / offline / stale — **never labelled synced** |
| `local_only` | `local_only` | Local-only |
| `conflict` / `action_required` / `failed` | `partial` | Conflict / failed banner when counts warrant |

Home copies shell policy: pending is not synced; conflict is distinct from failure.

## Rules

- Company / FY / currency / as-of come from store + adapter clock (`asOf` = local ISO date).
- `basisLabel` discloses read path (e.g. projection + accounting helpers).
- Partial metric errors do not clear successful metrics.
- No hard-coded “cloud connected” or CBMS badges on Home.
