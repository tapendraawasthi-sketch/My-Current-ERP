# UI-5 — Attention Queue Spec

**Builder:** `buildAttention` in `dashboardAdapter.ts`  
**UI:** Home `Attention` section — navigate-only buttons

## Purpose

Surface **authoritative** issues that need human review. Home never invents attention categories or invents compliance deadlines without a safe source.

## Priority order (lower = higher urgency)

| Priority | Category | Source | Typical severity |
|----------|----------|--------|------------------|
| 1 | `sync_conflict` | `getAggregatedSyncStatus` conflict | danger |
| 2 | `failed_synchronization` | sync failed / failedCount | danger |
| 3 | `pending_approval` | vouchers `submitted` / `pending_approval` | info |
| 4 | `overdue_receivable` / `overdue_payable` | `computeAgingReport` | warning |
| 5 | `low_stock` | items reorder vs qty | warning |
| 6 | `incomplete_setup` | empty parties / items | info |

Sort: `priority` ascending, then `title` localeCompare. Items without a declared `permission` remain; declared permissions are filtered via `canViewScreen`.

## Navigate-only actions

Each item may expose `route` + `actionLabel`. Click calls `setCurrentPage(route)` (or no-op if no route).

**Forbidden on Home attention:**

- Approving vouchers
- Posting settlements
- Resolving sync conflicts in-place
- Fabricating “fix now” mutations

Copy may say “Open …”, “Review …”, “Add …” as **navigation** into existing workflows.

## Do not invent categories

Deferred / out of scope for UI-5 Home unless a later phase adds an authoritative store:

- Tax filing deadlines
- Backup age SLAs without backup authority
- Synthetic “CBMS Connected”
- Marketing tips or Orbix-generated insights presented as attention

Orbix prompts live in a separate section and open Orbix — they are not attention queue items.
