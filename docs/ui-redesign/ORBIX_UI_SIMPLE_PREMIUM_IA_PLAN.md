# ORBIX UI — Simple Premium IA Plan (functions preserved)

**Document ID:** `ORBIX_UI_SIMPLE_PREMIUM_IA_PLAN`  
**Date:** 2026-07-18  
**Role:** Detailed redesign plan for **looking simple and premium** without removing any function.  
**Scope:** Presentation, information architecture (IA), progressive disclosure, chrome density.  
**Non-scope:** Posting engines, sync, accounting math, Python/OIP, route deletion, feature removal.  
**Authority stack:** AGENTS.md (safety) → this plan (simplicity IA) → `ORBIX_UI_IMPLEMENT_NOW.md` (tokens/composites).  
**Honesty:** Tokens alone already exist (“Calm Himalayan ledger”). Complexity today is mostly **too much chrome and too much visible at once**, not missing components.

---

## 0. Research verdict (why it feels complex)

Deep pass over shell, nav, Home, TXN forms, design-system overlap, and prior redesign docs shows:

| Rank | Complexity driver | Evidence |
|-----:|-------------------|----------|
| 1 | **Triple identity chrome** | Company · FY · page title in TopCommandBar **and** TransactionWorkspace header **and** form sticky header/badges |
| 2 | **Wide primary nav (~75 leaves)** | `navConfig.ts` — 10 modules, ~75 destinations; shallow but overwhelming |
| 3 | **Hub-of-hubs** | Voucher Entry Hub, Configuration Hub, Banking Hub, Advanced Report Hub, Master Control Centre, InvoiceHub |
| 4 | **Home is a dashboard of dashboards** | Header + role strip + up to 4 banners + 3–7 KPIs + 6 quick actions + attention + trust card |
| 5 | **TXN forms show advanced fields always** | Invoice: 13+ line columns, sundries, TDS, dual narration, attachments all open |
| 6 | **Top bar control cluster** | Company + Branch + Sync + Theme + Help + Notifications + User (+ density inside menu) |
| 7 | **Stacked AI providers** | Orbix (nav) + FalconProvider + NiosProvider + EKhataProvider + mobile SutraAi |
| 8 | **Branch filter duplicated** | Shell `BranchSwitcher` + page-local branch `<select>` on many screens |
| 9 | **Parallel visual languages** | `--ds-*` + `--ox-*` + raw `gray-*` / `#1557b0` leftovers on same pages |
| 10 | **Shouting typography** | `text-[10px] uppercase tracking-wide` section/role labels; UPPERCASE status badges |
| 11 | **Authority split (docs)** | AGENTS.md still documents old 10–11px / `#1557b0` Busy tips; IMPLEMENT_NOW says those apply only to **unmigrated** files — implementers reintroduce shout UI |
| 12 | **ActionToolbar leftovers** | `components/ui` ActionToolbar still on ~20 pages alongside DS PageHeader |
| 13 | **Dead chrome in repo** | Sidebar / Header / TopMenuBar / BusyMenuBar stubs still present (not mounted) — confuses future agents |

**What already works (keep):** AppShell-only production path; BusyShell/BusyMenuBar/RightButtonBar already no-ops; legacy Sidebar/Header/TopMenuBar **not mounted**; `SHELL_NAV` role filtering; Command Palette (Ctrl+K); design-system tokens + ReportWorkspace/TransactionWorkspace blueprints; dual BS+AD dates; productive density; Home adapter navigate-only metrics (no invented balances).

**What prior plans already fixed:** Colour tokens, button kit, report action cluster (`ORBIX_UI_IMPLEMENT_NOW` / superseded Premium Simplicity).  
**What this plan adds:** Progressive disclosure + chrome reduction + role-based “quiet defaults” so the **same functions** feel calm.

---

## 1. Product north star (one sentence)

**A calm ledger desk:** open the app → see what needs attention and one clear next action → open a document with only the fields needed for *this* posting → advanced controls one click away — never gone.

### 1.1 Premium means (for Orbix)

- One visual language (`--ds-*` only on touched files)
- One primary CTA per region (header / filter / footer)
- Dense tables, quiet chrome (Busy / Tally Cloud adult software)
- Plain Nepal-business English; Lucide only; no emoji chrome
- Space and hierarchy — not empty consumer SaaS cards

### 1.2 Simple means (for Orbix)

- **Fewer things competing for the eye** on first paint
- **Defaults hide rarity**; power users expand
- **One place** for company/branch/FY identity
- **Search/palette** for the long tail; nav for daily work
- No function removed — only relocated, collapsed, or demoted visually

### 1.3 Hard non-negotiables

| # | Rule |
|---|------|
| N1 | Do not delete routes, pages, or posting capabilities |
| N2 | Do not change voucher/invoice engines or sync behaviour |
| N3 | Every demoted control remains reachable in ≤2 clicks or Ctrl+K |
| N4 | Role-based defaults only; admins can always “Show all” |
| N5 | Migrated looks stay token-only (`var(--ds-*)`) |

---

## 2. Design principles for this program

| ID | Principle | Implementer meaning |
|----|-----------|---------------------|
| S1 | **One identity strip** | Company / Branch / FY live only in TopCommandBar (or a single Context chip). Pages stop repeating them. |
| S2 | **Daily 12 / Rest via search** | Primary nav shows ~8–12 favourites + module roots; full leaf list stays in palette + “All menus”. |
| S3 | **Progressive TXN** | Essential → Optional → Rare. Collapse Rare by default. |
| S4 | **One document header** | Kill dual PageHeader + form sticky title; keep one. |
| S5 | **Home = Today, not encyclopedia** | Attention + 3–4 KPIs + 4 actions. Everything else below fold or in “More”. |
| S6 | **One AI door** | Ask Orbix is the only always-visible assistant entry. Other providers stay internal/remap only. |
| S7 | **Branch once** | Shell branch is source of truth; page filters only when “All branches” analysis is needed (reports). |
| S8 | **Quiet labels** | Sentence case StatusChip; section titles 13px/600; no 10px UPPERCASE shout. |
| S9 | **Hubs become indexes, not second apps** | Hubs are short link grids with the same PageHeader — not alternate shells. |
| S10 | **Premium density** | Default density `productive`; comfortable optional in user menu only. |

---

## 3. Target experience blueprints

### 3.1 Shell (desktop)

```text
┌ TopCommandBar (single identity) ─────────────────────────────────────────┐
│ [Brand]  [Search / Ctrl+K ──────────────]  [Context▾] [Sync] [Bell] [User] │
│ Context▾ = Company · Branch · FY (one control, three facts)                 │
└──────────────────────────────────────────────────────────────────────────┘
┌ SideNav (narrow) ┐  ┌ Main ──────────────────────────────────────────────┐
│ Pinned (≤6)      │  │ PageHeader: Title · one help line · actions         │
│ ─────────        │  │ (no company/FY repeat)                              │
│ Modules (10)     │  │ Content                                             │
│  · expand in     │  │                                                     │
│    place OR      │  │                                                     │
│    flyout        │  │                                                     │
│ ─────────        │  │                                                     │
│ All menus…       │  │                                                     │
└──────────────────┘  └─────────────────────────────────────────────────────┘
```

**Changes (look/IA only):**

1. Merge CompanySwitcher + BranchSwitcher + FY crumb into **ContextSwitcher** (one dropdown with three sections). Theme / density / language stay in User menu.
2. Remove Help→Configuration Hub shortcut from top bar (Help lives in User menu + palette).
3. Side nav default: **Pinned + module roots**; expand module to show leaves (accordion). Leaves not pinned remain via Ctrl+K.
4. Hide duplicate page-level branch `<select>` when shell context already scopes data (lists/TXN). Keep branch filter on **analytical reports** that need All vs one branch.

**Functions preserved:** Company switch, branch switch, FY display, sync, notifications, theme, density, language, logout, config hub (via Admin / palette).

### 3.2 Home (“Today”)

```text
┌ Today ──────────────────────────────────────────────┐
│ Attention (max 5) — overdue, unbalanced, sync       │
│ KPI row (max 4) — role-aware                         │
│ Do next (max 4) — primary workflows                  │
│ ─── More (collapsed) ───                             │
│ Recent activity · Ageing chart · Data trust          │
└──────────────────────────────────────────────────────┘
```

**Changes:**

1. Drop role strip uppercase shout; fold workspace into PageHeader status chip.
2. Cap first-viewport banners to **one** highest severity (others in Attention).
3. Move Ask Orbix from duplicate header primary **or** keep header CTA but remove from quick-actions duplicate.
4. Collapse Recent / Charts / Data trust under “More on this company”.

**Functions preserved:** All metrics, attention items, quick actions registry, Orbix entry, branch scope, refresh, trust panel.

### 3.3 Transaction documents (invoice / journal / payment / receipt)

```text
┌ Document header (single) — Title · StatusChip · DualDate · BalanceStrip? ─┐
├ Essential: Party · Doc no · Date · Lines/grid                              ┤
├ Totals (always visible)                                                    ┤
├ Optional ▸ Tax / TDS · Bill allocation · Warehouse · Sundries              ┤
├ Rare ▸ Attachments · Nepali narration · Advanced refs                      ┤
└ Footer sticky: Cancel · Print · Draft · Post                               ┘
```

**Column simplification (invoice lines) without removing fields:**

| Always visible | Optional (toggle “More columns”) | Rare (row expand / drawer) |
|----------------|----------------------------------|----------------------------|
| # Item Qty Unit Rate Amount | Disc% Taxable VAT% VAT Amt | HSN Description Warehouse Tax? |

**Functions preserved:** Every field still editable; toggles persist per user (`localStorage`).

### 3.4 Reports

Keep ReportWorkspace. Simplify filter bar: **Date range + Show report** primary; other filters in **Options** drawer (already in IMPLEMENT_NOW spirit). Branch filter stays here (All branches meaningful).

### 3.5 Masters / Admin

Configuration Hub becomes a **searchable index** of existing pages (cards), not a third settings product. No page deletion.

---

## 4. Parallel visual language cleanup (looks only)

| Layer | Action |
|-------|--------|
| `--ds-*` | Sole authority on migrated surfaces |
| `--ox-*` in Party/Item legacy wrappers | Retoken to `--ds-*` (already partially done via Combobox) |
| Page-local `#1557b0` / `gray-300` selects | Replace with DS Input/Select classes |
| `text-[10px] uppercase tracking-wide` | → 12px / 600 / muted sentence or column-header-only uppercase |
| Nested Card > Card | Prefer Section + border once |

---

## 5. AI surface policy (visibility, not capability)

| Surface | Visibility after plan |
|---------|----------------------|
| Ask Orbix (nav + Ctrl+K) | Primary, always |
| FalconProvider | Keep shortcut remap; **no floating chrome** if it adds a second FAB |
| Nios / EKhata / SutraAi | Keep providers for capability; **no competing launchers** on desktop Home/TXN |
| Gamification / trophies | Hidden from default Home (already discouraged in Premium Simplicity P5) |

No AI feature removed — only one front door.

---

## 6. Phased delivery (safe order)

### Phase A — Chrome calm (1–2 days of focused work)

**Goal:** Instant “simpler” feeling without touching forms.

1. ContextSwitcher (company + branch + FY)
2. Remove Help icon from top bar; keep in User menu
3. Deduplicate page branch filters on TXN/list pages that inherit shell branch
4. Kill dual document headers on Journal / Payment / Receipt / SalesInvoice (one header)
5. Quiet StatusChip / section titles (S8)

**Status (2026-07-18):** Implemented in app — `ContextSwitcher`, TopCommandBar Help→User menu, compact TXN toolbars (invoice/journal/payment/receipt), TransactionWorkspace hid company/FY meta, list pages dropped duplicate h1, `.form-section-title` quieted, BillingInvoice tab no longer navigates to missing routes. List “All branches” filters kept where analysis needs them.

**Exit gate:** Screenshot Home + Sales invoice + Journal — fewer competing titles; same save/post paths.

### Phase B — Home Today (1 day)

1. Restructure Home sections per §3.2
2. Cap KPIs/actions/banners
3. Persist “More” expand state

**Status (2026-07-18):** Implemented — Home titled “Today”; first viewport = Attention (≤5) + Money picture (≤4 KPIs) + Do next (≤4 actions, Ask Orbix only in header); one priority banner; Recent / ageing / Orbix prompts / Data trust under collapsible “More on this company” (`orbix_home_more_open`); role strip removed.

**Exit gate:** First viewport answers: What needs me? What’s the money picture? What’s next?

### Phase C — TXN progressive disclosure (2–3 days)

1. Invoice line column tiers + “More columns”
2. Collapse TDS / Sundries / Attachments / NE narration by default (auto-open if data present)
3. Journal: show cost centre / bill-wise columns only when company features enabled **and** user expanded Optional
4. Payment/Receipt: bill allocation collapsed until party selected with outstanding bills

**Status (2026-07-18):** Implemented — Invoice Essential (# Item Qty Unit Rate Total) with **More columns** / **Line details**; sundries + TDS under optional (auto-open for TDS party / existing data); Nepali narration + attachments under **More fields**; Journal/Payment/Receipt Cost Center & Bill Ref behind **Optional columns** when company flags on; P/R bill allocation collapsible (auto-opens when outstanding exist). Persist keys: `orbix_txn_invoice_*`, `orbix_txn_journal_optional`, `orbix_txn_payment_optional`, `orbix_txn_receipt_optional`. Hook: `usePersistedToggle`.

**Exit gate:** New invoice first paint ≤ essential fields; all advanced fields still reachable; post still works.

### Phase D — Nav daily-12 (1–2 days)

1. Pinned favourites as default primary list (existing `favouriteEligible`)
2. Module accordion; “All menus…” opens palette filtered to that module
3. Relabel hub pages as indexes (copy only) where helpful

**Status (2026-07-18):** Implemented — Favourites seeded once from `favouriteEligible` (cap 12); modules accordion with persisted expand (`orbix_nav_expanded_v1`); Recent demoted (collapsed by default, max 3); footer **All menus…** + per-module **All in {Module}…** open CommandPalette (`moduleId` filter); hub copy → “index” (nav + Configuration / Advanced reports / Inventory analysis / Multi-currency).

**Exit gate:** New cashier/accountant role sees ≤12 primary destinations without scrolling a wall of leaves.

### Phase E — Visual unification polish (ongoing)

1. Retoken remaining ox/gray leftovers on high-traffic pages
2. Hub card grids use HubCardGrid composite
3. Replace ActionToolbar usages with PageHeader action clusters on pages you touch
4. Align with IMPLEMENT_NOW DoD; update `UI_MIGRATION_TRACKER.md`
5. **Docs-only when approved:** point AGENTS.md visual tips at IMPLEMENT_NOW for migrated surfaces (stop reintroducing 10px / `#1557b0`)
6. **Later / optional:** quarantine or delete dead Sidebar/Header/TopMenuBar (not required for looks; reduces agent confusion)

**Status (2026-07-18) — first polish slice:** Configuration index → `HubCardGrid`/`HubCard` + `PageHeader`; Bank reconciliation + Bank accounts → `PageHeader` (ActionToolbar removed); `ActionToolbar` itself retokened `--ox-*` → `--ds-*` for remaining consumers; Journal/Billing list consts, Parties/ItemMaster selects, StockBook KPI labels, Master Control KPI shout, ReportHub accents/header retokened. AGENTS.md tip rewrite deferred (needs approval). Dead chrome quarantine deferred.

---

## 7. Function preservation matrix (examples)

| Function today | After plan | How reached |
|----------------|------------|-------------|
| Switch company | ContextSwitcher | Top bar |
| Switch branch | ContextSwitcher | Top bar (+ report filter when All needed) |
| Density comfortable/compact | User menu | Unchanged |
| Dark theme | User menu | Unchanged |
| Configuration Hub | Admin nav + palette + User→Settings | Unchanged routes |
| TDS on invoice | Optional ▸ Tax | Auto-open if `tdsEnabled` / existing data |
| Nepali narration | Rare ▸ | Always available |
| Warehouse on line | More columns / row detail | Feature-flag still respected |
| Voucher Entry Hub | Accounting module leaf | Same page |
| Falcon shortcuts | Provider stays | No second FAB |
| Ask Orbix | Nav + Ctrl+K + optional Home CTA | One visual language |
| All 75+ nav leaves | Palette + module expand + All menus | None deleted |
| Financial Dashboard page | Reports module | Still wired |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Power users feel “features missing” | “Show advanced” / “More columns” defaults remembered; keyboard shortcuts unchanged |
| Branch confusion if page filter removed | Shell BranchSwitcher is authoritative; toast when switching mid-form if dirty |
| Hiding TDS causes compliance mistakes | Auto-expand when party.subjectToTds or feature on |
| Accordion nav slows accountants | Favourites + Ctrl+K remain faster paths |
| Dual-header removal breaks deep links | Keep route shells; only collapse visual duplicate title/meta |

---

## 9. Success metrics (qualitative + light quantitative)

| Metric | Target |
|--------|--------|
| First-viewport competing titles (TXN) | 1 (was 2–3) |
| Top-bar distinct controls | ≤6 visible (Context counts as 1) |
| Home first-viewport modules | ≤4 blocks before scroll |
| Invoice essential fields before scroll | Party + lines + totals + footer |
| Functions removed | **0** |
| Ctrl+K reachability of demoted items | 100% |
| `ui:governance` new debt | 0 |

---

## 10. Explicitly out of scope (do later / never in this plan)

- Rewriting Tally UI skin or POS layout overhaul
- Full Nepali UI translation
- Deleting orphan/DEPRECATE pages
- Engine / posting / CBMS logic changes
- Replacing LineItemGrid composite in a way that drops VAT/warehouse columns without Optional tier (see prior UI finalization note)

---

## 11. Recommended next step after approval

Execute **Phase A only** on a branch, with before/after screenshots of: Home, Sales invoice, Journal list+form, Trial Balance. Then Phase B–C. Do not start Phase D nav accordion until A/B feel calmer — nav changes are the highest “where did my menu go?” risk.

---

## 12. Research sources

- `src/components/shell/AppShell.tsx`, `TopCommandBar.tsx`, `navConfig.ts`, `PrimarySideNav.tsx`
- `src/features/home/HomePage.tsx`, `roleWorkspace.ts`, `quickActions.ts`
- `src/features/transactions/TransactionRouteShell.tsx`, `TransactionWorkspace.tsx`
- `src/components/invoice/SalesInvoiceForm.tsx`, `voucher/*VoucherForm.tsx`
- `docs/ui-redesign/ORBIX_UI_IMPLEMENT_NOW.md`, `UI_MIGRATION_TRACKER.md`, `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md` (historical)
- UI complexity research pass (2026-07-18) — shell chrome layers, ~75 nav leaves, Home viewport stack, TXN dual headers, 5 parallel visual languages, ActionToolbar / dead-chrome notes
