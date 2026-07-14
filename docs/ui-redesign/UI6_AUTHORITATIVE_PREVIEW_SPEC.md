# UI-6 — Authoritative Preview Spec

**Authority:** Structured `transaction_preview` / `confirmation_required` / `journal_preview` payloads + `pendingCard` (legacy card bridge)  
**Confirm path:** `eKhataStore.confirmPending` → `executeOrbixConfirm` (`orbixPostingService`)  
**Schema:** 1.0 (`orbixResponseTypes`)

## What is authoritative

A preview is **authoritative for confirmation** only when it carries (or is bridged to a card that carries):

| Field | Role |
|-------|------|
| `draft_id` | Draft identity |
| `preview_hash` | Stale gate input |
| `preview_version` | Versioning |
| `idempotency_key` | Replay-safe confirm (or derived via `buildIdempotencyKey`) |
| Totals / journal lines | What the user is asked to confirm |
| `can_confirm` | UI enablement hint — still subject to mode + role |

Display text on the message is **not** the posting authority.

## Modes

| Mode | Preview | Confirm |
|------|---------|---------|
| Ask | May explain / sometimes preview capability per `mode_restriction.can_preview` | **Blocked** client + server |
| Accountant | Draft → preview → confirmation | Allowed if role + hash + confirmation flag pass |

Ask Mode blocked at:

- Client: `executeOrbixConfirm` when `orbixMode !== "accountant"`
- Server: `mode_policy` / ingress preprocess

Effective permission = **mode ∩ role ∩ company policy**. LLM is never the security authority.

## UI composition

1. **Conversation:** typed preview / confirmation display text via renderer (informational).
2. **Pending strip / `OrbixJournalCard`:** journal lines, totals, balanced indicator, Confirm / Cancel.
3. **Context inspector:** draft summary when pending.

Confirm button must call `confirmPending` only — never a parallel client write path.

## Idempotency

- Prefer `card.idempotency_key` when present.
- Else `buildIdempotencyKey({ draftId, previewHash, sessionId })`.
- Service stores receipts; idempotent replay surfaces as `idempotent_replay` on completed payload — UI must say already posted / replay, not invent a second voucher.

## Journal honesty

Use the existing balanced / unbalanced presentation pattern (green vs amber/red borders). Unbalanced previews must not look “ready to post” as success.

## Sync after confirm

Local success → `posting_completed` with **Posted locally**.  
Remote sync is a **separate** field (`sync_status`). Preview UI does not claim sync.

## Non-goals

- Reimplement domain posting in the workspace
- Allow confirm without `confirmation: true`
- Treat heuristic prose “here is your journal” as confirmable without structured/card authority
