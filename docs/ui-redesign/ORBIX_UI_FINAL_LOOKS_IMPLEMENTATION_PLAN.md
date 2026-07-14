# ORBIX ERP — Final Looks Implementation Plan (v3 COMPLETE)

> **SUPERSEDED.** Implement from **[`ORBIX_UI_IMPLEMENT_NOW.md`](./ORBIX_UI_IMPLEMENT_NOW.md)** only.

**Status:** SUPERSEDED by v4 MASTER — previously superseded `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md` v1/v2.  
**Scope:** Presentation / looks only. No posting, sync, accounting engines, or Python authority changes.  
**Audited:** 2026-07-14 against `App.tsx` (156 authenticated routes), `UI_ROUTE_INVENTORY`, design-system adoption, a11y/style baselines, BusyShell/tally-green/emoji/hex debt.  
**Goal:** Zero intentional omission — every wired surface has a family template + acceptance rules Auto mode can execute.

---

## PART A — Audit verdict (read before coding)

### A1. Current truth (do not claim “UI redesign done”)

| Area | Reality |
|------|---------|
| Design system API | Complete in labs (`@/design-system`) |
| Shell / auth / home / Orbix | Migrated to `--ds-*` (UI-3…UI-6) |
| Transaction shells (7 routes) | Wrapper migrated (UI-7); **form interiors still legacy** |
| `src/pages/**` importing `@/design-system` | **0 files** |
| Pages with `#1557b0` | ~168 / ~214 |
| Pages with `@ts-nocheck` | ~118 / ~214 |
| Routes with §7 micro-spec in v2 plan | ~11 report families (~15%) |
| Wired production OMITTED or NAMED-only | ~65–85% |
| Orphan routes (no nav) | 92 |
| A11y baseline open | 10 violations (3 critical `select-name`) |
| Density toggle | Shell only — pages ignore it |
| LanguageModal | Unwired; **no Nepali** option |
| Dual ReportShell | Still duplicated |
| BusyShell consumers | ≥10 files |
| tally-green | `TallyVoucherPage.tsx` (unwired) |
| Emoji chrome | Party ledger, bank recon tab, OR/OP, etc. |
| AI overlays beyond Orbix | Falcon, Sutra, Nios, F12 — **unspec’d in v2** |

**Safe claim today:** *Shell, auth, home, and Orbix are DS-ready. Statements, masters, banking, payroll, registers, and voucher interiors are not.*

### A2. Problems remaining (full catalogue)

| ID | Problem | Impact | Fix locus |
|----|---------|--------|-----------|
| R01 | Dual visual systems (AGENTS hex vs `--ds-*`) | Inconsistent premium feel | Authority §B1 + migrate on touch |
| R02 | Zero page-level DS adoption | Plan exists, product doesn’t match | Phase 0 blockers + every page touch |
| R03 | DualDate / NepaliDatePicker hex + 9–11px | Blocks every voucher/report | Phase 0 |
| R04 | No ReportWorkspace | Every report reinvents toolbar | Phase 0 |
| R05 | Dual ReportShell + BusyShell + ui/Button | Drift forever | Phase 0 + kill list |
| R06 | Emoji / dummy AI chrome | Cheap look | Kill list Phase 0–1 |
| R07 | Plain-language only on ~20 titles | Non-accountants lost | §C dictionary + palette |
| R08 | 92 orphan routes | Undiscoverable UX | §E nav policy |
| R09 | bank-reconciliation missing from SHELL_NAV | Banking gap | Phase 1 nav |
| R10 | Density toggle lies | User trust | Wire tokens OR document shell-only until migration |
| R11 | Dark mode broken on feature pages | Hex islands | DS tokens + DualDate fix |
| R12 | A11y critical selects unnamed | Baseline fail | Fix on migrate of those 3 routes |
| R13 | Print layouts inconsistent | Invoice/cheque/payslip unspec’d | Family PRINT |
| R14 | Falcon/Sutra/F12/Nios look chaos | Competes with Orbix calm | §D overlays |
| R15 | Number locale mix (`en-IN` / `en-NP` / bare) | Ugly amounts | Authority: `en-IN` + `Rs.` |
| R16 | Transaction interiors still BusyShell | Premium shell, cheap form | Family TXN |
| P17 | Masters/payroll/config/orders omitted from v2 | Huge product hole | Families below |
| R18 | e2e covers ~22/156 routes | Regressions invisible | Phase QA map |
| R19 | `@ts-nocheck` on reports | Silent breakages | Drop on migrate |
| R20 | Unwired orphan pages (Tally, Smart recon) | Accidental revive of green UI | Quarantine policy §E3 |

### A3. What v2 Ultra got right (keep)

- Principles P1–P12, colour retune `#0F5C8C`, control kit §4, ReportWorkspace blueprint, statement table micro-spec, drill/print rules, BS/TB/P&L/Journal/GL/DayBook detail, phases A–K skeleton.

### A4. What this FINAL plan adds (closes omissions)

1. **Absolute authority sentence** for Auto mode  
2. **8 screen families** covering **every wired App.tsx route**  
3. **Global overlays** (toast, confirm, F12, Falcon, Sutra, Nios, print)  
4. **Nav / orphan / quarantine policy**  
5. **i18n / Nepali / number / density / a11y / dark / keyboard** hard rules  
6. **Complete route → family matrix**  
7. **Phase 0 blockers** before any page skin  
8. **Definition of Done** that cannot be gamed  

---

## PART B — Authority & non-negotiables

### B1. Sole visual authority (implementers)

> **For any file migrated under this plan, this document is the sole visual authority.** Use only `@/design-system` components and `var(--ds-*)` tokens. Essential UI text ≥12px. No raw hex. No emoji in chrome. Untouched legacy files may remain on AGENTS.md until scheduled — **never mix** `#1557b0` or `text-[10px]` into a migrated file.

Precedence when conflicting: **this FINAL plan > v2 looks plan > UI-1…UI-7 reports > PREMIUM_UI_REDESIGN_SPEC > AGENTS visual tips** (AGENTS accounting/sync safety still wins for behaviour).

### B2. Product look (one line)

**Calm Himalayan ledger** — soft stone canvas, one trust blue, Orbix teal only on Orbix, dense tables, plain Nepal-business English, almost no decorative icons.

### B3. Colour tokens (Phase 0)

**File:** `src/design-system/foundations/tokens.css`  
**Sync:** `UI_COLOUR_TOKEN_SPEC.md`

| Token | Value |
|-------|-------|
| `--ds-action-primary` | `#0F5C8C` |
| `--ds-action-primary-hover` | `#0C4A72` |
| `--ds-canvas` | `#F3F5F7` |
| `--ds-surface` | `#FFFFFF` |
| `--ds-surface-muted` | `#EEF1F4` |
| `--ds-text-strong` / `default` / `muted` | `#14212B` / `#2A3845` / `#5C6B79` |
| `--ds-border-default` | `#D5DCE3` |
| `--ds-intelligence` | `#0A7A7A` (Orbix only) |
| `--ds-status-success` | `#0F6B56` |
| `--ds-status-warning` | `#8A5A12` |
| `--ds-status-danger` | `#B4232F` |
| `--ds-financial-debit` / `credit` | danger / success **with Dr/Cr text** |

**Forbidden:** purple/indigo, neon glow, tally pale green pages, rainbow pills, `#eef2ff` grand totals (use `--ds-brand-50` + 2px primary top).

### B4. Typography & money

| Element | Spec |
|---------|------|
| Page title | 16px / 600 |
| Help | 13px muted — plain sentence + “(Accounting: …)” |
| Meta | Company · FY · DualDate |
| Column header | 12px semibold; uppercase only for columns |
| Body / particulars | 13px |
| Amounts | `Rs.` + `en-IN` + tabular + 2 dp; zero → `—` |
| Status chips | 12px medium, **sentence case**, status surfaces |

### B5. Control kit (every button in the product)

| Variant | Use |
|---------|-----|
| `primary` | One per region: Show report / Save / Post / New / Sign in |
| `secondary` | Print, Options, Back, Export trigger, Cancel-adjacent |
| `quiet` | Reset, Clear, tertiary |
| `destructive` | Delete/Void + confirm |
| `link` | Inline explain / drill name |

**Report header actions (fixed order):**  
`[↻ Refresh aria-label]` `[Print]` `[Export ▾ Excel|CSV|PDF]` `[Options]` + optional status chip left.

**Icon-only:** Lucide + mandatory `aria-label`; visible on row **hover and focus**.

**Never:** 📄🖨️⚠ emoji buttons; Sparkles on money CTAs; two primaries in one region.

### B6. Shared state patterns

| State | Component | Copy style |
|-------|-----------|------------|
| Empty | DS `EmptyState` | “Choose dates, then show the report.” |
| Loading | `LoadingState` / quiet spinner | “Preparing…” |
| Error | `Banner` danger | Plain + Retry |
| Toast | Prefer DS toast; until then restyle hot-toast — calm, no emoji |
| Confirm | DS `AlertDialog` / Confirm foundation | Title question + Cancel/Confirm |
| Balance OK | success surface | “Balanced — ready to save” / “Accounts match” |
| Balance bad | danger surface | “Out by Rs. X” |

---

## PART C — Plain language (complete dictionary)

Apply in `navConfig.ts`, `CommandPalette.tsx`, PageHeaders. Route IDs unchanged.

| Route / old | Visible title | Help (one line) |
|-------------|---------------|-----------------|
| dashboard | Home | What needs attention today. |
| orbix | Ask Orbix | Ask questions or draft bookkeeping entries. |
| billing / sales | Sales invoice | Bill a customer. |
| sales-return | Sales return | Reverse or credit a sale. |
| sales-order | Sales order | Customer order before delivery. |
| delivery-challan | Delivery note | Goods sent to customer. |
| quotation / sales-quotation | Quotation | Price offer to customer. |
| purchase | Purchase invoice | Record a supplier bill. |
| purchase-return | Purchase return | Return goods to supplier. |
| purchase-order | Purchase order | Order placed with supplier. |
| goods-receipt / grn | Goods receipt | Stock received from supplier. |
| receipt | Receive money | Money received from a party. |
| payment | Pay money | Money paid to a party. |
| contra | Transfer between accounts | Move money between cash/bank. |
| journal | Manual journal | Entries that are not sales or purchases. |
| debit-note | Supplier credit note | Reduce what you owe a supplier. |
| credit-note | Customer credit note | Reduce what a customer owes you. |
| voucher-entry | All entry types | Pick the kind of entry to make. |
| recurring-vouchers | Recurring entries | Entries that repeat on a schedule. |
| reversing-journals | Reversing journals | Journals that auto-reverse later. |
| day-book | Today’s transactions | Everything entered for the dates. |
| ledger / ledger-report | Account activity | History of one account. |
| accounts / chart-of-accounts | Account list | All accounts in your books. |
| ledger-master | Account details | Create or edit one account. |
| parties | Customers & suppliers | People and companies you trade with. |
| items / stock-book | Products & items | What you buy and sell. |
| item-groups | Item groups | Categories for products. |
| warehouses | Store locations | Where stock is kept. |
| units / unit-conversion | Units | How you measure items. |
| price-lists | Price lists | Selling prices by list. |
| bill-sundry | Extra charges & discounts | Freight, discount, round-off, etc. |
| batch-management | Batches | Lot / batch tracking. |
| stock-transfer | Stock transfer | Move stock between locations. |
| stock-journal | Stock journal | Adjust stock with accounting. |
| physical-stock | Physical stock count | Count vs book stock. |
| production | Production | Make finished goods from materials. |
| material-issued / material-out | Material issued | Materials sent out. |
| material-received / material-in | Material received | Materials brought in. |
| unassemble | Unassemble | Break a finished item into parts. |
| rejection-in / rejection-out | Rejection in/out | Rejected goods movements. |
| job-work-register | Job work | Outsourced job work orders. |
| trial-balance | Account totals check | Debits and credits should match. |
| balance-sheet | What you own & owe | Assets, liabilities, and capital. |
| profit-loss | Profit & loss | Income and expenses for the period. |
| cash-book | Cash book | Cash in and out. |
| bank-book | Bank book | Bank in and out. |
| cash-flow | Cash flow | Where cash came from and went. |
| party-statement | Customer / supplier statement | Running balance for one party. |
| outstanding-receivables | Money customers owe | Unpaid sales. |
| outstanding-payables | Money you owe | Unpaid purchases. |
| aging-report | Overdue by age | How long invoices have been unpaid. |
| budget-vs-actual | Budget vs actual | Plan compared to real figures. |
| budget | Budget | Set spending and income plans. |
| ratio-analysis | Ratios | Key business ratios. |
| interest-calculation | Interest | Interest on outstanding balances. |
| income-expenditure | Income & expenditure | For non-trading entities. |
| equity-statement | Equity statement | Changes in owners’ equity. |
| funds-flow | Funds flow | Sources and uses of funds. |
| notes-to-accounts | Notes to accounts | Extra notes for statements. |
| fixed-assets | Fixed assets | Land, buildings, equipment. |
| stock-summary / inventory-report | Stock summary | Stock quantities and values. |
| stock-ledger | Stock ledger | Movement history of an item. |
| sales-analysis | Sales analysis | Sales broken down for insight. |
| sales-register | Sales register | List of sales invoices. |
| purchase-register | Purchase register | List of purchase invoices. |
| vat-reports | VAT reports | VAT returns and annexes. |
| vat-classifications | VAT classifications | How items are taxed. |
| tds-report | TDS report | Tax deducted at source. |
| tds-certificate | TDS certificate | Certificates for deductees. |
| audit-log | Audit log | Who changed what. |
| bank-reconciliation | Match bank statement | Tick books against bank / wallets. |
| bank-statement-import | Import bank statement | Load a bank file to match. |
| cheque-register | Cheque register | Cheques issued and received. |
| cheque-printing | Print cheques | Layout for cheque printing. |
| pdc-register / pdc-management | Post-dated cheques | Cheques with future dates. |
| payroll / salary-process | Payroll | Pay employees. |
| payroll-run (if distinct) | Run payroll | Process a pay period. |
| employees / employee-master | Employees | Staff records. |
| employee-loans | Employee loans | Loans to staff. |
| pay-heads | Pay heads | Salary components. |
| bonus-provision | Bonus provision | Bonus amounts set aside. |
| gratuity-calculation | Gratuity | Gratuity calculation. |
| attendance-voucher | Attendance | Attendance entries. |
| master-control-centre | Setup centre | All setup in one place. |
| configuration-hub | Setup options | Invoice, print, and system options. |
| accounts-configuration | Accounts setup | Accounting preferences. |
| inventory-config | Inventory setup | Stock preferences. |
| settings / company-settings | Company settings | Company profile and tax. |
| users | Users | Who can sign in and what they can do. |
| fiscal-year | Fiscal year | Nepal financial year periods. |
| backup-restore | Backup & restore | Protect your data. |
| data-export-import | Import & export | Move data in or out. |
| communication-hub | Messages & email | Email and communication tools. |
| sales-reconciliation | Sales reconciliation | Reconcile sales figures. |
| cost-centers | Cost centres | Track cost by department/project. |
| sales-persons | Sales persons | Salesperson master. |
| standard-narration | Saved descriptions | Reusable narration text. |
| sale-type / purchase-type | Sale / purchase types | Classify sale and purchase. |
| tax-category | Tax categories | Tax groupings. |
| voucher-types | Entry types | Numbering and voucher types. |
| schemes | Schemes | Discount / scheme rules. |
| misc-masters | Other masters | Remaining setup lists. |

---

## PART D — Global chrome (was missing)

### D1. Shell (files)

`AppShell.tsx` · `PrimarySideNav.tsx` · `TopCommandBar.tsx` · `CommandPalette.tsx` · `NotificationCentre.tsx` · `SyncStatusControl.tsx` · `MobileBottomNav.tsx` · `PageContentFrame.tsx` · `CompanySwitcher.tsx` · `navConfig.ts` · `DataLoadWarningBanner` (in AppShell)

| Element | Look |
|---------|------|
| Sidebar | Deep slate; 2px brand active bar; icons 18px; Orbix = `MessageSquare` not Sparkles |
| Top bar | 48–52px; search placeholder “Search invoices, parties, or ask Orbix…” |
| CompanySwitcher | Clean list: company name, PAN last-4 optional, FY; keyboard ↑↓ Enter; no emoji |
| Sync | Dot + Online / Syncing / Offline / Needs review — open panel for conflict list (plain) |
| Data load warning | DS Banner warning — not custom yellow hex |
| Mobile nav | Home · Sales · Receive · Pay · More (max 5) |
| Palette | Labels from §C; include banking recon + statement import; jargon only as secondary hint |

### D2. Auth (keep UI-4; polish copy)

`PreWorkspaceShell` · `GatewayScreen` · `CompanyLoginScreen` · `SignUpWizard` + steps · `AuthAccessSurfaces` · `InitErrorScreen`  
Large Sign in; Nepali company name field; PAN/VAT plain helpers; no confetti.

### D3. Home / Orbix (keep UI-5/6; enforce calm)

- Home: attention + ≤6 actions + calm KPIs; **unmount achievements**  
- Orbix: replace `OrbixNeuronThinking` with “Orbix is working…”; hide model/RAG strings; intelligence teal only on Orbix  

### D4. Overlays outside Orbix (NEW — mandatory)

| Overlay | Files | Look rule |
|---------|-------|-----------|
| Falcon | `FalconProvider`, `FalconPanel`, `FalconLauncher`, `FalconThinkingPanel` | Same calm as Orbix; no neuron glow; launcher quiet “Assist”; suppress decorative pulse |
| Sutra AI | `SutraAiProvider` | Mobile only if kept; Brain icon OK; no neon; prefer deep-link to Ask Orbix long-term |
| Nios | `NiosShell` | If user-visible: DS drawer; if internal, keep out of chrome |
| EKhata panel | `EKhataPanel`, `EKhataLauncher` | “Ask Orbix” secondary; no sparkle explosion |
| F12 panel | `F12Panel.tsx` | DS Drawer/Dialog; ≥12px; no `#1557b0`; labelled as “Quick settings” |
| Toasts | `App.tsx` react-hot-toast | Position top-right; 13px; success/danger tokens; no emoji |
| Confirm | migrate to DS AlertDialog | — |
| Invoice print | `InvoicePrint.tsx` | White A4 preview; company header; DualDate; close secondary; print primary |
| Cheque print | `ChequePrinting.tsx` | Remove BusyShell; preview surface + Print |
| Payslip print | Payroll | Same print-only header rules as reports |

### D5. Keyboard map (document in UI + this plan)

| Shortcut | Action | Presentation |
|----------|--------|--------------|
| Ctrl/Cmd+K | Command palette | — |
| F5 | Refresh report (when on report) | — |
| Alt+P | Print (reports that support) | — |
| Esc | Close dialog / drill back | — |
| Ctrl+B/T/L/… | Existing App.tsx jumps | Palette labels must match §C |
| F12 | Quick settings | Relabel panel |

Show shortcuts as 12px muted hints — never as the hero of the screen (Voucher hub: plain cards first, F-keys secondary).

### D6. i18n

1. Wire or replace `LanguageModal` — add **नेपाली / Nepali (`ne-NP`)** first.  
2. Until full i18n: English UI + Nepali **data** (names, narrations) with Devanagari font.  
3. DualDate always available on money dates.

### D7. Density

Until a page uses DS control height tokens: TopCommandBar menu should note “Applies to new screens” OR migrate controls to `var(--ds-control-height)`. Default `productive`.

### D8. Dark mode

Migrated files: tokens only. Fix DualDate (`text-[#000]` banned). Do not claim dark-complete until G-family reports + DualDate done.

### D9. Accessibility gates (per migrated screen)

- No unnamed `<select>` / IconButton  
- Contrast pass on primary actions and body text  
- Focus visible (`ds-focus-ring`)  
- Re-run `npm run ui:a11y` on the 7 baseline screens as each is migrated  

---

## PART E — Navigation, orphans, quarantine

### E1. Must add to `SHELL_NAV` (missing today)

- `bank-reconciliation` → Banking  
- `bank-statement-import` → Banking  
- `sales-register` / `purchase-register` → Sales / Purchases (or Reports)  
- `payroll` visible for admin/owner/manager roles  

### E2. Orphan policy (92 routes)

| Policy | Meaning |
|--------|---------|
| **NAV** | Add to nav (daily use) |
| **PALETTE** | Command palette + search only (advanced) |
| **HUB** | Reachable from Setup centre / Voucher hub cards |
| **DEPRECATE** | Unwire from App when safe; do not restyle |

Every wired route must be NAV, PALETTE, or HUB — never invisible.

### E3. Quarantine (do not restyle into product)

| File | Action |
|------|--------|
| `TallyVoucherPage.tsx` + `src/components/tally/*` + `tally-green.css` | Keep unwired; governance forbid new imports; delete or archive later |
| `SmartBankReconciliation.tsx`, `AutoBankReconciliation.tsx` | If unwired: either wire behind Bank recon tabs with DS skin **or** DEPRECATE — do not leave hex zombies |
| Dead invoice forms | Never edit (`StockItems.tsx`, `PurchaseInvoiceForm.tsx`, `ReturnInvoiceForm.tsx`) |

---

## PART F — Eight families (covers every wired screen)

Every App.tsx page maps to exactly one family. Implement family chrome once; page supplies title/columns/options only.

### FAMILY STMT — Financial statements

**Chrome:** `src/features/reports/ReportWorkspace.tsx` (create)  
**Table rules:** section / group / leaf / subtotal / grand-total; comparative = muted headers not blue paint; drill breadcrumb + Back + Esc; print-only company+DualDate; status chips “Accounts match” / “Out by Rs. X”.

**Members:**  
`BalanceSheet` · `TrialBalance` · `ProfitLoss` (+ `pl/*`, `FinancialStatementChrome`, `NepalFinancialStatementView`) · `CashFlowStatement` · `IncomeExpenditureAccount` · `EquityStatement` · `FundsFlowStatement` · `NotesToAccounts` · `RatioAnalysis` · `BudgetVsActual` · `InterestCalculation`

**Extra micro-rules (from v2 §7 — still binding):**

- BS: plain title; Options Dialog with Advanced collapse; KPI ≤4; kill `[screen only]` 9px tags in default view  
- TB: tabs By name / By group / Opening / Detailed; no forced Options every visit after first  
- P&L: Export ▾ single; drop decorative BarChart2 hero; keep Alt+P/F5  

### FAMILY REG — Registers & books (tabular lists)

**Chrome:** ReportWorkspace or PageHeader + FilterBar + `EnterpriseDataTable`  
**Columns pattern:** DualDate · No. · What · Party · In/Out or Debit/Credit · Status · View  
**Footer:** sticky totals; quiet type chips (no rainbow)  
**Actions:** Print · Export secondary; New primary only if register creates docs  

**Members:**  
`DayBook` · `JournalEntries` · `SalesRegister` · `PurchaseRegister` · `CashBook` · `BankBook` · `ChequeRegister` · `PDCRegister` · `PDCManagement` · `PDCSummary` · `JobWorkRegister` · `AuditLog` · `SalesReconciliationPanel` (route)

### FAMILY LEDG — Account / party explorers

**Chrome:** Tree or picker + statement pane  
**Members:** `GeneralLedger` + `LedgerStatementView` · `ChartOfAccounts` · `PartyLedgerStatement` · `PartyStatement` · `StockLedgerReport`  
**Must:** Search on tree; DualDate period; Print/Export; keyboard hints 12px  

### FAMILY AGING — Receivables intelligence

**Members:** `OutstandingReceivables` · `OutstandingPayables` · `AgingReport`  
**Rules:** Plain titles; remove ⚠ emoji; Export secondary + Print; aging bars ≥12px labels; remind actions = secondary text  

### FAMILY TAX — Compliance reports

**Members:** `VatReports` · `TdsReport` · `TdsCertificatePage` · `VATClassificationMaster`  
**Rules:** One ReportWorkspace; annex tabs §B5; DualDate truth; no duplicate inline shells  

### FAMILY TXN — Document entry forms

**Shell:** `TransactionWorkspace` / `TransactionRouteShell`  
**Interior:** DS inputs; no BusyShell; footer Cancel · Print preview · Save draft · Post; balance strip  
**Line grid:** 13px; VAT “13%” plain; TDS collapsed by default  

**Members (wrap + skin):**  
`BillingInvoice` + `SalesInvoiceForm` · `PurchaseVoucher` · `ReceiptVoucher` · `PaymentVoucher` · `ContraVoucher` · `JournalEntries` form · `DebitNoteVoucher` · `CreditNoteVoucher` · `DeliveryChallan` + `ChallanForm` · `GoodsReceiptNote` · `OrderVoucherPage` · `QuotationPage` · `StockTransfer` · `StockJournalPage` · `PhysicalStockPage2` · `ProductionPage` · `MaterialIssuedPage` · `MaterialReceivedPage` · `UnassemblePage` · `RejectionVoucherPage` · `Attendance` voucher pages · `RecurringVouchers` · `ReversingJournals` · `VoucherEntryHub` (card launcher, F-keys muted)

**Print:** `InvoicePrint.tsx` under DS preview rules.

### FAMILY MASTER — CRUD lists + forms

**Chrome:** PageHeader + SearchField + FilterBar + EnterpriseDataTable + Drawer/Dialog form  
**Empty:** “Add your first …” + primary  
**Members:**  
`Parties` + `PartyForm` · `StockBook` · `ItemGroupMaster` · `Warehouses` · `Units` · `UnitConversionMaster` · `LedgerMaster` · `PriceLists` · `CostCenters` · `BillSundryMaster` · `BatchManagement` · `SalesPersons` · `SaleTypeMaster` · `PurchaseTypeMaster` · `TaxCategoryMaster` · `VoucherTypeMaster` · `StandardNarrationMaster` · `SchemeMaster` · `MiscMasters` · `FiscalYear` · `BudgetMaster` · `FixedAssets` · `EmployeeMaster` · `PayHeadMaster` · `EmployeeLoans`  

**Hub:** `MasterControlCentre` — regroup People · Items · Accounts · Tax · **Advanced (collapsed)**

### FAMILY BANK — Matching & statements

**Members:** `BankReconciliation` · `BankStatementImport` · (+ Smart/Auto if wired as tabs) · `ChequePrinting` · wallet tabs eSewa/Khalti/ConnectIPS as **quiet segmented** (no 🏦 emoji)  
**Rules:** Title “Match bank statement”; suggested matches Accept/Skip; remove BusyShell from cheque print  

### FAMILY PAY — Payroll & HR money

**Members:** `Payroll` · `PayrollRun` · `BonusProvision` · `GratuityCalculation`  
**Rules:** Same as MASTER+TXN hybrid; payslip print-only header; calm tables; no trophy UI  

### FAMILY CFG — Settings & hubs

**Members:** `CompanySettings` · `UsersManagement` · `ConfigurationHub` · `AccountsConfiguration` · `InventoryConfiguration` · `BackupRestore` · `DataExportImport` · `CommunicationHub` · `StatutoryCompliance` (if wired)  
**Rules:** Sectioned forms; danger zone separated; Communication hub lose 10px uppercase scream; Setup cards with one-line plain descriptions  

### FAMILY AI — Intelligence (already mostly done)

**Members:** Orbix path + overlay rules §D4  
**Enforce:** calm thinking; trust chrome; no achievements  

### FAMILY SHELL — App chrome / auth / home

**Members:** shell + auth + `FinancialDashboard`/`HomePage`  
**Enforce:** §D1–D3  

---

## PART G — Statement micro-spec (binding detail)

### G1. ReportWorkspace layout

```text
PageHeader: Title · Help · Meta (Company·FY·DualDate) · chip · [↻][Print][Export▾][Options]
FilterBar: DualDate · entity filters · chips · [Show report] primary
Optional KPI ≤4 quiet tiles (12px labels, 20–22px values)
StatementSurface: tabs · breadcrumb · table · sticky totals
print-only: Company · नाम · PAN · Title · Period BS+AD · Printed at
```

### G2. Row types

| Row | Style |
|-----|-------|
| Header | muted bg, 12px semibold |
| Section | muted band, 13px semibold, no chevron |
| Group | chevron, indent 16px×level, aria-expanded |
| Leaf | hover muted; click drills |
| Subtotal | muted + strong top border |
| Grand total | brand-50 + 2px primary top |
| Difference | danger surface |

### G3. Shared helpers to consolidate

| Keep / create | Deprecate into it |
|---------------|-------------------|
| `features/reports/ReportWorkspace.tsx` | `reporting/ReportShell.tsx`, `reports/ReportShell.tsx` page-local toolbars |
| DS Dialog | `ErpReportModal` |
| DS EmptyState | `ReportEmptyState` |
| DS DateRangeFilter visuals | `ReportDateRangePicker` skin |
| Retoken | `NepaliDatePicker`, `DualDate`, `FinancialStatementChrome`, `PLToolbar` |

---

## PART H — Complete route → family matrix

*(Authenticated routes from App.tsx — implementer checklist)*

| Route ID(s) | Family | Priority wave |
|-------------|--------|---------------|
| dashboard, financial-dashboard | SHELL | W1 |
| orbix | AI | W1 |
| gateway/login/onboarding (auth stages) | SHELL | W1 |
| trial-balance, day-book | STMT/REG | W2 |
| balance-sheet, profit-loss | STMT | W2 |
| journal, ledger, accounts, chart-of-accounts | REG/LEDG | W2 |
| cash-book, bank-book, cash-flow | STMT/REG | W2 |
| party-statement, outstanding-*, aging-report | LEDG/AGING | W2 |
| vat-reports, tds-*, vat-classifications | TAX | W3 |
| billing, sales-return, purchase, purchase-return, receipt, payment, contra | TXN | W3 |
| debit-note, credit-note | TXN | W3 |
| sales-order, purchase-order, quotation*, delivery-challan, goods-receipt | TXN | W3 |
| sales-register, purchase-register | REG | W3 |
| parties, items, stock-book, item-groups, warehouses, units* | MASTER | W4 |
| ledger-master, price-lists, bill-sundry, batches, cost-centers, sales-persons | MASTER | W4 |
| standard-narration, sale-type, purchase-type, tax-category, voucher-types, schemes, misc-masters | MASTER | W4 |
| master-control-centre, fiscal-year, budget | MASTER | W4 |
| bank-reconciliation, bank-statement-import, cheque-*, pdc-* | BANK | W4 |
| stock-transfer, stock-journal, physical-stock, production, material-*, unassemble, rejection-*, job-work-* | TXN | W5 |
| voucher-entry, recurring-vouchers, reversing-journals | TXN | W5 |
| payroll*, employees, employee-loans, pay-heads, bonus-provision, gratuity*, attendance-* | PAY | W5 |
| fixed-assets, budget-vs-actual, ratio-analysis, interest-calculation, income-expenditure, equity-statement, funds-flow*, notes-to-accounts | STMT | W5 |
| stock-summary, inventory-report, stock-ledger, sales-analysis | REG/LEDG | W5 |
| configuration*, accounts-configuration, inventory-config, settings, users, backup*, data-*-import, communication*, audit-log, sales-reconciliation | CFG | W6 |
| holidays (if config) | CFG | W6 |

Any route in App.tsx not listed: assign **PALETTE + nearest family** before coding — do not leave unassigned.

---

## PART I — Implementation waves (Auto-ready)

### Wave 0 — Blockers (must finish first)

1. Token retune §B3  
2. Rebuild `NepaliDatePicker.tsx` + `DualDate.tsx` on DS (≥12px, dark-safe, no hex)  
3. Create `ReportWorkspace.tsx`; adapt both ReportShells to it  
4. Kill emoji on `PartyLedgerStatement`, OR/OP, `BankReconciliation` tab  
5. Orbix thinking calm + nav icon MessageSquare + palette labels §C for core items  
6. Add bank-recon + statement-import to nav  
7. Authority note in `UI_DESIGN_AUTHORITY_MANIFEST.md` pointing here  
8. `npm run ui:governance` + `ui:ds-lab` green  

**Auto prompt:**
```text
Implement Wave 0 from docs/ui-redesign/ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md only.
Looks only. DS tokens + ReportWorkspace + DualDate/NepaliDatePicker retoken + emoji kill + nav banking entries.
No posting/sync/engine changes. Run npm run ui:governance.
```

### Wave 1 — Shell / auth / home / Orbix polish

Enforce §D1–D4; LanguageModal Nepali; CompanySwitcher; F12/Falcon/Sutra calm; unmount achievements; sync conflict plain panel.

### Wave 2 — Core statements & daily books

STMT+REG+LEDG priority: TB, Day Book, BS, P&L, Journal list, GL, Cash/Bank book, Cash flow, Party statement, OR/OP/Aging.

### Wave 3 — Money documents & tax

TXN interiors for UI-7 set + D/C notes + orders/challan/GRN; InvoicePrint; TAX family; Sales/Purchase registers.

### Wave 4 — Masters & banking

MASTER list+form pattern; Setup centre regroup; BANK recon/import/cheque/PDC; remove BusyShell consumers in this set.

### Wave 5 — Inventory ops, payroll, secondary statements

Remaining TXN inventory; PAY; secondary STMT (ratios, funds flow, fixed assets, stock reports).

### Wave 6 — Config, communication, admin, sweep

CFG family; quarantine tally-green; drop `@ts-nocheck` on migrated files; expand e2e visual set; full `ui:a11y` + `ui:baseline` on migrated routes; update `UI_MIGRATION_TRACKER.md`.

---

## PART J — Per-file kill / migrate list (explicit)

### J1. Must eliminate from production chrome

| Pattern | Action |
|---------|--------|
| 📄 🖨️ ⚠ 🏦 🏘️ emoji in buttons/tabs | Replace Lucide + text |
| `OrbixNeuronThinking` glow/model names | Quiet status |
| `AchievementSystem` on home/shell | Unmount |
| BusyShell on listed consumers | DS Page/Surface |
| `tally-green.css` import path | Quarantine |
| `#eef2ff` total rows | brand-50 + primary border |
| TB blue/gray filled comparative headers | Muted group labels |
| Raw `#1557b0` in migrated file | Fail review |
| `text-[9px]`/`text-[10px]` essential UI | ≥12px |
| Duplicate ReportShell APIs | One ReportWorkspace |

### J2. BusyShell consumers (migrate off)

`ChequePrinting.tsx` · `CompanySettings.tsx` · `SalesInvoiceForm.tsx` · `JournalVoucherForm.tsx` · `TdsPayment.tsx` · `DepositSlip.tsx` · `EPayments.tsx` · `PaymentAdvice.tsx` · `PDCSummary.tsx` · `AutoBankReconciliation.tsx` (if kept)

### J3. Governance commands after each wave

```bash
npm run ui:governance
npm run ui:ds-lab
# after statement waves:
npm run ui:a11y
npm run ui:baseline
```

---

## PART K — Definition of Done (cannot claim early)

### Product-level DoD

- [ ] Every **wired** App.tsx route has Family + Wave assignment (Part H)  
- [ ] Wave 0 complete  
- [ ] Non-accountant can find: Receive money, Pay money, Sales invoice, Ask Orbix, Match bank statement, Account totals check, What you own & owe  
- [ ] Zero emoji in buttons/tabs on migrated surfaces  
- [ ] Zero BusyShell on migrated surfaces  
- [ ] ReportWorkspace used by all STMT/REG/TAX migrated reports  
- [ ] DualDate/NepaliDatePicker DS-tokenized  
- [ ] `src/pages` migrated set imports `@/design-system`  
- [ ] bank-reconciliation in nav  
- [ ] Nepali option exists in language UI  
- [ ] A11y baseline critical `select-name` fixed on billing/journal/bank-recon  
- [ ] `ui:governance` pass; no new hex/sub-12px debt on touched files  
- [ ] Migration tracker updated with real statuses  

### Wave DoD

- [ ] All members of that wave’s families meet family chrome rules  
- [ ] Plain titles from Part C  
- [ ] Print/Export order correct  
- [ ] Playwright for wave surfaces updated or smoke-listed  

### Explicit non-goals (still)

- Changing accounting math / posting / sync  
- Full Nepali translation of every string in Wave 0–2 (data + DualDate first; chrome i18n progressive)  
- Restyling quarantined Tally stack into product  
- Force-push / Lovable history rewrite  

---

## PART L — Auto prompt library

**Wave N generic:**
```text
Implement Wave [N] from docs/ui-redesign/ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md.
Looks/presentation only. Follow Part B authority and the Family rules for each file you touch.
Use @/design-system and --ds-* only. No raw hex. No emoji chrome.
Plain titles from Part C. Essential text ≥12px.
Do not change posting, sync, or report engines.
Edit only files in this wave. Run npm run ui:governance when done.
```

**Single screen:**
```text
Migrate [Route/File] using Family [X] in ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md.
Match ReportWorkspace/control kit/print rules. Looks only.
```

---

## PART M — Visual reference

```text
Sidebar │ Company · FY 2081/82 · Search · Sync · Bell · User
        │ Account totals check              [Accounts match]
        │ Debits and credits should match. (Trial balance)
        │ १ श्रावण – ३१ असार २०८१ · 16 Jul 2024 – 15 Jul 2025
        │                 [↻] [Print] [Export ▾] [Options]
        │ Filters…                           [Show report]
        │ Account          Debit (Rs.)   Credit (Rs.)
        │ … dense calm rows …
        │ Grand total      …             …
```

**Feel:** calm · clear · trustworthy · Nepal-ready · adult software.

---

## PART N — Supersession

| Document | Role now |
|----------|----------|
| **This file** | **FINAL looks implementation authority** |
| `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md` | Historical; redirect readers here |
| UI-0…UI-7 reports | Evidence of prior waves; do not contradict Part B |
| `UI_MIGRATION_TRACKER.md` | Update statuses as waves complete |
| `AGENTS.md` | Behaviour + unmigrated legacy tips only |

Add at top of v2 plan file (implementer note): *Superseded by ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md*.

---

*End of FINAL plan. Start at Wave 0. Do not skip blockers.*
