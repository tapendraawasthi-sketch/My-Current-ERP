# ORBIX ERP — Premium Simplicity Looks Plan v2 (Ultra)

> **SUPERSEDED (2026-07-14).** For all new looks work use  
> **[`ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md`](./ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md)** (v3 COMPLETE).  
> This v2 file remains as historical detail for statement micro-specs that v3 still incorporates by reference.

**Version:** 2.0 (supersedes v1 in this same file; superseded by v3 FINAL)  
**Audited against:** Balance Sheet, Trial Balance, P&L, Journal, General Ledger, Day Book, Cash/Bank Book, Party Statement, OR/OP/Aging, VAT, transaction toolbars, dual `ReportShell`s  
**Purpose:** Exact visual redesign brief for Cursor Auto mode — including statement micro-layouts and every small control.  
**Scope:** Looks / presentation only. Do **not** change posting, sync, accounting engines (`balanceSheetEngine`, `profitLossEngine`, etc.), or data models.  
**Audience:** Nepal business users who may not know accounting — calm, premium, clear.  
**Authority:** Extends UI-0…UI-7. Migrated UI uses `@/design-system` + `--ds-*` only. No new raw hex. No emoji in chrome.  
**Do not cite:** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` (absent).

---

## 0. Product look (one line)

**Calm Himalayan ledger:** soft stone canvas, one deep trust blue, quiet teal for Orbix only, dense statement tables, plain Nepal-business English, almost no decorative icons.

---

## 1. Non-negotiable principles

| # | Rule | Implementer meaning |
|---|------|---------------------|
| P1 | Simple first | What is this? What next? Is money safe? |
| P2 | Premium ≠ flashy | No gradients, blur glow, neon, purple, emoji, gamification |
| P3 | Statement seriousness | Dense tables; quiet chrome; Busy/Tally Cloud adult software |
| P4 | One icon language | Lucide outline; icon-only **requires** `aria-label` |
| P5 | No dummy chrome | No spinning AI, model names, RAG paths, trophies, 📄🖨️ emoji buttons |
| P6 | Nepal-native | `Rs.`, BS+AD, PAN/VAT, FY Shrawan–Ashadh, wallets where already present |
| P7 | Plain labels | Everyday words first; accounting term as muted helper |
| P8 | Token-only colour | `var(--ds-*)` / DS components only on migrated files |
| P9 | Essential text ≥12px | No `text-[9px]`/`text-[10px]` for readable UI |
| P10 | One primary CTA per region | Header vs filter vs footer — never two primaries competing |
| P11 | Shared report chrome | All statements use one `ReportWorkspace` — no page-local hex toolbars |
| P12 | Export never emoji | Excel / CSV / Print via Lucide + text only |

---

## 2. Colour tokens (retune)

**Edit:** `src/design-system/foundations/tokens.css`  
**Sync:** `docs/ui-redesign/UI_COLOUR_TOKEN_SPEC.md`

| Token | Value | Use |
|-------|-------|-----|
| `--ds-action-primary` | `#0F5C8C` | Primary buttons, active nav bar, focus |
| `--ds-action-primary-hover` | `#0C4A72` | Hover |
| `--ds-canvas` | `#F3F5F7` | Page bg (replace `#f5f6fa` on migrated) |
| `--ds-surface` | `#FFFFFF` | Statement card |
| `--ds-surface-muted` | `#EEF1F4` | Table header, section band, subtotal |
| `--ds-text-strong` | `#14212B` | Titles |
| `--ds-text-default` | `#2A3845` | Body / particulars |
| `--ds-text-muted` | `#5C6B79` | Helpers, column labels |
| `--ds-border-default` | `#D5DCE3` | Default borders |
| `--ds-intelligence` | `#0A7A7A` | Orbix only |
| `--ds-status-success` / surface | `#0F6B56` / `#E7F6F1` | Balanced, posted |
| `--ds-status-warning` / surface | `#8A5A12` / `#FFF4DD` | Needs attention |
| `--ds-status-danger` / surface | `#B4232F` / `#FDECEF` | Unbalanced, overdue |
| `--ds-financial-debit` | `#B4232F` | With “Dr” text |
| `--ds-financial-credit` | `#0F6B56` | With “Cr” text |
| `--ds-brand-50` | keep / align | Grand-total row tint (replaces `#eef2ff`) |

**Kill on migrated reports:** `#1557b0`, `#0f4a96`, `#eef2ff`, `#1e2433` section fills, rainbow type pills, filled blue comparative headers.

---

## 3. Typography & money

| Element | Spec |
|---------|------|
| Page title | 16px / 600 / `--ds-text-strong` |
| Page help | 13px / 400 / `--ds-text-muted` — one plain sentence + “(Accounting: …)” |
| Meta line | 12–13px muted — `Company · FY 2081/82 · BS … · AD …` |
| Column header | 12px / 600 / muted; uppercase **only** for column titles |
| Particulars / body | 13px / 400 |
| Section / group | 13px / 600 |
| Amount | Tabular nums, right, `Rs.` + `en-IN` grouping, 2 decimals; zero → `—` |
| KPI value | 20–22px / 600 tabular |
| KPI label | 12px muted — **not** 10px uppercase shouting |

Font stack must keep **Noto Sans Devanagari** for Nepali names.

---

## 4. Universal control kit (every small button)

**Canonical:** `@/design-system` — `Button`, `IconButton`, `DropdownMenu`, chips from Feedback/Patterns.  
**Do not** invent page-local `h-8 bg-[#1557b0]` buttons on migrated screens.

### 4.1 Button variants (exact)

| Variant | Look | Allowed uses |
|---------|------|--------------|
| `primary` | Solid `#0F5C8C`, white text, radius 8px, no glow | **One** of: Apply / Generate / Save / Post / Sign in / New journal |
| `secondary` | White + border | Print, Options, Back, Cancel, Export trigger |
| `quiet` | Transparent | Clear filters, Reset, tertiary links-as-buttons |
| `destructive` | Danger fill | Delete / Void — only after confirm |
| `link` | Text underline on hover | “What does this mean?”, drill account name |

**Sizes:** `small` table/row · `medium` toolbars (default) · `large` auth only.

**Icon rule:** Primary CTA is **text-first** (“Generate report”, “Post invoice”). Icons only when meaning is universal (Print, Download). Never Sparkles on money actions.

### 4.2 Standard report action cluster (right of PageHeader)

Order left → right (always the same):

1. `IconButton` **Refresh** — `aria-label="Refresh report"` · title “Refresh (F5)” · quiet  
2. `Button secondary` **Print**  
3. `Button secondary` **Export** with chevron → menu: Excel · CSV · PDF (if exists)  
4. `Button secondary` **Options** (opens settings dialog)  
5. Optional: status chip left of cluster (“Accounts match”)

**Never:** Excel and CSV as two equal blue buttons; never 📄/🖨️ emoji; never Export as the only primary.

### 4.3 Filter region actions

| Control | Variant | Label |
|---------|---------|-------|
| Apply / Generate | `primary` | “Show report” (preferred) or “Generate report” |
| Cancel (modal) | `secondary` | Cancel |
| Reset filters | `quiet` | Reset |

If filters are **inline** (Day Book), primary = “Show” only when dates change; otherwise live-update without second primary.

### 4.4 IconButton inventory (product-wide)

| Action | Icon | `aria-label` (mandatory) | Visibility |
|--------|------|--------------------------|------------|
| Refresh | `RefreshCw` | Refresh report / Refresh | Always visible in report header |
| View row | `Eye` | View voucher / View details | Opacity 100 on row hover **and** focus (not hover-only) |
| More row | `MoreHorizontal` | More actions | Opens menu: View, Print, Duplicate… |
| Close modal | `X` | Close | Dialog header |
| Expand group | `ChevronRight`/`Down` | Expand / Collapse {name} | Statement trees |

### 4.5 Status chips (quiet — never shouting uppercase 10px)

| Domain | States → label |
|--------|----------------|
| Statement trust | `Accounts match` · `Out by Rs. X` · `Statement balances` · `Needs review` |
| Voucher (list) | `Draft` · `Posted` · `Cancelled` — sentence case |
| Sync (txn shell) | Keep `lifecycleLabel()` from `src/features/transactions/status.ts` |
| Overdue | `Overdue` on warning surface — **no** ⚠ emoji |

Chip look: `px-2 py-0.5 rounded-md text-[12px] font-medium` + status surface tokens. **No** `uppercase tracking-wide` on status.

### 4.6 Tabs & segmented controls

| Pattern | Look |
|---------|------|
| Tabs (TB views, VAT annexes) | Height 36px; active = 2px bottom `--ds-action-primary`; label 13px; no filled blue tab backgrounds |
| Segmented (Condensed/Detailed, Month/Quarter/Year) | Single bordered group; selected = `--ds-surface-selected` + brand text |

### 4.7 Options / settings dialog

Migrate `ErpReportModal` / report options overlays → DS `Dialog`:

- Title: “Report options”  
- Body: grouped fields with plain labels + 12px helpers  
- Footer: Cancel (`secondary`) · Show report (`primary`)  
- First-visit auto-open OK once; after that remember (localStorage) — empty state offers “Choose dates” instead of trapping user

### 4.8 Empty / loading / error

| State | Component | Copy example |
|-------|-----------|--------------|
| Empty | DS `EmptyState` | “Choose a date range, then show the report.” CTA: Show report |
| Loading | Quiet spinner + 13px | “Preparing statement…” — no huge brand spin |
| Error | Banner danger | Plain cause + Retry |

Replace `src/components/ReportEmptyState.tsx` usage on migrated pages.

### 4.9 Transaction form footer (reference pattern)

**Files:** `SalesInvoiceForm.tsx` and voucher forms — migrate to:

| Order | Button | Variant |
|------:|--------|---------|
| 1 | Cancel | quiet |
| 2 | Print preview | secondary |
| 3 | Save draft | secondary |
| 4 | Post / Save | primary |

Text-first; drop icon-on-every-button clutter.

### 4.10 Balance strip (forms + journal)

| State | Surface | Text |
|-------|---------|------|
| Balanced | success surface | “Balanced — ready to save” |
| Unbalanced | danger surface | “Out by Rs. X — fix before posting” |

---

## 5. Plain-language dictionary (expanded)

**File:** `src/components/shell/navConfig.ts` + each PageHeader.

| Route / old title | Visible title | Help line (subtitle) |
|-------------------|---------------|----------------------|
| Balance Sheet | What you own & owe | Snapshot of assets, liabilities, and capital. (Balance sheet) |
| Trial Balance | Account totals check | Debits and credits should match. (Trial balance) |
| Profit & Loss | Profit & loss | Income and expenses for the period. (P&L) |
| Journal / Journal vouchers | Manual journal | Record transfers that are not sales or purchases. |
| General Ledger | Account activity | Browse accounts and open any account’s history. |
| Day Book | Today’s transactions | Everything entered for the selected dates. |
| Cash Book | Cash book | Money in and out of cash. |
| Bank Book | Bank book | Money in and out of bank. |
| Cash Flow | Cash flow | Where cash came from and went. |
| Party Statement | Customer / supplier statement | Running balance for one party. |
| Outstanding Receivables | Money customers owe | Unpaid sales. |
| Outstanding Payables | Money you owe | Unpaid purchases. |
| Aging | Overdue by age | How long invoices have been unpaid. |
| Contra | Transfer between accounts | Move money between cash/bank. |
| Receipt | Receive money | — |
| Payment | Pay money | — |
| Bill Sundries | Extra charges & discounts | — |
| PDC Register | Post-dated cheques | — |
| Chart of Accounts | Account list | — |
| Item Master | Products & items | — |
| Orbix | Ask Orbix | — |

---

## 6. Canonical ReportWorkspace (build once)

**New file:** `src/features/reports/ReportWorkspace.tsx`  
**Retoken / thin-wrap:** `src/components/reporting/ReportShell.tsx` (legacy hex toolbar → call ReportWorkspace or die gradually)  
**Also consolidate:** `src/components/reports/ReportShell.tsx` (duplicate) — one API only  
**Reuse logic, restyle chrome:** `FinancialStatementChrome.tsx`, `NepalFinancialStatementView.tsx`, `PLToolbar.tsx` patterns

### 6.1 Layout blueprint

```text
┌─ PageHeader ──────────────────────────────────────────────────────────────┐
│ Title (plain)                                              [chip]         │
│ Help (13px muted)                                                         │
│ Meta: Company · FY · DualDate period                                      │
│ Actions: [↻ Refresh] [Print] [Export ▾] [Options]                         │
├─ FilterBar (Surface, no-print) ───────────────────────────────────────────┤
│ Dual date range · entity filters · quiet chips · [Show report] primary    │
├─ Optional KPI strip (max 4 tiles) ────────────────────────────────────────┤
├─ StatementSurface (white, 1px border) ────────────────────────────────────┤
│ Tabs (if any)                                                             │
│ Breadcrumb when drilled: Account list / Cash / …                          │
│ Table / T-format / tree                                                   │
│ Sticky total footer                                                       │
├─ print-only header (hidden on screen) ────────────────────────────────────┤
│ Company (EN) · नाम · PAN · Title · Period BS+AD · Printed at              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Statement table micro-spec (all BS / TB / P&L / NAS)

| Row type | Background | Type | Indent | Interaction |
|----------|------------|------|--------|-------------|
| Column header | `--ds-surface-muted` | 12px semibold | 0 | — |
| Section band | `--ds-surface-muted` | 13px semibold | 0 | No chevron; plain section title |
| Group | white | 13px semibold | 16px × level | Chevron; `aria-expanded`; click toggles |
| Account / leaf | white | 13px regular | 16px × level | Hover `--ds-surface-hover`; click drills |
| Subtotal | muted + top 1px strong border | 13px semibold | match section | “Total {section}” |
| Grand total | `--ds-brand-50` + top 2px `--ds-action-primary` | 13px bold | 0 | “TOTAL” / “Grand total” |
| Difference (TB) | danger surface | 13px semibold | 0 | “Out by Rs. X (should be zero)” |

**Comparative / previous year:** group column headers as muted text “This year” / “Last year” — **never** solid `#1557b0` / `#64748b` filled bands (current TB anti-pattern).

**T-format (BS / P&L horizontal):** two equal columns, shared vertical rhythm, each with own TOTAL foot; outer max-width ~1200px centered.

### 6.3 Drill-down presentation

| Element | Spec |
|---------|------|
| Breadcrumb | 13px; clickable ancestors; `/` separator; current segment strong |
| Back | `Button secondary` “Back to {parent}” — not icon-only |
| Keyboard | `Esc` = back one level; `Enter` = open focused row; document in footer hint 12px muted |
| Voucher peek | DS `Dialog`: DualDate, type (plain), narration, lines, Close |
| GL tree → statement | Keep full-page or large Drawer on xl+; sticky back bar on mobile |

**Hook reuse:** `src/hooks/useDrillDownNav.ts` (already on GL).

### 6.4 Print

- Toolbar / filters / KPI / breadcrumbs: `no-print`  
- `print-only`: company, PAN, title, BS+AD period, timestamp  
- Repeat table headers; keep `Rs.`  

### 6.5 Amount & Dr/Cr

- Always `Rs.` in column headers: `Debit (Rs.)` / `Credit (Rs.)` / `Amount (Rs.)`  
- Colour **plus** “Dr”/“Cr” text or column placement — never colour alone  
- Use `--ds-financial-debit` / `--ds-financial-credit`

---

## 7. Screen-by-screen ultra specs

### 7.1 Balance Sheet — `src/pages/BalanceSheet.tsx`

**Also touch:** `src/lib/balanceSheetTypes.ts` (labels only if needed), `NepalFinancialStatementView.tsx`, `styles.css` `.erp-bs-table` → prefer DS classes

| Area | Target look |
|------|-------------|
| Title | What you own & owe |
| Help | Snapshot of assets, liabilities, and capital. (Balance sheet) |
| Meta | As at **BS + AD** (not ISO-only) |
| KPI strip (max 4) | Total assets · Liabilities & capital · Closing stock · Status chip |
| Status chip | “Statement balances” / “Needs review — out by Rs. X” |
| Options (Dialog) | Plain labels: “Nepal schedule layout” vs “Simple two-sided”; “Side by side” vs “Top to bottom”; show zero; compare last year; closing stock method with one-line helpers — hide “GP Ratio” jargon behind “Advanced” |
| Body | Horizontal T or Vertical / NAS — same table micro-spec §6.2 |
| Hide | `[screen only]` 9px amber tags in default view; move to Options tooltip if needed |
| Buttons | §4.2 cluster + Show report in Options footer |
| Print | Company + As at DualDate |
| Unbalanced banner | Danger Banner: plain “Assets and liabilities do not match by Rs. X” |

**Remove:** raw Options portal hex; icon Refresh without aria-label.

---

### 7.2 Trial Balance — `src/pages/TrialBalance.tsx`

| Area | Target look |
|------|-------------|
| Title | Account totals check |
| Help | Debits and credits should match. (Trial balance) |
| Chip | “Accounts match” / “Out by Rs. X” |
| Tabs | By name · By group · Opening · Detailed — plain |
| Columns (simple) | Account · Debit (Rs.) · Credit (Rs.) · optional % · optional last-year Dr/Cr |
| Columns (detailed) | Group bands Opening / Movements / Closing — muted labels, not painted blue headers |
| Footer | Grand total row §6.2; difference row if unbalanced |
| Search | DS `SearchField` “Find account” |
| Drill | Breadcrumb + ledger peek; Back secondary |
| Empty | Before generate: EmptyState + Show report (do not force Options modal every time after first visit) |
| Buttons | Options secondary; Print; Export ▾; Show report primary in filter/options |
| Print | Add print-only company header (currently missing) |

---

### 7.3 Profit & Loss — `src/pages/ProfitLoss.tsx` + `src/components/pl/*`

| File | Action |
|------|--------|
| `PLToolbar.tsx` | Become ReportWorkspace header actions; drop decorative `BarChart2` as hero |
| `PLOptionsDialog.tsx` | DS Dialog + plain option copy |
| `PLHorizontal.tsx` / `PLVertical.tsx` / `PLDrillDown.tsx` | Retoken tables to §6.2 |
| `FinancialStatementChrome.tsx` | DualDate period; DS type |

| Area | Target look |
|------|-------------|
| Title | Profit & loss |
| Help | Income and expenses for the period. |
| KPI (4) | Sales · Purchases · Gross profit/loss · Net profit/loss — quiet tiles, no 10px scream |
| Net badge | In header chip: “Net profit Rs. X” / “Net loss Rs. X” using financial colours + words |
| Export | Single Export ▾ (Excel, CSV, Print) — keep existing keyboard Alt+P / F5 |
| Closing stock input | DS Input in Options or quiet inline field — not random bordered hex field |
| Variants | Side by side · Top to bottom · Monthly — segmented, plain |

---

### 7.4 Manual journal — `src/pages/JournalEntries.tsx` + form

| Area | Target look |
|------|-------------|
| List title | Manual journal |
| Help | Record transfers that are not sales or purchases. |
| Filters | DualDate from/to · Status select (All / Draft / Posted / Cancelled) · Search · page size |
| Columns | No. · Date (DualDate) · Description · Debit (Rs.) · Credit (Rs.) · Status chip · Actions |
| Footer | Showing X of Y **plus** sum Debit / Credit when useful |
| Primary | “New journal” |
| Secondary | Export |
| Row action | IconButton View — visible on focus/hover |
| Form | Wrap with `TransactionWorkspace` / balance strip §4.10; title “Manual journal” |
| Print | Add Print on form; list optional |

---

### 7.5 Account activity (General Ledger) — `src/pages/GeneralLedger.tsx` + `LedgerStatementView.tsx`

| Area | Target look |
|------|-------------|
| Tree title | Account activity |
| Help | Browse accounts and open any account’s history. |
| Tree toolbar | Add SearchField + Refresh (currently **no buttons** — gap) |
| Tree columns | Account · Balance (Rs.) with Dr/Cr |
| Keyboard footer | Keep ↑↓ →← Enter hints — restyle to 12px muted bar |
| Statement title | `{Account name}` |
| Statement filters | Segmented Month / Quarter / Year / Custom + BS-aware pickers |
| Statement columns | BS date · AD date · Particulars · Type · No. · Debit · Credit · Balance |
| Opening/closing | Muted band rows |
| Actions | Print · Export · Back to account list |
| Focus row | `--ds-surface-selected` — not raw `rgba(21,87,176,0.06)` |

---

### 7.6 Today’s transactions (Day Book) — `src/pages/DayBook.tsx`

| Area | Target look |
|------|-------------|
| Title | Today’s transactions |
| Help | Everything entered for the selected dates. |
| Filters | DualDate range · Search · Type · Condensed/Detailed segmented · Jump to no. |
| KPI | Max 3 quiet tiles: Count · Total in (Rs.) · Total out (Rs.) — **no** TrendingUp decorative icons |
| Columns | Date (DualDate) · No. · What (type + short narration) · Party · In (Rs.) · Out (Rs.) · Status · By · View |
| Type | Quiet chip — **not** rainbow uppercase pills |
| Totals | Sticky footer; imbalance → danger strip |
| Buttons | Print · Export secondary (not primary blue Export-only) |
| Modal | DS Dialog voucher peek |
| Print | Company header + period DualDate |

---

### 7.7 Cash Book / Bank Book

**Files:** `CashBook.tsx`, `BankBook.tsx`, `reporting/ReportGrid.tsx`, `reporting/ReportShell.tsx`

| Target |
|--------|
| Titles: Cash book / Bank book |
| Filters: account select + DualDate (replace AD-only `type="date"`) |
| Columns: Date DualDate · Particulars · Vch · Debit · Credit · Balance |
| Actions: via ReportWorkspace §4.2 |
| Fix stale props if `toolbarLeft`/`companyName` unused — align to ReportWorkspace API |

---

### 7.8 Cash flow — `CashFlowStatement.tsx`

| Target |
|--------|
| Title: Cash flow · help plain |
| Remove emoji ⚠; dark `#1e2433` headers → muted section bands |
| Add Print; Export secondary |
| Method toggle as segmented control with one-line plain explanation |

---

### 7.9 Party statement — `PartyLedgerStatement.tsx` / `PartyStatement.tsx`

| Target |
|--------|
| **Remove 📄 🖨️ emoji** from Export/Print — Lucide + text |
| DualDate filters (already NepaliDatePicker — retoken) |
| Buttons: Reset quiet · Print secondary · Export secondary |
| Outstanding summary: collapsible section, not loud analysis panel |

---

### 7.10 Money customers owe / Money you owe / Overdue by age

**Files:** `OutstandingReceivables.tsx`, `OutstandingPayables.tsx`, `AgingReport.tsx`

| Target |
|--------|
| Plain titles §5 |
| Remove “⚠ Overdue Only” emoji → chip “Overdue only” |
| Export secondary; add Print |
| Aging bars: labels ≥12px; colours from status tokens |
| Remind / WhatsApp actions: secondary/quiet text buttons — no playful stickers; only if product already supports |

---

### 7.11 VAT reports — `VatReports.tsx`

| Target |
|--------|
| Delete duplicated inline ReportShell — use ReportWorkspace |
| Tabs: Summary · Annex A–D — §4.6 tab look |
| Fix BS date display (stub returning AD) **presentation** to real DualDate labels |
| Print + Export via §4.2 |

---

## 8. Shell, auth, home, Orbix (condensed from v1 — still required)

### 8.1 Shell files

`AppShell.tsx` · `PrimarySideNav.tsx` · `TopCommandBar.tsx` · `CommandPalette.tsx` · `NotificationCentre.tsx` · `SyncStatusControl.tsx` · `MobileBottomNav.tsx` · `PageContentFrame.tsx` · `navConfig.ts`

- Sidebar deep slate; active 2px brand bar  
- Orbix icon: `MessageSquare` (not Sparkles)  
- Sync: text + dot — Online / Syncing / Offline  
- Mobile max 5: Home · Sales · Receive · Pay · More  

### 8.2 Auth

`PreWorkspaceShell` · `GatewayScreen` · `CompanyLoginScreen` · `SignUpWizard` + steps · `AuthAccessSurfaces` · `InitErrorScreen` · `LanguageModal` (**add Nepali**)

### 8.3 Home

`src/features/home/*` — attention queue + ≤6 quick actions + calm KPI tiles; **unmount** achievements from default home.

### 8.4 Orbix

`OrbixWorkspace.tsx` · chat/sidebar/renderer/journal/clarification · `TrustChrome.tsx` · `ContextInspector.tsx` · `EKhataLauncher.tsx`  
**Replace** `OrbixNeuronThinking.tsx` with “Orbix is working…” quiet status — hide model/RAG strings.

---

## 9. Masters & banking (phase backlog)

Same as v1 cutover: Parties, StockBook, MasterControlCentre (regroup Advanced), Bank recon (eSewa/Khalti/ConnectIPS segmented), PDC/cheque — all on DS + plain titles. See §12 migration checklist.

---

## 10. Shared helpers map (do not reinvent)

| Path | Role in v2 |
|------|------------|
| `src/features/reports/ReportWorkspace.tsx` | **Create** — canonical chrome |
| `src/components/reporting/ReportShell.tsx` | Migrate internals to DS or re-export ReportWorkspace |
| `src/components/reports/ReportShell.tsx` | Deprecate / redirect |
| `src/components/reports/FinancialStatementChrome.tsx` | Retoken header/footer DualDate |
| `src/components/reports/NepalFinancialStatementView.tsx` | NAS comparative — §6.2 |
| `src/components/reports/NepalStatementTable.tsx` | Table skin |
| `src/components/reports/LedgerDrillPanel.tsx` | Align drill look |
| `src/components/pl/PLToolbar.tsx` | Align to §4.2 |
| `src/components/accounts/LedgerStatementView.tsx` | GL statement skin |
| `src/components/ui/ReportDateRangePicker.tsx` | → DS DateRangeFilter visuals |
| `src/components/reporting/ErpReportModal.tsx` | → DS Dialog |
| `src/components/ReportEmptyState.tsx` | → DS EmptyState |
| `src/hooks/useDrillDownNav.ts` | Keep behaviour; restyle hints |
| `src/lib/exportUtils.ts` / `printUtils.ts` | Keep logic; change calling UI only |
| `src/features/transactions/TransactionWorkspace.tsx` | Pattern reference for PageHeader |
| `src/features/transactions/status.ts` | Chip labels |

---

## 11. Page migration checklist (every file)

1. No BusyShell / PillTitle on migrated page  
2. Imports from `@/design-system`  
3. No new hex / no emoji buttons  
4. Essential text ≥12px  
5. Amounts `Rs.` tabular; dates DualDate where period shown  
6. Report pages use ReportWorkspace  
7. Icon-only controls have `aria-label`  
8. One primary per region  
9. `npm run ui:governance` clean  

**Dead — do not edit:** `StockItems.tsx`, `PurchaseInvoiceForm.tsx`, `ReturnInvoiceForm.tsx`

---

## 12. Auto-mode phases (ordered)

| Phase | Focus | Key files | Done when |
|-------|-------|-----------|-----------|
| **A** | Tokens | `tokens.css`, colour spec, DS lab | Governance + lab pass |
| **B** | Shell + plain nav | `navConfig`, side/top/mobile/sync | ui3-shell pass |
| **C** | Auth + Nepali language option | auth/*, LanguageModal | ui4-auth pass |
| **D** | Home calm | `features/home/*` | ui5-home; no achievements |
| **E** | Orbix calm | ekhata/* + TrustChrome + thinking replace | ui6-orbix |
| **F** | Txn form interiors | SalesInvoiceForm, vouchers, balance strip | ui7-txn |
| **G0** | **ReportWorkspace** | **new** `features/reports/ReportWorkspace.tsx`; retoken ReportShell | Lab/story or e2e fixture shows chrome |
| **G1** | Trial Balance + Day Book | `TrialBalance.tsx`, `DayBook.tsx` | §7.2 §7.6 acceptance |
| **G2** | Balance Sheet + P&L | `BalanceSheet.tsx`, `ProfitLoss.tsx`, `pl/*`, FinancialStatementChrome, NAS view | §7.1 §7.3 |
| **G3** | Journal + GL | `JournalEntries.tsx`, `GeneralLedger.tsx`, `LedgerStatementView.tsx` | §7.4 §7.5 |
| **G4** | Cash/Bank/CF/Party/OR/OP/Aging/VAT | listed pages | §7.7–7.11; **zero emoji buttons** |
| **H** | Parties / Items / Masters hub | Parties, StockBook, MasterControlCentre… | DS lists |
| **I** | Banking | BankReconciliation*, PDC, cheque | Nepal wallet tabs quiet |
| **J** | Settings | CompanySettings, users, hubs | Form sections |
| **K** | Sweep | hex kill, tally-green quarantine, migration tracker | Full governance |

### Auto prompt (copy)

```text
Implement Phase [X] from docs/ui-redesign/ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md (v2 Ultra) only.
Looks/presentation only — do not change posting, sync, or report calculation engines.
Use @/design-system and --ds-* tokens. No new raw hex. No emoji in buttons.
Follow §4 control kit and §6 ReportWorkspace rules for any report work.
Plain titles from §5. Essential text ≥12px. Run npm run ui:governance after.
```

---

## 13. Acceptance criteria (v2)

### Global
- [ ] Non-accountant can name Balance Sheet / TB / P&L from plain titles alone  
- [ ] One primary blue; Orbix teal only on Orbix  
- [ ] No emoji export/print; no neuron/model leak; no achievements on home  
- [ ] `Rs.` + BS/AD on statement headers  
- [ ] `ui:governance` pass  

### Statements (must all be true after G2)
- [ ] BS / TB / P&L use ReportWorkspace action order: Refresh · Print · Export ▾ · Options  
- [ ] Grand total row uses brand-50 + primary top border — not `#eef2ff`  
- [ ] TB previous-year mode has no filled blue/gray header bands  
- [ ] Balanced/unbalanced chips use DS status surfaces + plain words  
- [ ] Drill has breadcrumb + labelled Back + Esc  
- [ ] Print-only block includes company + DualDate period  

### Registers
- [ ] Journal + Day Book + GL tree have DS controls; Eye buttons keyboard-visible  
- [ ] Day Book type chips are quiet, not rainbow  

---

## 14. Explicit do-not-touch

- Engines: `balanceSheetEngine`, `profitLossEngine`, `nepalFinancialStatements`, posting/sync Python  
- `node_modules`, `dist`, `.git`, `.workspace`, `.tanstack`  
- Dead invoice/stock files listed above  
- Lovable history rewrite / force-push  

---

## 15. Visual mental model

```text
Sidebar (slate) │ Company · FY 2081/82 · Search · Sync · Bell · User
                │ What you own & owe                    [Statement balances]
                │ Snapshot of assets… (Balance sheet)
                │ As at ३१ असार २०८१ · 15 Jul 2024
                │                    [↻] [Print] [Export ▾] [Options]
                │ Filters…                              [Show report]
                │ ┌ Liabilities ──────────┬ Assets ──────────────┐
                │ │ … dense Rs. rows …    │ …                    │
                │ │ TOTAL                  │ TOTAL                 │
                │ └───────────────────────┴──────────────────────┘
```

**Reviewer feel words:** calm · clear · trustworthy · Nepal-ready · adult software.

---

## 16. Gap closure vs v1 (what this ultra adds)

| Missing in v1 | Added in v2 |
|---------------|-------------|
| Statement table/total/comparative micro-spec | §6.2 |
| Drill breadcrumb / Esc / Back labelling | §6.3 |
| Exact report button order & Export menu | §4.2 |
| IconButton aria + hover/focus visibility | §4.4 |
| Quiet status chips for reports | §4.5 |
| Tabs / segmented look | §4.6 |
| Per-screen button inventories (BS/TB/P&L/Journal/GL/DayBook) | §7 |
| Dual ReportShell consolidation | §6, §10 |
| TB anti-pattern (blue comparative headers) | §6.2, §7.2 |
| Party ledger emoji buttons | §7.9 |
| GL tree missing toolbar | §7.5 |
| Print-only gap on TB | §7.2 |
| Phased report sub-phases G0–G4 | §12 |
| KPI tile typography (no 10px shout) | §3, §7 |

---

*End of v2 Ultra. Implement via §12 using the Auto prompt. Prefer Phase A → B → G0 before deep report page skins.*
