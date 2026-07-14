# UI-6 — Stale Preview and Conflict UX Spec

**Stale gate authority:** `orbixPostingService.executeOrbixConfirm`  
**Store recovery:** `eKhataStore.confirmPending` retains `pendingCard` on `stale_preview` and mode/permission denial  
**Sync conflict:** distinct from local posting failure; prefer `sync_status: conflict` + shell sync centre

## Stale preview

### Detection

When both `cmd.previewHash` and card `preview_hash` / `previewHash` are present and **unequal**:

| Result | Value |
|--------|--------|
| `response_type` | `validation_error` |
| `error_code` | `stale_preview` |
| `safe_message` | This preview is out of date. Generate a new preview before confirming. |
| `retryable` | true |
| `draft_retained` | true |

### UX requirements

1. Show the safe message in a danger/validation card — do not post.
2. **Retain** the pending card so the user is not left without context (current behaviour).
3. Primary recovery: request a **new preview** (re-run draft/preview flow) — do not offer “force post”.
4. Disable or clearly mark Confirm until a fresh hash is present.
5. Context panel should note that the displayed preview may be outdated after a stale error.

### Incomplete preview

Separate path: `invalid_preview` when confirmation payload incomplete (no journal/amount where required). Same non-posting UX; fix draft rather than force.

## Mode / permission conflicts

| Condition | UX |
|-----------|-----|
| Ask Mode confirm attempt | Permission / mode restriction — switch to Accountant; retain draft |
| Role cannot post | Permission denied — no bypass |
| Server mode_policy deny | `mode_restriction` card — preserve original request when payload says so |

## Sync conflicts (post-local-success)

Local posting can succeed while remote sync is `conflict` / `failed` / `pending`.

| State | User-facing |
|-------|-------------|
| Local posted, sync pending/omitted | Posted locally + Waiting to sync (honest) |
| `sync_status: failed` | Local safe; sync failed — use shell sync recovery |
| `sync_status: conflict` | Conflict detected — review required; do not claim synced |
| Idempotent replay | Already posted — idempotent replay |

**Gap to close:** `confirmPending` often omits `sync_status` on the chat message — UI-6 should forward it so conflict/failed are not masked as generic pending.

## Conflict with shell sync

Orbix cards **present** posting-scoped sync fields. Global conflict lists remain Notification Centre / SyncStatusControl (UI-3). Do not create a second sync truth in Orbix.

## Copy rules

- Prefer `safe_message` from structured payloads.
- Never blame the user for “network error” when the code is `stale_preview`.
- Never say “synced” for local-only or conflict states.
