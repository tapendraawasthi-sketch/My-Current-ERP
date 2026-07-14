# Primitive Compatibility Map

| Old path | New path | Strategy | Phase |
|----------|----------|----------|-------|
| `src/components/ui/Button.tsx` | `@/design-system` Button | Coexist — no auto-delegate yet (prop/variant differences) | UI-3+ |
| `src/components/ui/Input.tsx` | Input | Coexist | UI-3+ |
| `src/components/ui/Select.tsx` | Select foundation | Coexist | UI-3+ |
| `src/components/ui/Badge.tsx` | Badge / StatusChip | Coexist | UI-3+ |
| `src/components/ui/Spinner.tsx` | Spinner | Coexist | UI-3+ |
| `src/components/ui/Tooltip.tsx` | Tooltip | Coexist | UI-3+ |
| `src/components/ui/EmptyState.tsx` | `@/design-system` EmptyState | Coexist (0 consumers) | UI-2 foundation |
| `src/components/ui/Modal.tsx` | Dialog | Coexist | UI-2 foundation / UI-3 migrate |
| `src/components/ui/ConfirmDialog.tsx` | AlertDialog / ConfirmDialogFoundation | Coexist | UI-2 foundation / UI-3 migrate |
| `src/components/ui/DataTable.tsx` | EnterpriseDataTable | Coexist (DayBook only) | UI-2 foundation |
| `src/components/ui/Pagination.tsx` | Pagination | Coexist | UI-2 foundation |
| `src/components/ui/PageLoader.tsx` | LoadingState | Coexist (0 consumers) | UI-2 foundation |
| Inline page headers | PageHeader | Coexist | Per-page later |
| `react-hot-toast` | Toast | Coexist | UI-3 notifications |
| BusyShell FlatBtn/BusyInput | design-system | deprecate later | UI-3+ |

See also: `UI2_LEGACY_INTERACTION_COMPATIBILITY_MAP.md`.

**UI-1/UI-2 policy:** New primitives ship with **no broad production consumers** except lab/auth fixtures. Legacy components unchanged. Zero deletions of active components.
