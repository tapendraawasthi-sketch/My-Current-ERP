# UI-3 Sync-State Presentation Spec

**Authority (unchanged):** `syncEngine` + platform `syncQueue` / `syncCoordinator`.

**UI adapter:** `getAggregatedSyncStatus` → `SyncStatusControl`.

## States

| State | Meaning |
|-------|---------|
| synced | No pending/failed/conflict; remote ack observed when available |
| pending | Local events awaiting sync — **not** remotely acknowledged |
| syncing | Worker actively processing |
| retry_scheduled | Failed queue items with retry available (online) |
| failed | Hard legacy error path |
| conflict | Material conflict — distinct from failure |
| action_required | Dead-letter / attention |
| offline | Network down; pending counts preserved |
| stale | No pending but last remote ack aged (>7 days) |
| local_only | Company sync policy local-only |

**Never** show Synced solely because a local Dexie write succeeded.
