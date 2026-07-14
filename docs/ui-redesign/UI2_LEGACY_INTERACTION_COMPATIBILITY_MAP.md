# UI-2 Legacy Interaction Compatibility Map

**Phase:** UI-2.13  
**Policy:** Coexist. No broad production migration. No deletions of active components.

| Path | Consumers (approx) | New equivalent | Direct delegate? | Adapter? | Behavior mismatch | Visual mismatch | A11y mismatch | Domain coupling | Migration phase | Deletion condition |
|------|-------------------:|----------------|------------------|----------|-------------------|-----------------|---------------|-----------------|-----------------|--------------------|
| `src/components/ui/Modal.tsx` | ~2 | `Dialog` | No | Optional later | Escape-only; z-9999 | Legacy green | Weak title/trap | Low | UI-3+ pages | Zero consumers + tests |
| `src/components/ui/ConfirmDialog.tsx` | ~8 | `AlertDialog` / `ConfirmDialogFoundation` | No | Later | Dual open API | Green / red heuristics | Partial | Reason field only | UI-3+ | Zero consumers |
| `src/components/ui/DataTable.tsx` | 1 (DayBook) | `EnterpriseDataTable` | No | No | Column API differs | ox tokens | Partial | Display only | DayBook UI-4+ | Zero consumers |
| `src/components/ui/Table.tsx` | ~2 | Presentational + EnterpriseDataTable | No | No | Presentational | Legacy | Minimal | Low | Gradual | When unused |
| `src/components/ui/Pagination.tsx` | ~7 | `Pagination` | No | Later | Prop names drift | Legacy green | Labels incomplete | Low | UI-3+ | Zero consumers |
| `src/components/ui/EmptyState.tsx` | 0 | `EmptyState` | N/A | N/A | — | — | — | None | Can deprecate after proof | Documented + CI |
| `src/components/ui/PageLoader.tsx` | 0 | `LoadingState` | N/A | N/A | Full-page spinner | Legacy | — | None | Can deprecate after proof | Documented + CI |
| `src/components/ui/NotificationPanel.tsx` | 0 | `NotificationItem` foundation | No | UI-3 | Store-coupled | Legacy | — | Store | UI-3 | After notification redesign |
| `ReportEmptyState` | ~50 | `EmptyState` | No | Adapter later | Report copy | Report chrome | Varies | Report UX | UI-4+ reports | — |
| `react-hot-toast` | ~170 | DS `Toast` | No | Keep both | API differs | Different | Live region varies | Transient only | UI-3 notifications | After toast convergence |
| Inline PageHeader (AGENTS pattern) | many pages | `PageHeader` | No | — | Markup copy-paste | Dense 10–11px legacy | Varies | Page copy | Per-page migration | — |
| Page-local search/filters | many | `SearchField` / `FilterBar` | No | — | Ad hoc | Varies | Varies | Filters may embed domain | Per-page | — |
| Tally-style modals | scattered | `Dialog` | No | — | Hand-rolled portals | Pale green | Weak | Sometimes workflow | Later | — |

## UI-2 production work performed

- **Delegated:** none (behavior-identical adapters not required for gate).
- **Unchanged:** all listed legacy components remain operational.
- **Deprecation:** documented only; no runtime warnings forced into accounting paths.

## ContextMenu

Deferred — no production right-click consumers. Row actions use `DropdownMenu` / `MenuButton`.
