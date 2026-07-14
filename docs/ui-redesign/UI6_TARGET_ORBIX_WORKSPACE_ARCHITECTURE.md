# UI-6 — Target Orbix Workspace Architecture

**Phase:** UI-6  
**Canonical page:** `src/pages/OrbixWorkspacePage.tsx`  
**Canonical workspace:** `src/components/ekhata/OrbixWorkspace.tsx`  
**Store authority:** `src/store/eKhataStore.ts`  
**Schema:** `orbixResponseTypes` **1.0**

## Hierarchy

```text
App (authenticated, currentPage === "orbix")
  → Layout / AppShell
    → PageContentFrame
      → OrbixWorkspacePage
        → OrbixWorkspace (variant="page")
          → OrbixChatSidebar (sessions)
          → Conversation column (messages + composer)
          → ContextInspector (evidence / context aside)
```

Overlay twin (non-orbix pages only):

```text
EKhataProvider
  → EKhataPanel
      → null if currentPage === "orbix"
      → else OrbixWorkspace (variant="overlay") + window controls
```

Orbix is a **feature workspace** inside AppShell. It does not own shell sync authority, RBAC matrices, or domain posting math.

## Hybrid one-workspace model

One `OrbixWorkspace` composition serves page and overlay. Differences are chrome (window controls, sizing), not separate conversation authorities.

| Concern | Source |
|---------|--------|
| Sessions / messages / pending card | `eKhataStore` |
| Operating mode | `eKhataStore.orbixMode` + `orbixOperatingMode` |
| Structured render | `OrbixResponseRenderer` on `response_type` |
| Confirm / cancel | `confirmPending` / `cancelPending` → `orbixPostingService` |
| Mode policy (server) | `mode_policy` via `oip_chat_ingress` |
| Evidence / context | `ContextInspector` (evolve per evidence spec) |
| Tokens | `--ox-*` today → migrate presentation to `--ds-*` |

## Data / control flow

```text
User input
  → eKhataStore.sendMessage
    → orbix client (orbix_mode) → oip_chat_ingress → mode_policy + tools
      → structured response (schema 1.0)
        → parseOrbixResponse
          → message.orbixResponse
            → OrbixResponseRenderer / pendingCard / report table

Confirm
  → confirmPending
    → executeOrbixConfirm (Ask blocked, role, preview_hash, idempotency)
      → domain posting helpers
        → posting_completed | posting_failed | permission_denied | validation_error
          → append orbixResponse (must forward sync_status when present)
```

Rules:

- Presentation never invents voucher numbers, balances, or sync success.
- Ask Mode cannot post (client + server).
- Preview confirm requires matching `preview_hash` and idempotency key.
- Falcon / Sutra remain parallel identities — not folded into this tree by default.

## Layout regions (target)

| Region | Responsibility |
|--------|----------------|
| Session rail | New chat, search sessions, select/delete |
| Mode bar | Ask / Accountant selector + honesty copy |
| Message stream | Typed responses; jump-to-latest; stick-to-bottom |
| Pending action strip | Confirm / cancel for authoritative preview |
| Composer | Input, send, stop; starters by mode |
| Context / evidence panel | Company, FY, mode, sources, pending draft summary, evidence refs |

## Cutover intent

| Before | After (UI-6) |
|--------|--------------|
| Production path already `OrbixWorkspacePage` | Keep path; redesign presentation to DS |
| `--ox-*` tokens | Map/migrate to `--ds-*` without changing posting authority |
| Sync status often omitted on confirm message | Forward `sync_status` from posting result |
| `OrbixPanel` legacy | Remain unused; do not revive as production |
| Heuristic text fallback | Keep only as last resort when structured payload missing |

See `UI6_LEGACY_ORBIX_CUTOVER_MAP.md`.

## Non-goals

- New accounting engines or Python posting rewrites
- Reconstructing absent `ORBIX_UI_DEEP_RESEARCH…` file
- Merging Falcon panel UX into Orbix without an explicit identity decision
