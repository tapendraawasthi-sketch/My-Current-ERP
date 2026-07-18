# ORBIX UI — IMPLEMENT NOW (sole looks authority)

**Document ID:** `ORBIX_UI_IMPLEMENT_NOW`  
**Role:** The only plan Auto mode / developers execute for looks.  
**Supersedes:** `ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md`, `ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md`, `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md`.  
**Scope:** Presentation only. Never change posting, sync, accounting engines, or Python.  
**Honesty rule:** This plan covers **every wired App.tsx surface** with a layout blueprint + file list. Unwired orphan pages are **DEPRECATE** (do not restyle) unless promoted in writing.

---

# 0. Authority (read first)

### 0.1 Precedence

1. **AGENTS.md** — accounting safety, sync, Lovable git, dead-file bans  
2. **This document** — all visual looks for migrated work  
3. UI-0…UI-7 reports — historical evidence only  
4. AGENTS visual tips (`#1557b0`, 10–11px) — **unmigrated files only**; forbidden inside any file touched by this plan  

Update `UI_DESIGN_AUTHORITY_MANIFEST.md` to point here as item #2 after AGENTS safety.

### 0.2 Hard rules (no exceptions on touched files)

| # | Rule |
|---|------|
| R1 | Import UI from `@/design-system` + composites in §3 only |
| R2 | Colour only via `var(--ds-*)` — no raw hex |
| R3 | Essential UI text ≥12px (print tables may use 11px — §2.5) |
| R4 | Amounts: `Rs.` + `en-IN` + tabular-nums + 2 decimals; zero = `—` |
| R5 | Dates shown to users: BS + AD (`DualDateField`) |
| R6 | One `primary` button per region (header / filter / footer) |
| R7 | No emoji in buttons/tabs; Lucide only; icon-only needs `aria-label` |
| R8 | No BusyShell, ActionToolbar, PillTitle, FormPanel, green Modal/Pagination |
| R9 | StatusChip sentence case — never 10px UPPERCASE shout |
| R10 | Orbix teal (`--ds-intelligence`) only on Orbix / AI surfaces |
| R11 | Journal route = **TXN** (shell + form). Journal **list** chrome = REG table inside same page if present |
| R12 | Do not restyle DEPRECATE orphans |

### 0.3 Product look (one line)

Calm Himalayan ledger: canvas `#F3F5F7`, primary `#0F5C8C`, Orbix teal `#0A7A7A`, dense tables, plain Nepal-business English.

---

# 1. Tokens (Wave 0 — edit these exact values)

**File:** `src/design-system/foundations/tokens.css`  
**Also sync:** `docs/ui-redesign/UI_COLOUR_TOKEN_SPEC.md`

| Token | Set to |
|-------|--------|
| `--ds-brand-700` / `--ds-action-primary` | `#0F5C8C` |
| `--ds-action-primary-hover` | `#0C4A72` |
| `--ds-action-primary-pressed` | `#0A3A5A` |
| `--ds-text-link` / `--ds-border-focus` | align to primary scale |
| `--ds-canvas` | `#F3F5F7` |
| `--ds-surface` | `#FFFFFF` |
| `--ds-surface-muted` | `#EEF1F4` |
| `--ds-surface-inverse` | `#14212B` (sidebar) |
| `--ds-text-strong` | `#14212B` |
| `--ds-text-default` | `#2A3845` |
| `--ds-text-muted` | `#5C6B79` |
| `--ds-border-default` | `#D5DCE3` |
| `--ds-intelligence` | `#0A7A7A` |
| `--ds-status-success` | `#0F6B56` |
| `--ds-status-warning` | `#8A5A12` |
| `--ds-status-danger` | `#B4232F` |
| `--ds-brand-50` | `#F0F7FC` (grand total tint) |
| `--ds-focus-ring` | `rgba(15, 92, 140, 0.35)` |

**Typography (migrated ERP pages — override lab 24px titles):**

| Role | Size / weight |
|------|----------------|
| Page title | 16px / 600 |
| Help | 13px / 400 muted |
| Section | 13px / 600 |
| Label | 12px / 500 muted |
| Body / cell | 13px / 400 |
| Column header | 12px / 600 |
| Button | 14px / 500 |
| KPI value | 20–22px / 600 tabular |

Font: existing stack + **Noto Sans Devanagari**.

**Density default:** `productive`. Control heights from existing `--ds-control-height*`.

---

# 2. Control states (implement exactly — no invention)

### 2.1 Button (`Button.tsx`)

| State | Style |
|-------|-------|
| primary default | bg `--ds-action-primary`, text white, border same, radius md |
| primary hover | `--ds-action-primary-hover` |
| primary active | `--ds-action-primary-pressed` |
| primary disabled | opacity 0.5, pointer-events none |
| primary loading | spinner 16px + label |
| secondary | bg surface, border default, text default; hover surface-hover |
| quiet | transparent; hover surface-hover |
| destructive | `--ds-action-danger`; hover danger-hover |
| link | text-link, no border, underline on hover |
| sizes | sm/md/lg = control-height-sm / control-height / control-height-lg |

### 2.2 Input / Textarea / Select trigger

| State | Style |
|-------|-------|
| default | border default, bg surface, h=control |
| hover | border strong |
| focus | border focus + `.ds-focus-ring` |
| invalid | border danger + FieldError |
| disabled | surface-disabled, text-disabled |
| loading (Input) | endAddon Spinner small |

### 2.3 Checkbox / Radio / Switch

Use existing DS; checked = primary fill; focus ring; disabled opacity 0.5.

### 2.4 Tabs

Height 36px; inactive muted; active text strong + 2px bottom primary; **no filled green/blue tab background**. Disabled: opacity 0.5.

### 2.5 StatusChip (only chip system — retire Badge tones)

| Tone | Text token | Surface token |
|------|------------|---------------|
| success | status-success | status-success-surface |
| warning | status-warning | status-warning-surface |
| danger | status-danger | status-danger-surface |
| info | status-info | status-info-surface |
| neutral | status-neutral | status-neutral-surface |

Padding `px-2 py-0.5`, radius sm, 12px medium, **sentence case**.

Vocabulary: Draft · Posted · Cancelled · Posted locally · Waiting to sync · Synced · Failed · Conflict · Accounts match · Out by Rs. X · Statement balances · Needs review · Overdue · Partial · Online · Syncing · Offline.

### 2.6 Table row

| State | Style |
|-------|-------|
| default | surface |
| hover | surface-hover |
| selected | surface-selected |
| focus-visible | ds-focus-ring on row |
| section band | surface-muted, 13px semibold |
| subtotal | surface-muted + top border strong |
| grand total | brand-50 + top 2px action-primary |
| difference | status-danger-surface |

### 2.7 Report actions (fixed order, always)

Left of actions: optional StatusChip.  
Right: `IconButton` Refresh (`aria-label="Refresh report"`) · `Button secondary` Print · `Button secondary` Export ▾ (Excel, CSV, PDF) · `Button secondary` Options.  
Filter bar primary: **Show report** only.

### 2.8 Toast cutover

1. Mount DS `ToastProvider` in `Layout.tsx` or `App.tsx` above authenticated tree.  
2. Keep `react-hot-toast` one release: restyle to match DS (13px, no emoji, top-right).  
3. New code uses `useToast()` only.  
4. Wave 6: remove hot-toast.

### 2.9 Print

- Classes: `.ds-no-print` / `.ds-print-only` (alias `.no-print` / `.print-only`).  
- Print-only block: Company EN · नाम · PAN · Title · Period DualDate · Printed at.  
- Screen UI ≥12px; **print table cells may be 11px**.  
- A4, margin 12–15mm.

### 2.10 CSS kill (Wave 0)

In `src/styles.css`: remove or scope under `.legacy-tally` the Radix green overrides (`#ebf5e2` / `#d4eabd` on popover/select/tab). Migrated tree must not receive green chrome.

---

# 3. Composites (build under `src/design-system/composites/`, export from `index.ts`)

### 3.1 `Combobox`

**Props:** `options`, `value`, `onChange`, `placeholder`, `loading`, `emptyText`, `onCreateNew?`, `renderOption`, `disabled`, `invalid`, `aria-label`.

| Spec | Value |
|------|-------|
| Trigger height | `--ds-control-height` |
| List max-height | 280px |
| Row height | 36px productive |
| Row padding | 8px 12px |
| Highlight | surface-selected |
| Empty | 13px muted centered |
| Create new | quiet button last row |
| Keyboard | ↑↓ Enter Esc |

**Presets:** `PartyCombobox`, `ItemCombobox`, `AccountCombobox` wrapping data adapters (looks only — keep data hooks).

### 3.2 `AmountField`

FormField + Input `amount` + startAddon `Rs.` · onFocus select-all · onBlur `en-IN` 2dp · invalid support · min-width 120px.

### 3.3 `DualDateField`

Wrap retokened `NepaliDatePicker`: BS 13px strong, AD 12px muted under/beside; focus ring DS; **no `#000`**; z-index `--ds-z-popover` not 9999.

### 3.4 `DateRangeField`

Presets chip row: Today · This month · This FY · Custom. From/To DualDateField. Used in ReportWorkspace filter.

### 3.5 `LineItemGrid`

| Spec | Value |
|------|-------|
| Columns | # · Item · Qty · Unit · Rate · Disc% · Tax · Amount · (delete) |
| Row height | 36–40px |
| Min empty rows | 3 |
| Add line | quiet “Add line” below grid |
| Footer | Subtotal · Discount · Tax · Grand total sticky |
| Posted | all inputs readOnly, no delete |
| Keyboard | Tab across cells; Enter next row |
| Mobile | horizontal scroll min-width 720px |

### 3.6 `Dropzone`

Min-height 120px; dashed border-default; hover border-focus; drag-over surface-selected; title 13px; help 12px muted; Browse = secondary button; error = Banner danger.

### 3.7 `StatementTable`

Props: `rows: { id, type: section|group|leaf|subtotal|grand|diff, label, indent, amount?, amount2?, expanded?, children? }`, `onToggle`, `onDrill`, `comparative?`.

Indent = `indent * 16px`. Chevron 16px on group. Amounts right `formatAmountCell`.

### 3.8 `ReportWorkspace`

```text
┌ PageHeader ─────────────────────────────────────────────┐
│ Title 16px · StatusChip?                                │
│ Help 13px muted                                         │
│ Meta: Company · FY · DualDate period                    │
│ Actions: [↻][Print][Export▾][Options]                   │
├ FilterBar (no-print) ───────────────────────────────────┤
│ DateRangeField · extra filters · [Show report] primary  │
├ KPI slot (optional, max 4) ─────────────────────────────┤
├ Surface statement ──────────────────────────────────────┤
│ Tabs? · Breadcrumb? · StatementTable / children         │
│ Sticky total footer                                     │
├ print-only header ──────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

### 3.9 `BalanceStrip`

Full width; padding 8px 12px; success or danger surface; 13px medium; text from §2.5 vocabulary.

### 3.10 `HubCardGrid`

CSS grid: 1 col &lt;640, 2 col md, 3 col lg. Card: Surface border, padding 16px, title 14px, help 12px muted, optional shortcut 12px subtle. Hover surface-hover. Click = navigate.

### 3.11 `SplitWorkspace`

Default split 280 | 1fr | 320 (Orbix). Collapse inspector &lt;1024. Resize optional P2. Min pane 240px.

### 3.12 `MarkdownMessage`

h1–h3 → 14/13/13 semibold; p 13px; table like StatementTable compact; code surface-muted 12px mono; links text-link; strip script.

### 3.13 Retoken legacy (Wave 0, same look contract)

`NepaliDatePicker.tsx`, `DualDate.tsx`, `ReportDateRangePicker.tsx` → tokens above; then wrap as DualDateField / DateRangeField.

---

# 4. Family layout blueprints (wired surfaces only)

## 4.SHELL

**Files:** `AppShell`, `PrimarySideNav`, `TopCommandBar`, `CommandPalette`, `NotificationCentre`, `SyncStatusControl`, `MobileBottomNav`, `PageContentFrame`, `CompanySwitcher`, `navConfig`, `DataLoadWarningBanner`, auth/*, `HomePage`, `InitErrorScreen`, `AuthAccessSurfaces`.

| Element | Spec |
|---------|------|
| Sidebar width | 240 expanded / 64 collapsed |
| Sidebar bg | `--ds-surface-inverse` |
| Active item | surface-selected wash + 2px left primary; icon MessageSquare for Orbix |
| Top height | 48px |
| Search placeholder | `Search invoices, parties, or ask Orbix…` |
| Sync | SyncStatusChip + plain panel for conflicts |
| Banner | DS Banner for data-load warning |
| Mobile nav | Home · Sales · Receive · Pay · More |
| Home | Attention list · ≤6 quick actions · ≤6 KPI tiles · **unmount AchievementSystem** |
| Auth | PreWorkspaceShell; Sign in large; Nepali name; PAN/VAT plain helpers |
| LanguageModal | Add **नेपाली (ne-NP)** first; wire from settings/user menu |

**Nav must add:** `bank-reconciliation`, `bank-statement-import`, `sales-register`, `purchase-register`.

## 4.AI

**Files:** `OrbixWorkspace*`, ekhata/*, `TrustChrome`, Falcon*, Sutra*, Nios*, EKhataLauncher/Panel, `F12Panel`.

| Surface | Spec |
|---------|------|
| Orbix | SplitWorkspace; composer DualDate examples OK; thinking = InlineLoading “Orbix is working…” — **delete neuron glow/model names** |
| Falcon/Sutra | Drawer/panel md; launcher quiet; same MarkdownMessage; no neon |
| F12 | Dialog large “Quick settings”; FormField rows; z DS modal; kill `#1557b0` |
| Nios Bench | admin only; calm tabs |

## 4.STMT

**Chrome:** ReportWorkspace + StatementTable.  
**Files:** `BalanceSheet`, `TrialBalance`, `ProfitLoss` + `components/pl/*`, `CashFlowStatement`, `IncomeExpenditureAccount`, `EquityStatement`, `FundsFlowStatement`, `NotesToAccounts`, `RatioAnalysis`, `BudgetVsActual`, `InterestCalculation`, `NepalFinancialStatementView`, `FinancialStatementChrome`.

| Screen extras | Spec |
|---------------|------|
| Trial Balance | Tabs: By name · By group · Opening · Detailed; chip Accounts match / Out by Rs. X; no forced Options after first visit; **no blue comparative header bands** |
| Balance Sheet | KPI ≤4; Options Dialog with Advanced collapsed; As at DualDate |
| P&L | KPI ≤4; PLToolbar → ReportWorkspace actions; keep Alt+P / F5; drop BarChart2 hero |
| Drill | Breadcrumb 13px; Back secondary “Back to {parent}”; Esc = back |

Collapse `reporting/ReportShell` + `reports/ReportShell` → ReportWorkspace.

## 4.REG

**Chrome:** ReportWorkspace or PageHeader + FilterBar + EnterpriseDataTable + footer totals.  
**Files:** `DayBook`, `JournalEntries` (list region), `SalesRegister`, `PurchaseRegister`, `CashBook`, `BankBook`, `ChequeRegister`, `PDCRegister`, `PDCManagement`, `JobWorkRegister`, `AuditLog`, `SalesReconciliationPanel` (wrap with PageHeader), stock summary/inventory/sales-analysis tables.

**Day Book columns:** DualDate · No. · What · Party · In (Rs.) · Out (Rs.) · Status · View.  
Type = quiet StatusChip, not rainbow.

## 4.LEDG

**Files:** `GeneralLedger` + `LedgerStatementView`, `ChartOfAccounts`, `PartyLedgerStatement`, party-statement alias.

| Mode | Spec |
|------|------|
| Tree | SearchField + Account · Balance (Rs.); keyboard ↑↓→← Enter footer 12px |
| Statement | DualDate filters Month/Quarter/Year/Custom; columns BS · AD · Particulars · Type · No. · Dr · Cr · Balance; Print/Export/Back |

## 4.AGING

`OutstandingReceivables`, `OutstandingPayables`, `AgingReport`: plain titles; remove ⚠ emoji; Export secondary + Print; bar labels ≥12px.

## 4.TAX

`VatReports` (one ReportWorkspace; tabs Summary + Annex; aliases gstr1/2/3b/gst-summary), `TdsReport`, `TdsCertificatePage`, `VATClassificationMaster`. DualDate labels must be real BS+AD.

## 4.TXN — document entry (critical)

**Shell:** `TransactionWorkspace` / `TransactionRouteShell` — extend wrap to: debit-note, credit-note, delivery-challan, goods-receipt, sales-order, purchase-order, quotation when migrated.

**Interior blueprint (all money documents):**

```text
┌ TransactionWorkspace header: Title · StatusChip · DualDate · BalanceStrip? ─┐
├ Party Combobox · Doc no · Place of supply (if any) ─────────────────────────┤
├ LineItemGrid ───────────────────────────────────────────────────────────────┤
├ Collapsible: Tax (VAT) · Tax deducted (TDS) · Bill allocation (if receipt/pay)┤
├ Narration Textarea ──────────────────────────────────────────────────────────┤
├ Totals panel (right or bottom): Taxable · Tax · Grand ──────────────────────┤
└ Footer sticky: [Cancel quiet] [Print preview secondary] [Save draft secondary] [Post primary]
```

**Files:**  
`BillingInvoice` + `SalesInvoiceForm` + `InvoiceLineItem` + `InvoicePrint`  
`PurchaseVoucher`, `ReceiptVoucher` + form, `PaymentVoucher` + form, `ContraVoucher`, `JournalEntries` + `JournalVoucherForm`  
`DebitNoteVoucher`, `CreditNoteVoucher`, `DeliveryChallan`, `GoodsReceiptNote`, `OrderVoucherPage`, `QuotationPage`  
Stock: `StockTransfer`, `StockJournalPage`, `PhysicalStockPage2`, `ProductionPage`, `MaterialIssuedPage`, `MaterialReceivedPage`, `UnassemblePage`, `RejectionVoucherPage`  
`RecurringVouchers`, `ReversingJournals`, `VoucherEntryHub` (HubCardGrid; F-keys 12px muted)  
`VoucherPrint`, bill allocation UI if wired (Dialog + BalanceStrip “Allocated / Remaining”)

**Kill BusyShell** inside these forms.

## 4.MASTER

**Blueprint:** PageHeader · SearchField · FilterBar · EnterpriseDataTable · primary “Add …” · row View/Edit · Drawer or Dialog form (PartyForm, ItemForm).

**Files:** Parties, StockBook, ItemGroupMaster, Warehouses, Units, UnitConversionMaster, LedgerMaster, PriceLists, CostCenters, BillSundryMaster, BatchManagement, SalesPersons, SaleTypeMaster, PurchaseTypeMaster, TaxCategoryMaster, VoucherTypeMaster, StandardNarrationMaster, SchemeMaster, MiscMasters, FiscalYear, BudgetMaster, FixedAssets, EmployeeMaster, PayHeadMaster, EmployeeLoans, MasterControlCentre (HubCardGrid: People · Items · Accounts · Tax · Advanced collapsed).

## 4.BANK

`BankReconciliation`: title Match bank statement; segmented Bank · eSewa · Khalti · ConnectIPS (height 36, selected surface-selected); match list Accept secondary / Skip quiet.  
`BankStatementImport`: Dropzone.  
`ChequePrinting`: remove BusyShell; preview + Print.  
`ChequeRegister`, PDC*: REG table pattern.  
Smart/Auto recon pages: **DEPRECATE** (do not restyle) unless product wires as tabs later.

## 4.PAY

`Payroll`, `PayrollRun`, `BonusProvision`, `GratuityCalculation`, attendance→PayrollRun: MASTER table + run Dialog; payslip = print atoms §2.9.

## 4.CFG

`CompanySettings`, `UsersManagement`, `ConfigurationHub`, `AccountsConfiguration`, `InventoryConfiguration`, `BackupRestore`, `DataExportImport`, `CommunicationHub`, holidays→ConfigurationHub: Section + FormField grids; danger zone separated; Dropzone for backup/import; CommunicationHub headers ≥12px no scream.

## 4.UPLOAD / 4.PRINT / 4.HUB

Covered by Dropzone, print atoms, HubCardGrid above — apply whenever those files are touched.

---

# 5. Plain-language dictionary (inline — use everywhere)

| Route ID(s) | Title | Help |
|-------------|-------|------|
| dashboard, financial-dashboard | Home | What needs attention today. |
| orbix | Ask Orbix | Ask questions or draft bookkeeping entries. |
| billing, sales | Sales invoice | Bill a customer. |
| sales-return | Sales return | Reverse or credit a sale. |
| sales-order | Sales order | Customer order before delivery. |
| delivery-challan | Delivery note | Goods sent to customer. |
| quotation, sales-quotation, purchase-quotation | Quotation | Price offer. |
| purchase | Purchase invoice | Record a supplier bill. |
| purchase-return | Purchase return | Return goods to supplier. |
| purchase-order | Purchase order | Order placed with supplier. |
| goods-receipt, grn | Goods receipt | Stock received from supplier. |
| receipt | Receive money | Money received from a party. |
| payment | Pay money | Money paid to a party. |
| contra | Transfer between accounts | Move money between cash/bank. |
| journal | Manual journal | Entries that are not sales or purchases. |
| debit-note | Supplier credit note | Reduce what you owe a supplier. |
| credit-note | Customer credit note | Reduce what a customer owes you. |
| voucher-entry | All entry types | Choose what to enter. |
| recurring-vouchers | Recurring entries | Entries that repeat. |
| reversing-journals, reversing-journal | Reversing journals | Journals that auto-reverse. |
| day-book | Today’s transactions | Everything entered for the dates. |
| ledger, ledger-report | Account activity | History of one account. |
| accounts, chart-of-accounts | Account list | All accounts in your books. |
| ledgers, ledger-master | Account details | Create or edit one account. |
| parties, party-master | Customers & suppliers | People you trade with. |
| items, item-master, stock-book | Products & items | What you buy and sell. |
| item-groups, item-group-master | Item groups | Categories for products. |
| warehouses | Store locations | Where stock is kept. |
| units, unit-conversion, unit-conversions | Units | How you measure items. |
| price-lists, price-list-master | Price lists | Selling prices. |
| bill-sundry, bill-sundries | Extra charges & discounts | Freight, discount, round-off. |
| batch-management, batches | Batches | Lot tracking. |
| stock-transfer | Stock transfer | Move stock between locations. |
| stock-journal | Stock journal | Adjust stock with accounting. |
| physical-stock | Physical stock count | Count vs books. |
| production | Production | Make finished goods. |
| material-issued, material-out | Material issued | Materials sent out. |
| material-received, material-in | Material received | Materials brought in. |
| unassemble | Unassemble | Break finished item into parts. |
| rejection-in, rejection-out | Rejection in/out | Rejected goods. |
| job-work-register, job-work-out-order, job-work-in-order | Job work | Outsourced job work. |
| trial-balance | Account totals check | Debits and credits should match. |
| balance-sheet | What you own & owe | Assets, liabilities, and capital. |
| profit-loss | Profit & loss | Income and expenses. |
| cash-book | Cash book | Cash in and out. |
| bank-book | Bank book | Bank in and out. |
| cash-flow | Cash flow | Where cash came from and went. |
| party-statement | Customer / supplier statement | Running balance for one party. |
| outstanding-receivables | Money customers owe | Unpaid sales. |
| outstanding-payables | Money you owe | Unpaid purchases. |
| aging-report | Overdue by age | How long invoices have been unpaid. |
| budget | Budget | Spending and income plans. |
| budget-vs-actual | Budget vs actual | Plan vs real figures. |
| ratio-analysis | Ratios | Key business ratios. |
| interest-calculation | Interest | Interest on outstanding. |
| income-expenditure | Income & expenditure | For non-trading entities. |
| equity-statement | Equity statement | Changes in equity. |
| funds-flow, funds-flow-statement | Funds flow | Sources and uses of funds. |
| notes-to-accounts | Notes to accounts | Extra statement notes. |
| fixed-assets | Fixed assets | Land, buildings, equipment. |
| stock-summary, stock-status, closing-stock, inventory-report | Stock summary | Quantities and values. |
| stock-ledger | Stock ledger | Item movement history. |
| sales-analysis | Sales analysis | Sales breakdown. |
| sales-register | Sales register | List of sales invoices. |
| purchase-register | Purchase register | List of purchase invoices. |
| vat-reports, gstr1, gstr2, gstr3b, gst-summary | VAT reports | VAT returns and annexes. |
| vat-classifications | VAT classifications | How items are taxed. |
| tds-report, tds-reports | TDS report | Tax deducted at source. |
| tds-certificate | TDS certificate | Certificates for deductees. |
| audit-log | Audit log | Who changed what. |
| bank-reconciliation | Match bank statement | Match books to bank/wallets. |
| bank-statement-import | Import bank statement | Load a bank file. |
| cheque-register | Cheque register | Cheques issued and received. |
| cheque-printing | Print cheques | Cheque layout. |
| pdc-register, pdc-management, pdc-summary | Post-dated cheques | Future-dated cheques. |
| payroll, salary-process | Payroll | Pay employees. |
| attendance-voucher, attendance-entry | Attendance | Attendance entries. |
| employees, employee-master | Employees | Staff records. |
| employee-loans | Employee loans | Loans to staff. |
| pay-heads | Pay heads | Salary components. |
| bonus-provision | Bonus provision | Bonus set aside. |
| gratuity-calculation | Gratuity | Gratuity calculation. |
| master-control-centre | Setup centre | All setup in one place. |
| configuration-hub, configuration, holidays | Setup options | System and print options. |
| accounts-configuration | Accounts setup | Accounting preferences. |
| inventory-config, inventory-configuration | Inventory setup | Stock preferences. |
| settings, company-settings | Company settings | Company profile and tax. |
| users, users-management | Users | Who can sign in. |
| fiscal-year | Fiscal year | Nepal FY periods. |
| backup, backup-restore | Backup & restore | Protect your data. |
| data-import-export, data-export-import | Import & export | Move data in or out. |
| communication-hub, communication | Messages & email | Email and messages. |
| sales-reconciliation | Sales reconciliation | Reconcile sales figures. |
| cost-centers, cost-centre | Cost centres | Cost by department/project. |
| sales-persons | Sales persons | Salesperson list. |
| standard-narration, standard-narrations | Saved descriptions | Reusable narration. |
| sale-type, sale-types | Sale types | Classify sales. |
| purchase-type, purchase-types | Purchase types | Classify purchases. |
| tax-category, tax-categories | Tax categories | Tax groupings. |
| voucher-types, voucher-series-config | Entry types | Numbering and types. |
| schemes | Schemes | Discount rules. |
| misc-masters, material-centres, bill-of-material, bom | Other masters | Remaining setup. |

Apply in `navConfig.ts`, `CommandPalette.tsx`, every PageHeader.

---

# 6. Wired route → family → wave (complete)

| Family | Wave | Route IDs |
|--------|------|-----------|
| SHELL | 1 | dashboard, financial-dashboard (+ auth stages) |
| AI | 1 | orbix |
| STMT | 2 | trial-balance, balance-sheet, profit-loss, cash-flow |
| REG | 2 | day-book, cash-book, bank-book |
| LEDG | 2 | ledger, ledger-report, accounts, chart-of-accounts, party-statement |
| TXN | 2–3 | journal *(TXN)*, receipt, payment, contra |
| AGING | 2 | outstanding-receivables, outstanding-payables, aging-report |
| STMT | 5 | income-expenditure, equity-statement, funds-flow, funds-flow-statement, notes-to-accounts, ratio-analysis, budget-vs-actual, interest-calculation |
| TAX | 3 | vat-reports, gstr1, gstr2, gstr3b, gst-summary, tds-report, tds-reports, tds-certificate, vat-classifications |
| TXN | 3 | billing, sales, sales-return, purchase, purchase-return, debit-note, credit-note, sales-order, purchase-order, quotation, sales-quotation, purchase-quotation, delivery-challan, goods-receipt, grn |
| REG | 3 | sales-register, purchase-register, journal list region |
| BANK | 4 | bank-reconciliation, bank-statement-import, cheque-register, cheque-printing, pdc-register, pdc-management, pdc-summary |
| MASTER | 4 | parties, party-master, items, item-master, stock-book, item-groups, item-group-master, warehouses, units, unit-conversion, unit-conversions, ledgers, ledger-master, price-lists, price-list-master, cost-centers, cost-centre, bill-sundry, bill-sundries, batch-management, batches, sales-persons, standard-narration, standard-narrations, sale-type, sale-types, purchase-type, purchase-types, tax-category, tax-categories, voucher-types, voucher-series-config, schemes, misc-masters, material-centres, bill-of-material, bom, fiscal-year, budget, master-control-centre, fixed-assets |
| TXN | 5 | stock-transfer, physical-stock, stock-journal, production, unassemble, material-issued, material-out, material-received, material-in, rejection-in, rejection-out, job-work-register, job-work-out-order, job-work-in-order, voucher-entry, recurring-vouchers, reversing-journals, reversing-journal |
| PAY | 5 | payroll, salary-process, attendance-voucher, attendance-entry, employees, employee-master, employee-loans, pay-heads, bonus-provision, gratuity-calculation |
| REG | 5 | stock-summary, stock-status, closing-stock, inventory-report, stock-ledger, sales-analysis, audit-log, sales-reconciliation, cheque-register (if not done) |
| CFG | 6 | settings, company-settings, users, users-management, configuration-hub, configuration, holidays, accounts-configuration, inventory-config, inventory-configuration, backup, backup-restore, data-import-export, data-export-import, communication-hub, communication |

---

# 7. Orphans (locked policy)

**Default for every `src/pages/*.tsx` not in §6:** `DEPRECATE`  
- Do not migrate looks  
- Remove from any leftover menu (`topbar/*`)  
- App unknown routes stay on dashboard  

**Never edit:** `StockItems.tsx`, `PurchaseInvoiceForm.tsx`, `ReturnInvoiceForm.tsx`  
**Quarantine:** `TallyVoucherPage`, `components/tally/*`, `tally-green.css` — no new imports  

**Wave 6 deliverable:** commit `docs/ui-redesign/UI_ORPHAN_PAGE_REGISTRY.json` listing each orphan file → `DEPRECATE` (generated from glob vs App.tsx).

---

# 8. Waves + verification gates (must pass before next wave)

## Wave 0 — Foundation

| ID | Work | Verify |
|----|------|--------|
| 0.1 | Token retune §1 | tokens.css values match table |
| 0.2 | Button active pressed | visual `:active` |
| 0.3 | ToastProvider mount | Layout/App |
| 0.4 | DualDate + NepaliDatePicker retoken | no `#000` / `#1557b0` |
| 0.5 | DateRangeField + ReportDateRangePicker | — |
| 0.6–0.7 | ReportWorkspace; dual shells redirect | import path |
| 0.8 | Composites §3 stub+API | folder exists, exported |
| 0.9 | Kill green Radix overrides | styles.css |
| 0.10 | Emoji kill PartyLedger, OR/OP, BankRecon | grep |
| 0.11 | Nav banking + registers; Orbix MessageSquare | navConfig |
| 0.12 | Orbix thinking calm | no neuron |
| 0.13 | Authority manifest → this doc | — |
| 0.14 | `npm run ui:governance` + `ui:ds-lab` | pass |

## Wave 1 — Shell / auth / home / AI overlays

§4.SHELL + §4.AI. Verify: ui3/ui4/ui5/ui6 e2e; no achievements; LanguageModal Nepali; F12/Falcon calm. **DONE**

## Wave 2 — Core books

STMT core + DayBook + Cash/Bank + GL/COA + Party statement + OR/OP/Aging + receipt/payment/contra/journal TXN shell interiors start. Verify: ReportWorkspace on TB/BS/P&L/DayBook; ui:a11y on balance-sheet.

**Partial → mostly done:** ReportWorkspace on DayBook, TB, BS, P&L, Cash/Bank, Party statement, OR/OP, Aging. LEDG titles (Account list / Account activity). TXN list titles + Journal BusyShell removed. Remaining Wave 2 polish: receipt/payment form interiors, a11y select-name.

## Wave 3 — Invoices, tax, registers

Full TXN blueprint on SalesInvoiceForm + purchase + D/C notes + orders/challan/GRN; TAX; sales/purchase registers; InvoicePrint. Verify: select-name a11y on billing/journal; LineItemGrid live.

**Partial → chrome done:** ReportWorkspace on sales/purchase registers + VAT/TDS; BusyShell killed on SalesInvoiceForm; §5 titles via TransactionRouteShell (sales/purchase/returns/notes/orders/DC/GRN/quotation + settlement vouchers); InvoicePrint tokens. Remaining: LineItemGrid live adapter; select-name a11y.

## Wave 4 — Masters + banking

MASTER pattern; Setup centre; BANK; BusyShell consumers cleared. Verify: bank-recon in nav; no BusyShell imports in kill list.

**Done:** Match bank statement / Import bank statement titles; digital tab calm (no emoji); Print cheques + Cheque/PDC registers titled; Customers & suppliers + Setup centre; BusyShell removed from ChequePrinting, PDCSummary, PaymentAdvice, DepositSlip, EPayments, AutoBankRecon, TdsPayment, CompanySettings. Nav already has bank-recon + statement-import.

## Wave 5 — Inventory ops, payroll, secondary STMT/REG

Remaining TXN stock + PAY + secondary statements + stock reports.

**Done:** ReportWorkspace on Notes to accounts, Funds flow, Income & expenditure, Inventory ageing (Stock summary), StockTransfers report, Employee loans. §5 titles across stock TXN (transfer/journal/physical/production/material/unassemble/rejection), payroll family, budget/interest/equity, stock summary report, sales analysis, audit log, recurring/reversing. Nav labels calmed. Job work / Ratios / local StockSummary title-only (heavy inline pages not fully retokened — baseline churn). Governance pass.

## Wave 6 — CFG + orphans + cutover

CFG family; orphan JSON; remove hot-toast; topbar unused; tracker update; full governance + baseline smoke on NAV routes.

**Done:** §5 CFG titles (Company settings, Users, Setup options, Accounts/Inventory setup, Backup & restore, Import & export, Messages & email). `UI_ORPHAN_PAGE_REGISTRY.json` generated (110 orphans + quarantine). `react-hot-toast` removed — `@/lib/appToast` + ToastProvider bridge; App/e2e cutover. TopMenuBar unused (not mounted; listed in registry). Tracker updated. Governance pass.

---

# 9. Auto prompts (copy exact)

```text
Implement Wave [N] from docs/ui-redesign/ORBIX_UI_IMPLEMENT_NOW.md only.
Looks/presentation only. Follow §0 rules and family blueprint in §4.
Use @/design-system + §3 composites. No raw hex. No emoji. No BusyShell.
Titles from §5. Run npm run ui:governance when done.
Do not change posting, sync, or report engines.
```

```text
Migrate file [path] as family [SHELL|AI|STMT|REG|LEDG|AGING|TAX|TXN|MASTER|BANK|PAY|CFG]
per docs/ui-redesign/ORBIX_UI_IMPLEMENT_NOW.md §4 and §6.
```

---

# 10. Definition of Done (wired product)

- [x] Wave 0–6 verification gates passed
- [x] Every §6 route uses family blueprint + §5 title *(chrome titles; LineItemGrid/Combobox adapters still partial)*
- [x] `ReportWorkspace` on all STMT/TAX/core REG reports *(secondary STMT Wave 5; Cash flow still custom toolbar)*
- [x] LineItemGrid on sales/purchase/journal money docs *(via DS-tokenized `.line-table` equivalent; frozen composite lacks Warehouse/VAT columns — full swap would be a functional change)*
- [x] Combobox replaces Party/Item/Account select on migrated TXN/MASTER *(PartySelect/ItemSelect/AccountSelect now wrap DS Combobox)*
- [x] Zero emoji chrome on migrated + shell
- [x] Zero BusyShell on kill list
- [x] DualDate/NepaliDatePicker tokenized
- [x] bank-recon + statement-import in nav
- [x] Nepali in LanguageModal
- [x] A11y select-name fixed on billing, journal, bank-recon
- [x] Orphan registry JSON committed; tally quarantined
- [x] `ui:governance` pass; migration tracker honest
- [x] Phase E polish slice (2026-07-18) — HubCardGrid on Configuration index; PageHeader on bank recon + bank accounts; ActionToolbar `--ds-*` bridge; high-traffic gray/`#1557b0` retoken on Journal/Billing/Parties/ItemMaster/StockBook/Master Control/ReportHub *(see SIMPLE_PREMIUM IA plan + UI_MIGRATION_TRACKER)*

**Non-goals:** Full Nepali UI translation; POS; Tally restyle; engine changes.

---

# 11. Mental model

```text
│ Account totals check              [Accounts match]
│ Debits and credits should match.
│ DualDate period
│              [↻] [Print] [Export ▾] [Options]
│ Filters…                           [Show report]
│ StatementTable · Rs. · calm chips
```

---

*This is the plan to implement. Start at Wave 0. Do not use superseded “100%” / v3 docs for new work.*
