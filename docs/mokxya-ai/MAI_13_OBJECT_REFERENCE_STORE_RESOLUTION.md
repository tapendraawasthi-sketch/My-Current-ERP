# MAI-13 — Object-Reference Store Resolution (slice 2)

**Runtime:** `mai-13.0.2-slice2`  
**Authority:** ADR_0030

## Purpose

Resolve request-local object-reference candidates against durable stores
without mutating drafts or classifying turn-relation.

## Resolution statuses

| Status | Meaning |
|--------|---------|
| `FOUND` | Pending draft present in a khata JSON store |
| `MISSING` | Draft id not found in any store |
| `NOT_PENDING` | Draft record exists but `posted` / `cancelled` |
| `CONVERSATION_FOUND` | Row in `oip_conversations` |
| `CONVERSATION_MISSING` | DB present, no row |
| `SKIPPED` | Store unavailable, or non-draft UI object |

## Stores probed (read-only)

- `sales_drafts.json`, `purchase_drafts.json`, `sales_return_drafts.json`,
  `purchase_return_drafts.json`, `financial_drafts.json`, `bank_recon_drafts.json`
  under `ORBIX_DRAFT_STORE_DIR`
- `oip_conversations` via `OIP_DATABASE_URL` (sqlite RO)

## Non-goals

- Turn-relation / merge gating (MAI-14)
- Calling `save_draft` / `mark_posted` / `start_or_merge_*`
