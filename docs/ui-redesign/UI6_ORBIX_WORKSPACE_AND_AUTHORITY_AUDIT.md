# UI-6 — Orbix Workspace and Authority Audit

**Phase:** UI-6.0 (docs / architecture)  
**Date:** 2026-07-13  
**Missing authority file:** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — **absent**; not reconstructed.

## Authority chain used

1. `AGENTS.md`
2. Phase UI-6 prompt (verified audit facts)
3. Production Orbix path as behaviour evidence
4. `src/lib/ekhata/orbixResponseTypes.ts` (schema 1.0)
5. `src/lib/ekhata/orbixPostingService.ts` + `src/store/eKhataStore.ts`
6. Python `erp_bot/src/api/oip_chat_ingress.py` + `erp_bot/src/orbix/mode_policy.py`
7. Phase UI-0–UI-5 reports and migration tracker

## Production path (canonical)

```text
App.tsx (currentPage === "orbix")
  → OrbixWorkspacePage
    → OrbixWorkspace (variant="page")
```

| Layer | File | Role |
|-------|------|------|
| Route switch | `src/App.tsx` case `"orbix"` | Page id authority (Zustand `currentPage`) |
| Page wrapper | `src/pages/OrbixWorkspacePage.tsx` | Opens/maximizes eKhata panel store; renders page variant |
| Workspace UI | `src/components/ekhata/OrbixWorkspace.tsx` | Conversation chrome, mode, messages, confirm/cancel |
| Overlay twin | `src/components/ekhata/EKhataPanel.tsx` | Floating/maximized overlay when **not** on orbix page |

**EKhataPanel gate:** when `currentPage === "orbix"`, `EKhataPanel` **returns `null`**. The full-page route owns the workspace UI; the floating panel must not double-mount.

## Runtime flow

### A. Open Orbix (page)

1. User navigates via launcher / Home CTA / command → `setCurrentPage("orbix")` (Falcon panel closed if open).
2. `App` renders `OrbixWorkspacePage`.
3. Page effect: `openPanel()` + `maximizePanel()` on `eKhataStore`; cleanup `minimizePanel()`.
4. `OrbixWorkspace variant="page"` mounts inside AppShell main content.
5. `EKhataPanel` evaluates `currentPage === "orbix"` → **null** (no overlay duplicate).

### B. Open Orbix (overlay, non-orbix page)

1. User opens eKhata panel while on another page (`isOpen`, not minimized).
2. `EKhataPanel` mounts `OrbixWorkspace variant="overlay"` (docked or maximized chrome).
3. Same store (`eKhataStore`) — sessions, messages, mode, pending card shared.

### C. Ask / read path (no mutation)

1. User sends message → `eKhataStore.sendMessage`.
2. Client attaches `orbix_mode` (`ask` | `accountant`) via Qwen/OIP client.
3. Ingress: `oip_chat_ingress` + `mode_policy.normalize_orbix_mode`.
4. Ask Mode: mutations / draft tools blocked server-side (`mode_policy`); client may receive `mode_restriction`.
5. Response parsed to schema **1.0** (`parseOrbixResponse` / `orbixResponseTypes`).
6. `OrbixResponseRenderer` switches on `response_type` (not prose).

### D. Accountant preview → confirm → post

1. Accountant Mode only: draft / preview / confirmation cards from structured responses + legacy card bridge.
2. UI shows `pendingCard` / journal via `OrbixJournalCard` (preview authority fields: `draft_id`, `preview_hash`, `idempotency_key`, `preview_version`).
3. User confirms → `eKhataStore.confirmPending`.
4. `executeOrbixConfirm` (`orbixPostingService`):
   - Requires `confirmation === true`
   - **Ask Mode blocked** (`orbixMode !== "accountant"` → `permission_denied` / `mode_restriction`)
   - Role gate (accountant/admin/manager)
   - **Stale preview gate:** `cmd.previewHash` vs card `preview_hash` → `validation_error` / `stale_preview`
   - Domain posting via existing sales/purchase/settlement/treasury helpers (unchanged authority)
   - Idempotency keys via `buildIdempotencyKey` / card `idempotency_key`
5. Success message appended as `posting_completed` structured response.

### E. Sync presentation gap (verified)

`orbixPostingService` maps domain `sync_status` into `OrbixPostingResult.payload.sync_status` when present.

**Gap:** `confirmPending` often builds the chat `posting_completed` `orbixResponse.payload` **without** copying `sync_status` / `sync_event_id` from the posting result (single confirm and batch paths). UI then falls back to generic “Waiting to sync” / offline heuristics in `OrbixResponseRenderer` even when the posting layer knew sync state.

Local posting success ≠ remote sync success — UI-6 must preserve that separation and close the omit gap in presentation wiring (not by inventing sync truth in the chat layer).

## Authority map

| Concern | Authority | Must not |
|---------|-----------|----------|
| Conversation / sessions / mode / pending card | `eKhataStore` | Parallel chat stores for production Orbix |
| Structured response contract | `orbixResponseTypes` schema **1.0** | Prose-as-authority; invent new discriminators without schema bump |
| Confirm / post orchestration | `orbixPostingService.executeOrbixConfirm` | Client-only “posted” claims without service result |
| Ask vs Accountant capability | Client mode + Python `mode_policy` (+ ingress) | LLM as security authority |
| RBAC | User role + existing permission helpers | Mode alone as RBAC |
| Chat ingress | `oip_chat_ingress` | Bypass mode normalize |
| Sync aggregate (shell) | `getAggregatedSyncStatus` / shell SyncStatusControl | Treat Orbix “Posted locally” as synced |
| Design tokens today | `--ox-*` on Orbix surfaces | Assume already on `--ds-*` |
| Product identity | **Orbix** workspace; Falcon / Sutra are **parallel** identities | Merge Falcon UI into Orbix cutover without explicit decision |

## Design / identity (before-state)

| Item | Status |
|------|--------|
| Tokens | Orbix UI uses `--ox-*` (and related) heavily today |
| Migration direction | Coexist then migrate presentation to `--ds-*` / design-system primitives (UI-1+) |
| Falcon | Parallel assistant identity (`falconStore`, markdown panel); closed when opening Orbix |
| Sutra | Product / brand identity (ERP shell) — not the Orbix conversation chrome |
| `ORBIX_UI_DEEP_RESEARCH…` | File **absent** — do not invent contents |

## Legacy / unused

| Path | Status |
|------|--------|
| `src/components/orbix/OrbixPanel.tsx` | **Legacy unused** — zero production imports; `orbixStore`-based v2 panel; **not** the production path |
| Orphan dashboards (UI-5) | Out of Orbix scope |

## Classification summary

| Item | Active / Legacy / Experimental |
|------|--------------------------------|
| `OrbixWorkspacePage` + `OrbixWorkspace` | **Active** canonical |
| `EKhataPanel` overlay | **Active** (non-orbix pages only) |
| `OrbixResponseRenderer` | **Active** structured presentation |
| `ContextInspector` | **Active** evidence/context aside |
| `OrbixPanel` (`components/orbix`) | **Legacy unused** |
| Heuristic text classification | **Deprecated fallback** only when `orbixResponse` missing |

## Related specs (this phase)

- `UI6_STRUCTURED_RESPONSE_AUTHORITY_MAP.json`
- `UI6_TARGET_ORBIX_WORKSPACE_ARCHITECTURE.md`
- `UI6_CONVERSATION_PRESENTATION_SPEC.md`
- `UI6_EVIDENCE_AND_CONTEXT_PANEL_SPEC.md`
- `UI6_AUTHORITATIVE_PREVIEW_SPEC.md`
- `UI6_STALE_PREVIEW_AND_CONFLICT_UX_SPEC.md`
- `UI6_ORBIX_ACCESSIBILITY_AND_KEYBOARD_SPEC.md`
- `UI6_LEGACY_ORBIX_CUTOVER_MAP.md`

## Non-goals (UI-6 docs / redesign)

- Do not modify accounting, Python domain posting, or invent new posting math.
- Do not reconstruct the missing deep-research report.
- Do not treat Falcon or Sutra as Orbix conversation cutover targets unless separately scoped.
