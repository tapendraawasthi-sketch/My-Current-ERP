# ORBIX ERP — 100% Looks Master Plan (v4 ZERO-OMISSION)

> **SUPERSEDED.** Implement from **[`ORBIX_UI_IMPLEMENT_NOW.md`](./ORBIX_UI_IMPLEMENT_NOW.md)** only.  
> This v4 file is historical taxonomy; do not use it for new Auto work.

**Status:** SUPERSEDED by `ORBIX_UI_IMPLEMENT_NOW.md`.  
**Supersedes (historical):** `ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md` (v3), `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md` (v1/v2).  
**Scope:** Presentation only — no posting, sync, accounting engines, or Python changes.  
**Audited:** 2026-07-14 deep particle + surface inventory (~214 pages, ~202 components, full `@/design-system`, legacy `ui/`, global CSS, labs).

---

# BOOK 0 — How to use this document

| If you are… | Read / do |
|-------------|-----------|
| Auto mode starting work | BOOK 1 authority → BOOK 2 Wave 0 → assigned Wave |
| Designing a control | BOOK 3 particle + BOOK 4 composite |
| Migrating a page | BOOK 5 family + BOOK 6 route/orphan registry |
| Claiming “done” | BOOK 8 Definition of Done — all checkboxes |

**Single authority sentence:**

> Migrated files use only `@/design-system` + `var(--ds-*)` + domain composites defined in BOOK 4. Essential text ≥12px. No raw hex. No emoji chrome. No BusyShell/ActionToolbar/PillTitle on migrated surfaces. Untouched files may stay legacy until their Wave — never mix systems in one file.

---

# BOOK 1 — Truth, gaps, product look

## 1.1 Why previous plans were incomplete

| Gap class | Count / fact | Closed in this plan by |
|-----------|--------------|------------------------|
| Wired pages with only family labels | ~95 | BOOK 5 micro-rules + BOOK 6 |
| Orphan page files unwired | ~119 | BOOK 6 registry DEPRECATE/NAV/HUB |
| DS primitives unused in `src/pages` | ~all | Wave 0 + every migrate |
| Legacy `ui/` composites unnamed | 32 files | BOOK 3–4 |
| Global CSS fighting DS (green Radix) | `styles.css` | BOOK 3.9 kill |
| Missing composites (Combobox, LineGrid…) | 6+ | BOOK 4 build |
| EnterpriseDataTable feature holes | resize/zebra/footer… | BOOK 3.6 |
| Patterns never named (upload, charts, POS…) | 20+ | BOOK 5 Parts O–AG |
| Interaction states incomplete | pressed/loading… | BOOK 3.2 matrix |
| Lab-only features not shipped | ToastProvider, FilterBar… | BOOK 2 Wave 0 |

## 1.2 Product look

**Calm Himalayan ledger:** soft stone canvas `#F3F5F7`, one trust blue `#0F5C8C`, Orbix teal `#0A7A7A` only on Orbix, dense tables, plain Nepal-business English, Lucide outline icons, almost zero decoration.

## 1.3 Token retune (Wave 0 — `tokens.css`)

| Token | Value | Notes |
|-------|-------|-------|
| `--ds-action-primary` | `#0F5C8C` | All primary CTAs |
| `--ds-action-primary-hover` | `#0C4A72` | |
| `--ds-action-primary-pressed` | `#0A3A5A` | **Must wire on Button:active** |
| `--ds-canvas` | `#F3F5F7` | |
| `--ds-surface` | `#FFFFFF` | |
| `--ds-surface-muted` | `#EEF1F4` | Headers, bands |
| `--ds-text-strong/default/muted` | `#14212B` / `#2A3845` / `#5C6B79` | |
| `--ds-border-default` | `#D5DCE3` | |
| `--ds-intelligence` | `#0A7A7A` | Orbix only |
| `--ds-status-success/warning/danger` | `#0F6B56` / `#8A5A12` / `#B4232F` | + surfaces |
| `--ds-financial-debit/credit` | danger / success | Always with Dr/Cr or column |
| Radius | xs4 sm6 md8 lg10 | No pill CTAs |
| Shadow | 0–2 for UI; 3–4 overlays only | No glow |
| Z-index | DS scale only — **ban z-[9999]** | Modal ≤ `--ds-z-modal` |
| Motion | 100/160/220ms + reduced-motion | `.ds-transition` |
| Amounts | `Rs.` + `en-IN` + tabular + 2dp | zero → `—` |

**Kill forever on migrated UI:** `#1557b0`, `#eef2ff`, `#EBF5E2`, `#d4eabd`, purple/indigo, neon cyan, emoji buttons, `text-[9px]`/`text-[10px]` essential UI.

## 1.4 Typography (reconcile AGENTS vs DS)

| Role | Spec (migrated) |
|------|-----------------|
| Page title | 16px / 600 (use `PageTitle`; ignore AGENTS 15px and DS lab 24px on ERP pages) |
| Help | 13px muted |
| Section | 13px / 600 |
| Label | 12px / 500 muted |
| Body / cell | 13px |
| Column header | 12px / 600; uppercase **columns only** |
| KPI value | 20–22px / 600 tabular |
| Button | 14px / 500 |

Font stack: system + **"Noto Sans Devanagari"** for Nepali.

---

# BOOK 2 — Waves (execute in order — no skipping Wave 0)

## Wave 0 — Particle foundation (BLOCKER)

| # | Deliverable | Files |
|---|-------------|-------|
| 0.1 | Token retune §1.3 | `tokens.css`, `UI_COLOUR_TOKEN_SPEC.md` |
| 0.2 | Button pressed state | `Button.tsx` `:active` → pressed token |
| 0.3 | Wire `ToastProvider` at App root | `App.tsx` / `Layout.tsx` |
| 0.4 | Retoken `NepaliDatePicker` + `DualDate` | `ui/NepaliDatePicker.tsx`, `DualDate.tsx` |
| 0.5 | Retoken `ReportDateRangePicker` | → wrap DS DateRangeFilter + BS |
| 0.6 | Create `ReportWorkspace` | `features/reports/ReportWorkspace.tsx` |
| 0.7 | Collapse dual ReportShell → ReportWorkspace | `reporting/ReportShell`, `reports/ReportShell` |
| 0.8 | Build BOOK 4 composites (stubs OK if API frozen) | Combobox, AmountField, DualDateField, LineItemGrid, Dropzone, StatementTable |
| 0.9 | Neutral styles.css green Radix overrides for DS path | `styles.css` ~852–919 |
| 0.10 | Ban `.page-toolbar` green on migrated | quarantine class |
| 0.11 | Emoji kill | PartyLedger, OR/OP, BankRecon tab, FixedAssetRegister if touched |
| 0.12 | Nav: bank-recon + statement-import + registers | `navConfig.ts` |
| 0.13 | Orbix icon → MessageSquare; calm thinking | `navConfig`, `OrbixNeuronThinking` |
| 0.14 | Authority pointer | top of v3 plan + `UI_DESIGN_AUTHORITY_MANIFEST.md` |
| 0.15 | Governance green | `npm run ui:governance` + `ui:ds-lab` |

**Auto prompt Wave 0:**  
`Implement Wave 0 from ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md only. Looks only. No engine changes.`

## Wave 1 — Shell / auth / home / overlays

D1–D4 from v3 PLUS: CompanySwitcher, LanguageModal Nepali, F12/Falcon/Sutra/Nios calm, Toast cutover, unmount achievements, DataLoadWarningBanner → Banner, density honesty label.

## Wave 2 — Statements & daily books

STMT + REG + LEDG + AGING: TB, DayBook, BS, P&L, Journal, GL, Cash/Bank, CashFlow, Party statement, OR/OP/Aging + ReportWorkspace.

## Wave 3 — Transaction interiors & tax

TXN LineItemGrid + all voucher forms + InvoicePrint + D/C notes + orders/challan/GRN + TAX + Sales/Purchase registers.

## Wave 4 — Masters & banking

MASTER CRUD pattern + Setup centre + BANK recon/import/cheque/PDC + BusyShell kill list.

## Wave 5 — Inventory ops, payroll, secondary reports

Remaining TXN inventory · PAY · secondary STMT · stock reports.

## Wave 6 — Config, communication, orphan cleanup, QA

CFG · CommunicationHub · orphan registry actions · topbar retirement · tally quarantine enforcement · e2e expansion · a11y · tracker update.

---

# BOOK 3 — Every particle (atoms)

## 3.1 DS primitive completion checklist

Implement missing specs before or during Wave 0–1. **Y = must spec+code.**

| Particle | Must add | Done when |
|----------|----------|-----------|
| Button | `:active` pressed; no success-fill variant (use StatusChip) | pressed visible |
| IconButton | optional `selected` quiet state; always aria-label | — |
| Input | hover border; optional `loading` endAddon spinner | — |
| Textarea | optional `maxLength` counter 12px muted | — |
| Select | empty + loading content states | — |
| Checkbox | `readOnly`; group `Inline` gap | — |
| Radio | horizontal `RadioGroup` layout prop | — |
| Switch | disabled label contrast | — |
| Tabs | `disabled` tab; overflow “More” if >6 | — |
| Badge | deprecate for StatusChip OR add tones | one chip system |
| StatusChip | vocabulary §3.3; no uppercase shout | — |
| Skeleton | presets: `row`, `kpi`, `form` | — |
| Dialog | optional loading overlay; sizes only 400/560/760/1040 | — |
| Drawer | widths `sm=360 md=420 lg=560` | — |
| Popover | sizes sm/md | — |
| DropdownMenu | optional shortcut column 12px muted | — |
| Toast | enter/exit 160ms; max 3; no emoji | App-rooted |
| EmptyState | optional Lucide `icon` slot (muted) | — |
| Progress | indeterminate uses DS motion not random pulse | — |
| DateRangeFilter | **must support DualDate** via composite | BOOK 4 |
| Pagination | page window (1 … 4 5 6 … N) | wire under tables |
| EnterpriseDataTable | §3.6 feature pack | Wave 0–2 |
| Link | **add** `Link` primitive (text-link styles) | Wave 0 |
| applyDensity | document: shell + DS controls; legacy until migrate | Wave 1 copy |

## 3.2 Interaction state matrix (all controls)

Every control below MUST define: default · hover · focus-visible · active/pressed · disabled · loading · invalid/error · (selected if applicable).

| Control | Selected / Open | Notes |
|---------|-----------------|-------|
| Button | — | pressed token |
| IconButton | `aria-pressed` optional | |
| Input/Textarea | — | invalid border danger |
| Select | open = content elevated | |
| Checkbox/Radio | checked | |
| Switch | on | |
| Tab | active underline 2px primary | never green fill |
| FilterChip | — | remove on × |
| Table row | selected / focus ring | keyboard ↑↓ |
| Tree row | expanded | aria-expanded |
| Menu item | highlighted | |
| Toast | — | auto-dismiss 5s |
| Dialog/Drawer | open | focus trap |
| Tooltip | — | delay 400ms |
| Scrollbar | — | §3.8 |

**Focus:** only `.ds-focus-ring`. Remove competing `button:focus` green/blue ad hoc on migrated trees.

## 3.3 StatusChip vocabulary (sentence case, 12px)

| Domain | Labels |
|--------|--------|
| Voucher | Draft · Posted · Cancelled · Posted locally · Waiting to sync · Synced · Failed · Conflict |
| Statement | Accounts match · Out by Rs. X · Statement balances · Needs review |
| Aging | Current · Overdue · Paid · Partial |
| Sync (shell) | Online · Syncing · Offline · Needs review |

Surface = `--ds-status-*-surface`. **Never** `UPPERCASE tracking-wide` 10px pills.

## 3.4 Form particles

| Particle | Spec |
|----------|------|
| Label | 12px medium muted; `*` danger for required |
| Description | 12px muted under field |
| Error | 12px danger; associate `aria-describedby` |
| Warning | 12px warning; optional warning border |
| Horizontal field | label 160px desktop; stack &lt;768px |
| AmountField | BOOK 4 — `Rs.` addon, tabular, select-all on focus |
| Narration | Textarea 2–3 rows; placeholder plain |
| VAT group | Collapsible “Tax (VAT 13%)” — rate, taxable, tax |
| TDS group | Collapsed by default — “Tax deducted (TDS)” |
| Balance strip | success/danger surfaces — “Balanced — ready to save” / “Out by Rs. X” |
| Custom fields | `CustomFieldRenderer` → FormField matrix only |
| Required surface | optional `--ds-surface-selected` wash — do not use Tally yellow |

## 3.5 Typeahead / picker particles → BOOK 4 Combobox

Map: `PartySelect` · `ItemSelect` · `AccountSelect` · `CurrencySelect` · legacy `Select` searchable · `SearchableTable` search mode.

## 3.6 Table particles (EnterpriseDataTable + StatementTable)

| Feature | Spec | Priority |
|---------|------|----------|
| Header | muted, 12px semibold, sticky | P0 |
| Sort | 3-state; aria-sort | P0 |
| Row hover | `--ds-surface-hover` | P0 |
| Row selected | `--ds-surface-selected` | P0 |
| Row focus | focus-visible ring on tr/td | P0 |
| Selection checkbox | header indeterminate | P1 |
| Expand row | chevron | P1 |
| Row actions | IconButton menu; visible hover+focus | P0 |
| Zebra | optional `striped` prop — muted/white | P1 |
| Footer totals | sticky tfoot; brand-50 grand total | P0 for REG/STMT |
| Column resize | P2 — optional after Wave 2 |
| Frozen columns | P2 — first col freeze optional |
| Pagination | below table; DS Pagination | P0 |
| Empty/Loading/Error | DS patterns | P0 |
| Virtualization | enable ≥500 rows | P2 |
| Financial cells | `formatAmountCell` / DebitCreditCell | P0 |
| Priority hide | `priority:low` hide &lt;md | P1 |
| Line-item grid | **LineItemGrid composite** not raw `.line-table` | P0 Wave 3 |

**Statement rows (STMT):** section band · group+chevron · leaf · subtotal · grand total (2px primary top) · difference danger — indent 16px×level.

## 3.7 Overlay particles

| Overlay | Size / behaviour |
|---------|------------------|
| Dialog | 400 / 560 / 760 / 1040; mobile fullscreen |
| AlertDialog | confirm destructive |
| ConfirmDialogFoundation | financial typed confirm — internal fields DS |
| Drawer | sm/md/lg; NotificationCentre = md right |
| Popover | filters |
| DropdownMenu | actions / Export ▾ |
| Command palette | z command; result: title 13px + hint 12px muted; groups |
| Print overlay | hide chrome via `.ds-no-print` |
| F12 | Dialog/Drawer “Quick settings” — ≥12px, no hex |
| Falcon / Sutra / EKhata / Nios | §5.AI |
| CalculatorPanel | Popover/Dialog calm; Lucide only |
| ErpReportModal | → Dialog large |

**Export menu contents (always):** Excel · CSV · PDF/Print — Lucide + text, never emoji.

## 3.8 Scrollbar / motion / elevation

| Atom | Spec |
|------|------|
| Scrollbar | 8px thumb `--ds-border-strong` on muted track; sidebar + main |
| Motion | `.ds-transition` only; respect `prefers-reduced-motion` |
| Elevation | cards shadow-1; dialogs shadow-3; no 4-layer glow |
| Radius | md 8 default controls |

## 3.9 Global CSS kill / migrate list

| Class / rule | Action |
|--------------|--------|
| Radix green overrides (`#ebf5e2`) | Delete or scope under `.legacy-tally` only |
| `.page-toolbar` green | Do not use; PageHeader instead |
| `.badge-*` uppercase 10px | → StatusChip |
| `.total-row` `#eef2ff` | → brand-50 + primary border |
| `.erp-report*` | → ReportWorkspace classes |
| `.no-print` / `.print-only` | Alias to `.ds-no-print` / `.ds-print-only` then prefer DS |
| `.busy-*` | Retire with BusyShell |
| Modal z-9999 | → DS z modal |
| Dual `--ox-*` on migrated | Forbidden; ox remains only for untouched files |

## 3.10 Print atoms

| Atom | Spec |
|------|------|
| Hide | toolbar, filters, nav, chips actions |
| Show | company EN + NE name, PAN, title, DualDate period, printed-at |
| Page | A4, margin 12–15mm |
| Type | 11–12px tables; amounts tabular Rs. |
| Components | `InvoicePrint`, `VoucherPrint`, `ReportPrint`, cheque, payslip — white preview + Print primary |

## 3.11 Responsive

| Breakpoint | Behaviour |
|------------|-----------|
| &lt;640 | stack forms; bottom nav; dialogs fullscreen |
| 640–1023 | collapse sidebar to icons; tables horizontal scroll |
| ≥1024 | full sidenav 240px |
| Tables | `priority:low` columns hide &lt;md; always horizontal scroll fallback |
| Touch | density bumps hit targets on mobile (existing tokens) |

## 3.12 Icons

| Rule | Spec |
|------|------|
| Library | Lucide outline only (+ DS domain icons) |
| Sizes | 16 / 20 / 24 tied to small/medium/large |
| Icon-only | IconButton + aria-label |
| Decorative | `aria-hidden` |
| Nav Orbix | MessageSquare |
| Ban | emoji, spinning logos, sparkles on money |

## 3.13 Lab → production must-ship (Wave 0–1)

ToastProvider · ConfirmDialogFoundation · FilterBar · SearchField · SelectionSummary · EnterpriseDataTable · SyncStatusChip full set · RecoveryPanel · StepProgress (wizards) · density/theme already in shell — extend to DS controls.

---

# BOOK 4 — Domain composites (build once)

Create under `src/design-system/composites/` (or `src/components/ds-composites/`) and export from design-system when stable.

### 4.1 `Combobox` (replaces Party/Item/Account/legacy searchable Select)

| Spec | Detail |
|------|--------|
| Trigger | Input-like h=control; search as you type |
| List | max-h 280; 13px rows; keyboard ↑↓ Enter Esc |
| Empty | “No matches” + optional “Create new” quiet |
| Loading | InlineLoading |
| Party row | Name · type chip C/S · phone muted |
| Item row | Name · unit · stock qty muted |
| Account row | Code · name · group muted |

### 4.2 `AmountField`

Rs. startAddon · tabular · `en-IN` blur format · select-all focus · invalid state · FormField wrapper.

### 4.3 `DualDateField` / display

Wrap retokened NepaliDatePicker; display DualDate BS primary 13px / AD 12px muted; dark-safe; no `#000`.

### 4.4 `DateRangeField`

Presets: Today · This month · This FY · Custom; DualDate from/to; used by ReportWorkspace.

### 4.5 `LineItemGrid`

Editable dense grid for invoices/vouchers: Item Combobox · Qty · Rate · Disc% · VAT · Amount · delete IconButton; Tab/Enter navigation; footer totals sticky; readonly when Posted.

### 4.6 `Dropzone`

Dashed border muted; “Drop file or browse”; 13px; error Banner; used by bank import, backup, attachments.

### 4.7 `StatementTable`

Implements STMT row types §3.6; expand/drill; footer; used by BS/TB/P&L/NAS.

### 4.8 `ReportWorkspace`

PageHeader + actions §4.9 + FilterBar + KPI slot + StatementSurface + print-only header. **One primary:** Show report in filter region.

### 4.9 Report action cluster (fixed)

`[↻ Refresh aria-label]` `[Print secondary]` `[Export ▾]` `[Options secondary]` + status chip left.

### 4.10 `BalanceStrip`

Full-width success/danger for forms and TB/BS chips.

### 4.11 `HubCardGrid`

Equal cards: title 14px · help 12px muted · optional muted shortcut; used by VoucherEntryHub, MasterControlCentre, ConfigurationHub.

### 4.12 `SplitWorkspace`

3-pane / 2-pane: primary + inspector; collapse inspector &lt;lg; used by Orbix + TXN inspector.

### 4.13 `MarkdownMessage`

Orbix/Falcon: calm headings 14px · tables DS-like · code muted surface · no raw HTML; hide model dumps.

### 4.14 Legacy → composite map

| Legacy | Target |
|--------|--------|
| ActionToolbar | PageHeader |
| PillTitle / FormPanel / GroupBox | Section + Surface |
| BusyInput / FlatBtn | Input / Button |
| Modal / ConfirmDialog green | Dialog / AlertDialog |
| DataTable / Table / SearchableTable | EnterpriseDataTable |
| Pagination green | DS Pagination |
| NotificationPanel | NotificationCentre |
| AmountInput | AmountField |
| Party/Item/AccountSelect | Combobox |
| AttachmentUploader | Dropzone |
| ReportEmptyState | EmptyState |
| CalculatorPanel | calm Dialog |
| BatchSerialSelector | Dialog + table |
| AuditHistoryPanel | Drawer |
| CustomFieldRenderer | FormField loop |
| LanguageModal | Dialog + Nepali first |

---

# BOOK 5 — Surface families (100% coverage rules)

Every production surface uses exactly one family. Rules below are binding.

## 5.SHELL — App chrome, auth, home

**Files:** `AppShell`, side/top/mobile nav, palette, sync, notifications, CompanySwitcher, auth/*, `HomePage`, `InitErrorScreen`, `DataLoadWarningBanner`.

| Rule | Spec |
|------|------|
| Sidebar | Deep slate; 2px primary active; 13px labels from BOOK 6 dictionary |
| Top | 48–52px; search; sync; bell; user; density menu (“Applies to updated screens” until Wave 6) |
| Home | Greeting · DualDate period · Attention · ≤6 actions · ≤6 KPI · no achievements · no recharts clutter |
| Auth | PreWorkspaceShell; large Sign in; PAN/VAT plain; Nepali name field |

## 5.AI — Orbix + Falcon + Sutra + Nios + EKhata

| Rule | Spec |
|------|------|
| Orbix | SplitWorkspace; TrustChrome; quiet “Orbix is working…”; intelligence teal border only |
| Falcon/Sutra | Same calm; launcher text “Assist” / deep-link Orbix preferred |
| Nios | Admin/operator only; Bench tab not for cashiers |
| Markdown | MarkdownMessage |
| Ban | neuron glow, model names, RAG paths, trophies |

## 5.STMT — Financial statements

ReportWorkspace + StatementTable + Options Dialog (Advanced collapsed) + DualDate meta + status chips.  
**Members:** BalanceSheet, TrialBalance, ProfitLoss+pl/*, CashFlow, IncomeExpenditure, Equity, FundsFlow, NotesToAccounts, RatioAnalysis, BudgetVsActual, InterestCalculation + NAS views + FinancialStatementChrome retoken.

**Anti-patterns forbidden:** blue comparative header bands; `[screen only]` 9px; emoji; Options trap every visit after first.

## 5.REG — Registers & books

PageHeader/ReportWorkspace + FilterBar + EnterpriseDataTable + sticky totals + quiet type chips.  
**Members:** DayBook, JournalEntries list, SalesRegister, PurchaseRegister, CashBook, BankBook, ChequeRegister, PDC*, JobWorkRegister, AuditLog, SalesReconciliation, stock summary/list reports as tables.

**Day Book columns:** DualDate · No. · What · Party · In · Out · Status · View.

## 5.LEDG — Explorers

Tree/picker + statement pane; Search; DualDate; Print/Export; keyboard footer 12px.  
**Members:** GeneralLedger+LedgerStatementView, ChartOfAccounts, PartyLedger/PartyStatement, StockLedgerReport, AccountTreeRenderer retoken.

## 5.AGING — Receivables intelligence

OR/OP/Aging: plain titles; no ⚠; Export secondary + Print; bars ≥12px; remind = secondary.

## 5.TAX — Compliance

VatReports (one shell), TdsReport, TdsCertificate, VATClassificationMaster; annex tabs; DualDate truth.

## 5.TXN — Document entry

TransactionWorkspace shell + LineItemGrid + Combobox parties/items + DualDateField + VAT/TDS groups + BalanceStrip + footer: Cancel · Print preview · Save draft · Post.  
**Members:** BillingInvoice+SalesInvoiceForm, PurchaseVoucher, Receipt/Payment/Contra, Journal form, Debit/Credit notes, DeliveryChallan, GRN, Order/Quotation pages, stock ops pages, Recurring/Reversing, VoucherEntryHub (HubCardGrid), attendance vouchers, InvoicePrint/VoucherPrint.

**Extend TransactionRouteShell** to D/C notes + orders when migrated.

## 5.MASTER — CRUD

PageHeader + Search + table + Drawer/Dialog form (PartyForm, ItemForm…).  
**Hub:** MasterControlCentre → HubCardGrid groups: People · Items · Accounts · Tax · Advanced (collapsed).

## 5.BANK — Match & wallets

BankReconciliation (quiet segmented: Bank · eSewa · Khalti · ConnectIPS — no emoji), BankStatementImport (Dropzone), ChequePrinting (no BusyShell), PDC*. Smart/Auto: wire as tabs **or** DEPRECATE (BOOK 6).

## 5.PAY — Payroll

Payroll, PayrollRun, PayHeads, Bonus, Gratuity, Employees, Loans: MASTER+TXN hybrid; payslip print atoms; calm tables.

## 5.CFG — Settings & hubs

CompanySettings, Users, ConfigurationHub, Accounts/Inventory config, Backup, DataImportExport, CommunicationHub, FiscalYear: sectioned forms; danger zones; HubCardGrid for hubs; no 10px scream headers.

## 5.PRINT — Preview surfaces

InvoicePrint, VoucherPrint, ReportPrint, cheque, payslip: white canvas, company header, DualDate, Print primary, Close secondary.

## 5.UPLOAD — Import surfaces

BankStatementImport, BackupRestore, DataExportImport, AttachmentUploader, Communication attachments: Dropzone + progress + error Banner.

## 5.HUB — Launchers

VoucherEntryHub, MasterControlCentre, ConfigurationHub, (orphans BankingHub/AdvancedReportHub → DEPRECATE or HUB): HubCardGrid; F-keys muted.

## 5.WIZ — Multi-step

SignUpWizard (keep), YearEndProcess if wired: StepProgress; one primary Next; Back secondary.

## 5.CHART — Visualization policy

| Allowed | Forbidden |
|---------|-----------|
| Home CSS ageing bars | Random recharts on every page |
| Simple bar/line with DS colours on analytics **if** page is NAV | Decorative sparklines, 3D, rainbow |
| P&L KPI tiles | BarChart2 as hero icon |

Unwired recharts pages → DEPRECATE until product asks.

## 5.ALLOC — Settlement UI

Bill allocation, MultiModePayment: Dialog/Drawer; running “Allocated Rs. X / Remaining Rs. Y”; BalanceStrip rules.

## 5.APPROVAL — Workflow (if wired later)

Maker-checker: Banner + Approve primary / Reject destructive; audit Drawer — do not ship unwired pages without NAV decision.

## 5.POS — Retail

`POSMode` / `POSBilling`: **DEPRECATE** (unwire menu links) unless product prioritizes — then new family with large touch targets. Default: quarantine.

## 5.OPS — Operator/debug

ContextInspector, F12, Nios Bench: admin-only; calm; no model strings; collapsed by default.

## 5.LEGACY_BUSY — Deprecation path

ActionToolbar→PageHeader; PillTitle/FormPanel→Surface; BusyShell consumers J2 kill list Wave 4; topbar/* → delete from runtime after shell verified.

## 5.TALLY_Q — Quarantine

`TallyVoucherPage`, `components/tally/*`, `tally-green.css`: no new imports; governance fail if imported into wired routes.

---

# BOOK 6 — Complete registries

## 6.1 Plain-language dictionary

Use Part C from v3 FINAL plan as base **plus**:

| Extra | Title | Help |
|-------|-------|------|
| bank-statement-import | Import bank statement | Load a file to match. |
| sales-register | Sales register | List of sales invoices. |
| purchase-register | Purchase register | List of purchase invoices. |
| voucher-entry | All entry types | Choose what to enter. |
| year-end (if wired) | Close the year | Year-end checklist. |
| opening-balance (if wired) | Opening balances | Starting figures. |
| pos-mode | Point of sale | **Deprecated — remove from menus** |
| e-payments | E-payments | Batch digital payments. |
| deposit-slip | Deposit slip | Bank deposit advice. |
| payment-advice | Payment advice | Advise a payment. |

Apply to `navConfig` + `CommandPalette` + PageHeader.

## 6.2 Wired route → family → wave

*(All App.tsx page components)*

| Family | Routes / pages | Wave |
|--------|----------------|------|
| SHELL | dashboard, auth stages | 1 |
| AI | orbix | 1 |
| STMT | balance-sheet, profit-loss, trial-balance, cash-flow, income-expenditure, equity-statement, funds-flow, notes-to-accounts, ratio-analysis, budget-vs-actual, interest-calculation | 2 / 5 |
| REG | day-book, journal (list), sales-register, purchase-register, cash-book, bank-book, cheque-register, pdc-*, audit-log, sales-reconciliation, stock-summary, inventory-report, sales-analysis | 2 / 3 / 5 |
| LEDG | ledger, accounts, party-statement, stock-ledger | 2 / 5 |
| AGING | outstanding-receivables, outstanding-payables, aging-report | 2 |
| TAX | vat-reports, tds-report, tds-certificate, vat-classifications | 3 |
| TXN | billing, sales-return, purchase, purchase-return, receipt, payment, contra, debit-note, credit-note, sales-order, purchase-order, quotation, delivery-challan, goods-receipt, stock-*, production, material-*, unassemble, rejection-*, job-work-*, voucher-entry, recurring-vouchers, reversing-journals, attendance-* | 3 / 5 |
| MASTER | parties, items, item-groups, warehouses, units*, ledger-master, price-lists, bill-sundry, batches, cost-centers, sales-persons, standard-narration, sale-type, purchase-type, tax-category, voucher-types, schemes, misc-masters, fiscal-year, budget, fixed-assets, master-control-centre, employees, pay-heads, employee-loans | 4 / 5 |
| BANK | bank-reconciliation, bank-statement-import, cheque-printing | 4 |
| PAY | payroll, payroll-run, bonus-provision, gratuity-calculation | 5 |
| CFG | settings, users, configuration-hub, accounts-configuration, inventory-config, backup-restore, data-export-import, communication-hub | 6 |
| PRINT/UPLOAD | via TXN/BANK/CFG parents | with parent wave |

**Any App.tsx case not listed:** stop and assign family before coding.

## 6.3 Orphan page registry (~119) — policy per file

**Default rule:** `DEPRECATE` = keep file, do not restyle, remove menu links, App default stays dashboard.  
**Promote** only with product decision → then assign family + wave.

| Policy | Examples |
|--------|----------|
| **DEPRECATE** (default) | POSMode, POSBilling, TallyVoucherPage, AdvancedReportHub, BankingHub, AuthGateway, CompanySelector duplicates, most *Master duplicates, recharts analytics islands, MakerCheckerApproval, YearEndProcess until scoped, OpeningBalance until scoped, Smart/Auto bank recon if not tabbed |
| **HUB** (reachable from Setup / Voucher hub only) | Optional advanced masters product wants |
| **NAV** | None until explicitly approved |
| **MERGE** | Quotation.tsx→QuotationPage; SalesOrder→OrderVoucherPage; AuditLogs→AuditLog; PartyStatement→PartyLedgerStatement; PhysicalStockPage→PhysicalStockPage2; FixedAssetRegister→FixedAssets |

**Implementer action Wave 6:** produce `docs/ui-redesign/UI_ORPHAN_PAGE_REGISTRY.json` with every orphan file → DEPRECATE|HUB|MERGE|NAV + notes. Until then treat all orphans as DEPRECATE.

## 6.4 Component orphan registry

| Component | Action |
|-----------|--------|
| topbar/* | Retire from runtime |
| Sidebar.tsx, BusyMenuBar, Header, Gateway (legacy) | Retire |
| WorkflowAlertsWidget, BillAllocationPanel, MultiModePayment | Wire into TXN/ALLOC Wave 3 **or** DEPRECATE |
| ReportHub, InvoiceHub | DEPRECATE or merge HUB |
| StockItems.tsx, PurchaseInvoiceForm, ReturnInvoiceForm | Dead — never edit |
| OrbixPanel (legacy) | Prefer ekhata OrbixWorkspace |
| NotificationPanel (ui) | Prefer shell NotificationCentre |
| CalculatorPanel | Optional calm Dialog |

## 6.5 BusyShell kill list (Wave 4)

ChequePrinting · CompanySettings · SalesInvoiceForm · JournalVoucherForm · TdsPayment · DepositSlip · EPayments · PaymentAdvice · PDCSummary · AutoBankReconciliation (if kept).

---

# BOOK 7 — QA, a11y, governance

## 7.1 Commands per wave

```bash
npm run ui:governance
npm run ui:ds-lab
# from Wave 2+:
npm run ui:a11y
npm run ui:baseline
npm run ui:route-smoke
```

## 7.2 A11y must-fix (baseline)

| Issue | Routes | When |
|-------|--------|------|
| select-name critical | billing, journal, bank-recon | Wave 3–4 migrate |
| color-contrast | dashboard, orbix, sales-invoice, journal, parties, balance-sheet, bank-recon | on migrate |

## 7.3 e2e expansion map

After each wave, add fixtures for that wave’s routes. Target: all **NAV** routes visually smoke-tested; PALETTE routes smoke optional.

## 7.4 Review checklist (every PR)

- [ ] Only DS + BOOK 4 composites  
- [ ] No new hex / emoji / BusyShell  
- [ ] Plain title from dictionary  
- [ ] ≥12px essential text  
- [ ] Rs. + DualDate where money/dates  
- [ ] One primary CTA per region  
- [ ] IconButtons named  
- [ ] Print/Export order if report  
- [ ] ui:governance clean  

---

# BOOK 8 — Definition of Done (100%)

## 8.1 Particle DoD

- [ ] BOOK 3 matrix states implemented on DS controls  
- [ ] BOOK 4 composites exist and used by migrated pages  
- [ ] styles.css green Radix overrides gone from DS path  
- [ ] ToastProvider app-rooted  
- [ ] DualDate/NepaliDatePicker tokenized  
- [ ] ReportWorkspace + StatementTable live  
- [ ] EnterpriseDataTable footer+pagination+row focus  

## 8.2 Surface DoD

- [ ] Every **wired** route has family + wave + plain title  
- [ ] Waves 0–6 complete for wired set  
- [ ] Orphan registry JSON committed; menus cleaned of DEPRECATE  
- [ ] topbar/BusyShell/tally not reachable in production paths  
- [ ] Falcon/Sutra/F12/Orbix calm  
- [ ] LanguageModal includes Nepali  
- [ ] bank-recon in nav  
- [ ] Zero emoji chrome on migrated + shell  
- [ ] A11y criticals closed on baseline screens  
- [ ] Migration tracker updated truthfully  

## 8.3 Explicit non-goals

- Full Nepali translation of every string (progressive after Wave 1)  
- Building POS unless product decides NAV  
- Restyling quarantined Tally into product  
- Accounting/sync logic changes  
- Claiming done after shell-only work  

---

# BOOK 9 — Auto prompt library

```text
# Wave
Implement Wave [N] from docs/ui-redesign/ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md.
Looks only. Follow BOOK 1 authority, BOOK 3 particles, BOOK 4 composites, BOOK 5 family rules.
No raw hex, no emoji, no BusyShell on touched files. Run ui:governance.

# Single page
Migrate [file] as Family [X] per BOOK 5 of ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md.
Use ReportWorkspace/LineItemGrid/Combobox as required. Looks only.

# Particle
Implement particle [name] missing specs from BOOK 3 of ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md.
```

---

# BOOK 10 — Supersession & mental model

| Doc | Role |
|-----|------|
| **This MASTER (v4)** | **Only authority for new looks work** |
| v3 FINAL / v2 Ultra | Historical; useful detail absorbed here |
| UI-0…UI-7 reports | Prior evidence |
| AGENTS.md | Behaviour safety; visual tips for **unmigrated** only |

```text
Sidebar │ Company · FY · Search · Sync · Bell · User
        │ Account totals check           [Accounts match]
        │ Debits and credits should match.
        │ DualDate period
        │              [↻] [Print] [Export ▾] [Options]
        │ Filters…                        [Show report]
        │ Dense StatementTable · Rs. tabular · calm chips
```

**Feel:** calm · clear · trustworthy · Nepal-ready · adult software · zero improvisation.

---

*End of 100% Looks Master Plan v4. Start Wave 0. Do not skip particles.*
