# Enterprise Data Table Architecture

**Phase:** UI-2.9–2.10  
**Component:** `EnterpriseDataTable` (`@/design-system`)

## Dependency decision

| Option | Decision |
|--------|----------|
| `@tanstack/react-table` | **Not installed** — do not add for UI-2 |
| AG Grid Enterprise | **Rejected** — licensed |
| Hand-rolled semantic `<table>` | **Chosen** — separates model/render/state; sufficient for register/list tables |

## Separation of concerns

1. Data model — row objects + `getRowId` (never default to array index)
2. Rendering — semantic `table` / `thead` / `tbody` / `th` / `td`
3. State — sort, selection, expansion, column visibility (controlled)
4. Server integration — consumers own fetch/pagination
5. Presentation — density tokens, financial cells
6. Accessibility — headers, sort announcements, selection names, row actions
7. Domain formatting — cell helpers only; no posting/VAT logic

## Capabilities delivered

- Sorting (asc/desc/none), selection (page scope + indeterminate header), expansion, row action menu
- Sticky header via `--ds-z-sticky`
- Column visibility (required columns cannot hide)
- Controlled widths + optional resize architecture (min/max props; keyboard-safe default = no resize required)
- Densities: comfortable / productive / compact
- Loading skeleton rows; empty + error + retry
- Financial helpers: `formatAmountCell`, `DebitCreditCell` — tabular nums, right align, zero ≠ missing (`—`), negatives as `(amount)` with debit class (not colour-only)
- Export action slot via toolbar/MenuButton (table does not invent accounting exports)
- Print: semantic table; interactive chrome print-hidden

## Virtualization

`DATA_TABLE_VIRTUALIZATION_THRESHOLD = 500`

**Not enabled by default.** Enable only when row height is fixed, a11y is validated, and print/export do not require DOM of all rows. Dynamic-height / small datasets stay non-virtualized.

## Responsive

Desktop full table; `priority` on columns for tablet/mobile prioritisation; mobile list/detail is an integration point (Drawer/DetailsPanel) — do not crush 12 columns unreadably.

## Permission

Hidden row actions reflect UI permissions only; backend enforcement remains authoritative.
