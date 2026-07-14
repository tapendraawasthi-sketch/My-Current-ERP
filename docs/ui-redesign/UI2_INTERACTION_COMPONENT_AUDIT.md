# UI-2 Interaction Component Audit

**Phase:** UI-2.1  
**Generated:** 2026-07-13

## Before-state

| Check | Result |
|-------|--------|
| `ui:governance` | PASS |
| Full-project `tsc` | 151 diagnostics |
| Design-system diagnostics | 0 |
| Deep research report | Still **absent** |

## Dependencies available

| Package | Installed | Production usage |
|---------|-----------|------------------|
| `@radix-ui/react-dialog` | yes | unused (legacy Modal is hand-rolled) |
| `@radix-ui/react-alert-dialog` | yes | unused |
| `@radix-ui/react-popover` | yes | unused |
| `@radix-ui/react-dropdown-menu` | yes | unused |
| `@radix-ui/react-context-menu` | yes | **0** production — ContextMenu deferred |
| `@radix-ui/react-tabs` | yes | unused as DS |
| `vaul` | yes | unused |
| `react-hot-toast` | yes | ~170 files |
| `sonner` | yes | 0 imports |
| `@tanstack/react-table` | **no** | Build semantic DataTable without adding AG Grid / TanStack Table |

## Legacy inventory

| Path | Consumers | Notes | UI-2 equivalent | Migration |
|------|----------:|-------|-----------------|-----------|
| `ui/Modal.tsx` | ~2 | Legacy green, z-index 9999, Escape only | Dialog | Coexist |
| `ui/ConfirmDialog.tsx` | ~8 | Dual open API, reason field | AlertDialog | Coexist |
| `ui/DataTable.tsx` | 1 (DayBook) | Not in barrel; ox tokens | EnterpriseDataTable | Coexist |
| `ui/Table.tsx` | ~2 | Presentational | EnterpriseDataTable / Table | Coexist |
| `ui/Pagination.tsx` | ~7 | Legacy green; prop drift | Pagination | Coexist |
| `ui/EmptyState.tsx` | 0 | Dead vs ReportEmptyState | EmptyState | Coexist |
| `ui/PageLoader.tsx` | 0 | Skeleton | LoadingState | Coexist |
| `ui/NotificationPanel.tsx` | 0 | Store-coupled | NotificationItem foundation | Coexist |
| `ReportEmptyState` | ~50 | Report-specific | EmptyState adapter later | UI-3+ |
| react-hot-toast | ~170 | Transient only | Toast (DS) + keep hot-toast | Coexist |
| PageHeader | none | Inline AGENTS pattern | PageHeader | New |
| SearchField / FilterBar | none | Page-local | SearchField / FilterBar | New |
| Drawer / Popover / Menu | none | Deps only | New DS | New |

## ContextMenu decision

**Do not implement** in UI-2 — no production right-click workflows found. Keyboard alternatives via DropdownMenu/MenuButton cover row actions.
