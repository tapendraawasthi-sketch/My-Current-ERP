# UI Migration Tracker

Phase UI-0 creates this tracker. **Nothing is marked migrated** unless genuinely migrated and tested.

## Priority order (from redesign blueprint)

### Priority 1 — Foundations & primitives

| ID | Screen/Component | Module | Current | Target | Priority | Risk | Status |
|----|------------------|--------|---------|--------|----------|------|--------|
| MIG-001 | Design tokens | foundation | design-tokens + styles.css conflict | `--ds-*` + coexistence | P1 | medium | **UI-1 done** (coexist) |
| MIG-002 | Typography scale | foundation | 9–11px dominant | ≥12px essential in DS | P1 | medium | **UI-1 done** (DS); legacy pages pending |
| MIG-003 | Button | ui | ui/Button + FlatBtn + ad hoc | `@/design-system` Button | P1 | low | **UI-1 done** (lab only) |
| MIG-004 | IconButton | ui | ad hoc icon buttons | IconButton w/ a11y name | P1 | low | **UI-1 done** (lab only) |
| MIG-005 | Input | ui | ui/Input + BusyInput | `@/design-system` Input | P1 | medium | **UI-1 done** (lab only) |
| MIG-006 | Select | ui | ui/Select + natives | `@/design-system` Select | P1 | medium | **UI-1 done** (lab only) |
| MIG-007 | Dialog/Modal | ui | Modal + ConfirmDialog | Dialog + AlertDialog | P1 | medium | **UI-2 foundation done** (lab); prod coexist |
| MIG-008 | Drawer | ui | vaul/ad hoc | Drawer primitive | P1 | low | **UI-2 done** (lab) |
| MIG-009 | Popover | ui | radix ad hoc | Popover primitive | P1 | low | **UI-2 done** (lab) |
| MIG-010 | StatusChip | ui | Badge + status-pill CSS | StatusChip + SyncStatusChip | P1 | low | **UI-1/UI-2 done** (lab) |
| MIG-011 | DataTable | ui | Table + DataTable + raw tables | EnterpriseDataTable | P1 | high | **UI-2 foundation done** (lab); DayBook not migrated |
| MIG-012 | Page header | ui | repeated markup | PageHeader | P1 | low | **UI-2 done** (lab) |
| MIG-013 | Loading/Empty/Error | ui | Spinner/EmptyState/ad hoc | unified states | P1 | low | **UI-2 done** (lab) |
| MIG-014 | Feedback (Toast/Banner/Alert) | ui | hot-toast + ad hoc | DS feedback layer | P1 | medium | **Wave 6 done** — `@/lib/appToast` + ToastProvider; hot-toast removed |
| MIG-015 | Search/Filter/Saved views | ui | page-local | SearchField/FilterBar/SavedView | P1 | medium | **UI-2 foundation done** (lab) |
| MIG-016 | Pagination/Selection | ui | Pagination + ad hoc | Pagination + SelectionSummary | P1 | low | **UI-2 done** (lab) |

### Priority 2 — Shell & navigation

| ID | Item | Status |
|----|------|--------|
| MIG-020 | AppShell evolution | **UI-3 done** |
| MIG-021 | Primary navigation IA | **UI-3 done** (role-aware) |
| MIG-022 | Top command bar | **UI-3 done** |
| MIG-023 | Command palette | **UI-3 done** |
| MIG-024 | Sync state presentation | **UI-3 done** (adapter) |
| MIG-025 | Notifications | **UI-3 done** (centre wired) |

### Priority 3 — Entry experiences

| ID | Item | Status |
|----|------|--------|
| MIG-030 | Authentication (pre-workspace) | **UI-4 done** — Gateway, Login, Onboarding, Session restore, Init error on `PreWorkspaceShell` + DS; store authority unchanged |
| MIG-031 | Company selector (gateway) | **UI-4 done** — `GatewayScreen` migrated; multi-company Dexie selection still future |
| MIG-032 | Dashboard | **UI-5 done** — `FinancialDashboard` → `HomePage`; role workspaces + adapter; docs + unit/e2e |
| MIG-033 | Orbix | **UI-6 done** — production OrbixWorkspace Himalayan Precision + trust chrome; authority unchanged |

## Phase UI-4 — Pre-workspace migration (2026-07-13)

**Complete:** Pre-workspace auth surfaces migrated to design-system + `PreWorkspaceShell`. Feature pages inside authenticated `Layout` / `AppShell` are **not** migrated.

| Deliverable | Status |
|-------------|--------|
| `PreWorkspaceShell` | done |
| `GatewayScreen` | done |
| `CompanyLoginScreen` | done |
| `SignUpWizard` + Steps 1–4 | done |
| `AuthAccessSurfaces` (trust + access presentation) | done |
| `InitErrorScreen` → PreWorkspaceShell | done |
| `@ts-nocheck` removed from auth components | done |
| Auth fixture `/e2e/ui-auth.html` | done (DEV / `VITE_ALLOW_AUTH_FIXTURE` gated) |
| UI-4 documentation set | done |
| `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` | **absent** |

**Docs:** `UI4_PRE_WORKSPACE_ARCHITECTURE.md`, `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md`, `UI4_ONBOARDING_ARCHITECTURE.md`, `UI4_TRUST_STATE_PRESENTATION_SPEC.md`, `UI4_AUTH_ACCESSIBILITY_AND_KEYBOARD_SPEC.md`, `UI4_LEGACY_AUTH_CUTOVER_MAP.md`.

## Phase UI-5 — Home / dashboard (2026-07-13)

**Complete:** Canonical Home is `HomePage` behind `FinancialDashboard`. Role workspaces, dashboard adapter, attention queue, ageing chart (CSS + table), data-trust presentation. Accounting/sync authorities unchanged.

**Docs:** `UI5_TARGET_HOME_ARCHITECTURE.md`, `UI5_ROLE_WORKSPACE_SPEC.md`, `UI5_DASHBOARD_DATA_AND_FRESHNESS_SPEC.md`, `UI5_ATTENTION_QUEUE_SPEC.md`, `UI5_DASHBOARD_CHART_AND_COMPARISON_SPEC.md`, `UI5_DATA_TRUST_PRESENTATION_SPEC.md`, `UI5_HOME_ACCESSIBILITY_AND_KEYBOARD_SPEC.md`, `UI5_LEGACY_DASHBOARD_CUTOVER_MAP.md`.

## Phase UI-6 — Orbix workspace (2026-07-13)

**Complete:** Production Orbix path `App → OrbixWorkspacePage → OrbixWorkspace` restyled on `--ds-*` tokens with structured presentation (`TrustChrome`, sync labels, operation-specific confirm, stale-preview gate, evidence identifiers). `confirmPending` forwards authoritative `sync_status`. Falcon/Sutra launchers suppressed on Orbix page. Accounting / Python / posting / sync authorities unchanged.

**Docs:** `UI6_ORBIX_WORKSPACE_AND_AUTHORITY_AUDIT.md`, `UI6_STRUCTURED_RESPONSE_AUTHORITY_MAP.json`, `UI6_TARGET_ORBIX_WORKSPACE_ARCHITECTURE.md`, `UI6_CONVERSATION_PRESENTATION_SPEC.md`, `UI6_EVIDENCE_AND_CONTEXT_PANEL_SPEC.md`, `UI6_AUTHORITATIVE_PREVIEW_SPEC.md`, `UI6_STALE_PREVIEW_AND_CONFLICT_UX_SPEC.md`, `UI6_ORBIX_ACCESSIBILITY_AND_KEYBOARD_SPEC.md`, `UI6_LEGACY_ORBIX_CUTOVER_MAP.md`, `ORBIX_UI_PHASE6_INTELLIGENCE_WORKSPACE_REPORT.md`.

**Still pending:** Masters, registers, ledgers, reports (UI Phase 8+).

### Priority 4 — Core accounting UX

| ID | Item | Status |
|----|------|--------|
| MIG-033 | Orbix | **UI-6 done** |
| MIG-040 | Sales | **UI-7 done** — TransactionRouteShell + BillingInvoice; postSalesTransaction |
| MIG-041 | Receipt/Payment | **UI-7 done** — shell + postReceipt/PaymentTransaction |
| MIG-042 | Parties | **IMPLEMENT_NOW Wave 4** — Customers & suppliers titles + DS tokens |
| MIG-043 | Day Book | **IMPLEMENT_NOW Wave 2** — ReportWorkspace |
| MIG-044 | General Ledger | **IMPLEMENT_NOW Wave 2** — Account activity title |

### Priority 5 — Banking & statements

| ID | Item | Status |
|----|------|--------|
| MIG-050 | Bank reconciliation | **IMPLEMENT_NOW Wave 4** — Match bank statement |
| MIG-051 | Statement import | **IMPLEMENT_NOW Wave 4** — Import bank statement |
| MIG-052 | Financial statements | **IMPLEMENT_NOW Waves 2+5** — core + secondary STMT chrome |

## IMPLEMENT_NOW looks waves (2026-07-14)

| Wave | Status |
|------|--------|
| 0 Foundation | done |
| 1 Shell / auth / home / AI | done |
| 2 Core books | done |
| 3 Invoices / tax / registers | done — line-table is the DS-token grid for invoice lines (full LineItemGrid composite swap deferred: would drop Warehouse/VAT columns, a functional change) |
| 4 Masters + banking | done |
| 5 Inventory / payroll / secondary STMT-REG | done |
| 6 CFG + orphans + hot-toast cutover | done — see `UI_ORPHAN_PAGE_REGISTRY.json` |

**Looks debts closed (2026-07-18):**

- Combobox on TXN/MASTER — `PartySelect`, `ItemSelect`, `AccountSelect` now wrap the design-system `Combobox` (all consumers inherit it); `Combobox` gained an optional `onClear` affordance for parity with the old ItemSelect clear button.
- select-name a11y — `aria-label` added to unnamed selects in `SalesInvoiceForm` (bill sundry type, bank account), `JournalEntries` (rows per page), `BankReconciliation` (voucher type, counter account).
- LineItemGrid — invoice/journal line grids stay on the DS-tokenized `.line-table` styles; swapping to the frozen `LineItemGrid` composite would remove Warehouse/VAT/per-line-tax columns (functional change, out of looks-only scope), so the composite remains available for simpler money docs.

## Phase E — Simple Premium visual polish (2026-07-18)

Aligned with `ORBIX_UI_SIMPLE_PREMIUM_IA_PLAN.md` Phases A–E (chrome calm → Home Today → TXN disclosure → nav daily-12 → visual unify).

| Slice | Status |
|-------|--------|
| Configuration index HubCardGrid + PageHeader | done |
| Bank reconciliation / Bank accounts → PageHeader | done |
| ActionToolbar bridge retoken (`--ds-*`) | done |
| High-traffic retoken (Journal, Billing, Parties, ItemMaster, StockBook KPI, Master Control, ReportHub) | done |
| Remaining ActionToolbar consumers → PageHeader | pending (as pages are touched) |
| AGENTS.md tip rewrite → IMPLEMENT_NOW | deferred (needs approval) |
| Dead Sidebar/Header/TopMenuBar quarantine | deferred |

## Field template

Each JSON entry includes: ID, screen/component, module, current system, target pattern, priority, risk, dependencies, functional/visual/a11y/responsive tests, status, owner, migrated files, deprecated files, blockers.

See `UI_MIGRATION_TRACKER.json`.
