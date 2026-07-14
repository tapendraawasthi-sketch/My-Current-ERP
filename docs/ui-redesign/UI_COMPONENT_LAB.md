# Component Lab

Entry: `/e2e/ds-lab.html` (dev / `VITE_ALLOW_AUTH_FIXTURE`) — **not** exposed in production.

## Phase UI-1

Renders core `@/design-system` primitives across light/dark, densities, EN/नेपाली.  
Tests: `npm run ui:ds-lab` → `artifacts/ui-redesign/phase-ui-1/`

## Phase UI-2 expansion

Harness section: `data-testid="ds-lab-ui2"` (`src/e2e/designSystemLabUi2.tsx`).

Deterministic sections: Dialog, AlertDialog, Drawer, Popover, DropdownMenu, Alert, Banner, Toast, ErrorSummary, EmptyState, LoadingState, Progress, StepProgress, PageHeader, Tabs, Toolbar, StickyActionBar, SearchField, FilterBar, FilterChips, Pagination, SelectionSummary, DataTable (basic/financial/loading/empty/error/selected/expanded/dark/compact/Nepali/mobile), print fixture.

Tests: `npm run ui:phase2` → `artifacts/ui-redesign/phase-ui-2/` (screenshots + `manifest.json` + `a11y-lab.json`).

Target: **zero** serious/critical axe violations on the expanded lab.
