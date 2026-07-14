# UI-6 — Evidence and Context Panel Spec

**Current surface:** `src/components/ekhata/ContextInspector.tsx`  
**Host:** `OrbixWorkspace` aside (default open ≥1440px width)  
**Label:** `aria-label="Context inspector"`

## Purpose

Give accountants a stable, non-chat view of **what Orbix is using** — company, period, mode, data sources, pending preview summary, and (target) evidence references — without implying that prose in the chat is the ledger of record.

## Current sections (before-state)

| Block | Content | Authority |
|-------|---------|-----------|
| Company | Active company display name | `useStore` company settings via workspace props |
| Period | Fiscal year name | `currentFiscalYear` |
| Mode | Ask / Accountant + short honesty line | `orbixMode` / `ORBIX_MODE_META` |
| Data sources | Static “Company ledger · Inventory · Masters” + LLM online/limited | `llmOnline` / `llmModel` |
| Report | Title when a report is attached | `OrbixReportPayload` |
| Pending | Draft / amount summary when `pendingCard` set | Confirmation card fields |

## Target evidence model

| Layer | What to show | What not to invent |
|-------|--------------|--------------------|
| Context | Company, FY, mode, provider online/offline | “Fully synced” without shell sync authority |
| Draft / preview | `draft_id`, transaction type, preview hash short form, balanced journal flag | Editable amounts that bypass posting service |
| Evidence refs | Tool traces, report ids, voucher refs when returned by structured payloads | Fake citations or Falcon knowledge passages as ledger proof |
| Trust | Local posted vs sync pending/failed/conflict | Equating Orbix Online with books synced |

Evidence rows must be **read-only presentation** of store/response fields. Mutations remain Confirm / Cancel / mode switch in the conversation column.

## Layout rules

- Desktop wide: inspector open by default; collapsible via workspace control.
- Narrow / overlay: closed by default; toggle must be keyboard-accessible.
- Dense professional accounting tone — no marketing cards, no decorative blur.
- Tokens: `--ox-*` today; migrate container/typography to `--ds-*` with shell consistency.

## Relation to shell sync

Shell `SyncStatusControl` remains the global sync authority. The context panel may **echo** pending/conflict honesty for the last Orbix posting when `sync_status` is present on `posting_completed`, but must not redefine aggregate sync state.

## Falcon / Sutra

Do not bind this panel to Falcon evidence UI (`OrbixPanel` legacy / falcon markdown). Sutra brand chrome stays in AppShell. Panel identity stays **Orbix context / evidence**.
