# UI-6 — Legacy Orbix Cutover Map

**Phase:** UI-6  
**Production gate:** `src/App.tsx` → `currentPage === "orbix"` → `OrbixWorkspacePage` → `OrbixWorkspace`  
**Rule:** Do not revive unused panels as production. Do not change posting/domain authorities during presentation cutover.

## Production path (keep)

| Step | Component | File |
|------|-----------|------|
| Route | App switch `"orbix"` | `src/App.tsx` |
| Page | `OrbixWorkspacePage` | `src/pages/OrbixWorkspacePage.tsx` |
| Workspace | `OrbixWorkspace` | `src/components/ekhata/OrbixWorkspace.tsx` |
| Overlay (other pages) | `EKhataPanel` → null on orbix page | `src/components/ekhata/EKhataPanel.tsx` |
| Store | `eKhataStore` | `src/store/eKhataStore.ts` |
| Posting | `orbixPostingService` | `src/lib/ekhata/orbixPostingService.ts` |
| Schema | `orbixResponseTypes` 1.0 | `src/lib/ekhata/orbixResponseTypes.ts` |

## Legacy / unused (do not use as primary)

| File | Former role | UI-6 status |
|------|-------------|-------------|
| `src/components/orbix/OrbixPanel.tsx` | Orbix v2 grounded panel (`orbixStore`) | **Legacy unused** — zero production imports |
| Heuristic-only assistants without `orbixResponse` | Text classification | Deprecated fallback only |
| Falcon panel as Orbix | Parallel identity | Close when opening Orbix; not cutover target |
| Sutra branding in chat | Product brand | Shell identity; not Orbix conversation chrome |

## Overlay vs page cutover rule

| Context | UI |
|---------|-----|
| `currentPage === "orbix"` | Page workspace only; **EKhataPanel returns null** |
| Other pages + panel open | Overlay `OrbixWorkspace` |
| Same store | Shared sessions/messages/mode/pending |

## Design-system cutover (presentation only)

| Before | After |
|--------|-------|
| `--ox-*` tokens on Orbix surfaces | **Done** — ekhata Orbix surfaces use `--ds-*` |
| Generic chat bubbles for structured responses | **Done** — `TrustChrome` + typed renderer |
| Confirm “yes” / generic labels | **Done** — `confirmButtonLabel(intent)` |
| Missing sync_status on posting_completed | **Done** — `normalizePostingSyncStatus` forward |
| Falcon/Sutra on Orbix page | **Done** — providers not mounted when `currentPage === "orbix"` |
| Stale preview still confirmable in UI | **Done** — confirm disabled + banner when `stale_preview` present |

## Deletion conditions (not met for OrbixPanel)

Delete deprecated panels only when: zero imports, tests green, documented. `OrbixPanel.tsx` remains for now (unused).

## Gate status

**MIG-033 done** — see `ORBIX_UI_PHASE6_INTELLIGENCE_WORKSPACE_REPORT.md`.

| Ad hoc cards | Prefer DS Feedback / Button / FormField where behaviour matches |
| Sync omit on confirm message | Forward `sync_status` from posting result |

Accounting / Python / domain posting files: **out of cutover scope**.

## Verification before deleting legacy

1. Repo-wide import search for `components/orbix/OrbixPanel` and `orbixStore` production usage.
2. Confirm App never dynamic-imports legacy panel.
3. Confirm EKhataPanel null-on-orbix still holds after redesign.
4. Then delete unused files in a follow-up cleanup PR if desired.

## Missing research file

`ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` remains **absent**. Cutover maps must not invent requirements from that file.

## Tracker

MIG-033 Orbix → **UI-6 in progress** (architecture docs landed; presentation migration pending).
