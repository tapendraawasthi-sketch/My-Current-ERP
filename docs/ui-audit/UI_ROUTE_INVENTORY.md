# UI Route Inventory

Generated: 2026-07-13T12:34:16.667Z

## Summary

| Metric | Value |
|--------|------:|
| Total routes (incl. auth) | 160 |
| Authenticated page IDs | 156 |
| Unique page components | 102 |
| With nav entry | 64 |
| Without nav entry | 92 |
| Nav destinations missing App route | 0 |
| Visually covered (UI QA harness) | 34 |

## Router model

Navigation is **not** URL-path based. The app uses Zustand `currentPage` and a large `switch` in `src/App.tsx`. Authenticated pages render inside `Layout` → `AppShell`.

## Auth stages

| Stage | Component |
|-------|-----------|
| checking | inline spinner |
| error | InitErrorScreen |
| no-company | SignUpWizard |
| gateway | GatewayScreen |
| company-login | CompanyLoginScreen |
| authenticated | Layout → AppShell → page |

## Routes without navigation entry

- `employee-loans`
- `notes-to-accounts`
- `equity-statement`
- `funds-flow`
- `funds-flow-statement`
- `chart-of-accounts`
- `party-master`
- `item-master`
- `stock-book`
- `item-group-master`
- `unit-conversion`
- `unit-conversions`
- `ledgers`
- `ledger-master`
- `price-list-master`
- `cost-centre`
- `sales-persons`
- `standard-narrations`
- `batches`
- `pdc-summary`
- `bill-sundries`
- `sale-type`
- `sale-types`
- `purchase-type`
- `purchase-types`
- `tax-category`
- `tax-categories`
- `voucher-types`
- `voucher-series-config`
- `schemes`
- `misc-masters`
- `material-centres`
- `bill-of-material`
- `bom`
- `sales`
- `quotation`
- `sales-quotation`
- `grn`
- `purchase-quotation`
- `production`
- `unassemble`
- `material-issued`
- `material-out`
- `material-received`
- `material-in`
- `configuration`
- `holidays`
- `communication`
- `cheque-register`
- `bank-statement-import`
- `cheque-printing`
- `reversing-journals`
- `reversing-journal`
- `rejection-out`
- `rejection-in`
- `job-work-register`
- `job-work-out-order`
- `job-work-in-order`
- `attendance-voucher`
- `attendance-entry`
- `interest-calculation`
- `income-expenditure`
- `ledger-report`
- `stock-status`
- `closing-stock`
- `inventory-report`
- `gstr1`
- `gstr2`
- `gstr3b`
- `gst-summary`
- `inventory-configuration`
- `salary-process`
- `tds-reports`
- `tds-certificate`
- `bonus-provision`
- `gratuity-calculation`
- `pay-heads`
- `vat-classifications`
- `master-control-centre`
- `users-management`
- `company-settings`
- `sales-reconciliation`
- `backup`
- `data-import-export`
- `data-export-import`
- `bank-reconciliation`
- `employees`
- `employee-master`
- `sales-register`
- `purchase-register`
- `cash-book`
- `bank-book`

## Nav destinations without App.tsx route

_None_

## Full route table

| Page ID | Component | Module | Nav | Visual QA | Priority |
|---------|-----------|--------|-----|-----------|----------|
| financial-dashboard | FinancialDashboard | home | yes | yes | P2 |
| dashboard | FinancialDashboard | home | yes | yes | P1 |
| orbix | OrbixWorkspacePage | home | yes | yes | P1 |
| pdc-register | PDCRegister | banking | yes | no | P3 |
| employee-loans | EmployeeLoans | masters | no | no | P4 |
| notes-to-accounts | NotesToAccounts | masters | no | no | P4 |
| equity-statement | EquityStatement | other | no | no | P5 |
| funds-flow | FundsFlowStatement | other | no | no | P5 |
| funds-flow-statement | FundsFlowStatement | other | no | no | P5 |
| accounts | ChartOfAccounts | masters | yes | yes | P1 |
| chart-of-accounts | ChartOfAccounts | masters | no | yes | P4 |
| parties | Parties | other | yes | yes | P1 |
| party-master | Parties | masters | no | yes | P4 |
| item-master | StockBook | masters | no | yes | P4 |
| items | StockBook | masters | yes | yes | P1 |
| stock-book | StockBook | inventory | no | yes | P4 |
| item-groups | ItemGroupMaster | masters | yes | no | P4 |
| item-group-master | ItemGroupMaster | masters | no | no | P4 |
| warehouses | Warehouses | masters | yes | no | P4 |
| units | Units | masters | yes | no | P4 |
| unit-conversion | UnitConversionMaster | masters | no | no | P4 |
| unit-conversions | UnitConversionMaster | masters | no | no | P4 |
| ledgers | LedgerMaster | reports | no | no | P3 |
| ledger-master | LedgerMaster | masters | no | no | P4 |
| price-lists | PriceLists | masters | yes | no | P4 |
| price-list-master | PriceLists | masters | no | no | P4 |
| cost-centers | CostCenters | masters | yes | no | P4 |
| cost-centre | CostCenters | masters | no | no | P4 |
| sales-persons | SalesPersons | transactions | no | no | P2 |
| standard-narration | StandardNarrationMaster | masters | yes | no | P4 |
| standard-narrations | StandardNarrationMaster | masters | no | no | P4 |
| budget | BudgetMaster | masters | yes | no | P4 |
| batch-management | BatchManagement | inventory | yes | no | P4 |
| batches | BatchManagement | inventory | no | no | P4 |
| pdc-summary | PDCManagement | banking | no | no | P3 |
| pdc-management | PDCManagement | banking | yes | no | P3 |
| bill-sundry | BillSundryMaster | masters | yes | no | P4 |
| bill-sundries | BillSundryMaster | other | no | no | P5 |
| sale-type | SaleTypeMaster | other | no | no | P5 |
| sale-types | SaleTypeMaster | other | no | no | P5 |
| purchase-type | PurchaseTypeMaster | transactions | no | no | P2 |
| purchase-types | PurchaseTypeMaster | transactions | no | no | P2 |
| tax-category | TaxCategoryMaster | other | no | no | P5 |
| tax-categories | TaxCategoryMaster | other | no | no | P5 |
| voucher-types | VoucherTypeMaster | transactions | no | no | P2 |
| voucher-series-config | VoucherTypeMaster | transactions | no | no | P2 |
| schemes | SchemeMaster | other | no | no | P5 |
| misc-masters | MiscMasters | masters | no | no | P4 |
| material-centres | MiscMasters | inventory | no | no | P4 |
| bill-of-material | MiscMasters | inventory | no | no | P4 |
| bom | MiscMasters | other | no | no | P5 |
| billing | BillingInvoice | transactions | yes | yes | P1 |
| sales-return | BillingInvoice | transactions | yes | yes | P2 |
| sales | SalesVoucher | transactions | no | no | P2 |
| delivery-challan | DeliveryChallan | transactions | yes | no | P2 |
| quotation | QuotationPage | transactions | no | no | P2 |
| sales-quotation | QuotationPage | transactions | no | no | P2 |
| sales-order | OrderVoucherPage | transactions | yes | no | P2 |
| purchase | PurchaseVoucher | transactions | yes | yes | P1 |
| purchase-return | BillingInvoice | transactions | yes | yes | P2 |
| goods-receipt | GoodsReceiptNote | transactions | yes | no | P2 |
| grn | GoodsReceiptNote | transactions | no | no | P2 |
| purchase-order | OrderVoucherPage | transactions | yes | no | P2 |
| purchase-quotation | QuotationPage | transactions | no | no | P2 |
| journal | JournalEntries | transactions | yes | yes | P1 |
| payment | PaymentVoucher | transactions | yes | yes | P1 |
| receipt | ReceiptVoucher | transactions | yes | yes | P1 |
| contra | ContraVoucher | transactions | yes | no | P2 |
| debit-note | DebitNoteVoucher | transactions | yes | no | P2 |
| credit-note | CreditNoteVoucher | transactions | yes | no | P2 |
| recurring-vouchers | RecurringVouchers | transactions | yes | no | P2 |
| stock-transfer | StockTransfer | inventory | yes | no | P4 |
| physical-stock | PhysicalStockPage2 | inventory | yes | no | P4 |
| stock-journal | StockJournalPage | transactions | yes | yes | P2 |
| production | ProductionPage | inventory | no | no | P4 |
| unassemble | UnassemblePage | other | no | no | P5 |
| material-issued | MaterialIssuedPage | inventory | no | no | P4 |
| material-out | MaterialIssuedPage | inventory | no | no | P4 |
| material-received | MaterialReceivedPage | inventory | no | no | P4 |
| material-in | MaterialReceivedPage | inventory | no | no | P4 |
| voucher-entry | VoucherEntryHub | transactions | yes | no | P2 |
| configuration-hub | ConfigurationHub | reports | yes | no | P3 |
| configuration | ConfigurationHub | reports | no | no | P3 |
| holidays | ConfigurationHub | other | no | no | P5 |
| communication-hub | CommunicationHub | settings | yes | no | P5 |
| communication | CommunicationHub | settings | no | no | P5 |
| cheque-register | ChequeRegister | banking | no | no | P3 |
| bank-statement-import | BankStatementImport | banking | no | yes | P1 |
| cheque-printing | ChequePrinting | banking | no | no | P3 |
| reversing-journals | ReversingJournals | transactions | no | no | P2 |
| reversing-journal | ReversingJournals | transactions | no | no | P2 |
| rejection-out | RejectionVoucherPage | other | no | no | P5 |
| rejection-in | RejectionVoucherPage | other | no | no | P5 |
| job-work-register | JobWorkRegister | reports | no | no | P3 |
| job-work-out-order | JobWorkRegister | transactions | no | no | P2 |
| job-work-in-order | JobWorkRegister | transactions | no | no | P2 |
| attendance-voucher | PayrollRun | transactions | no | no | P2 |
| attendance-entry | PayrollRun | other | no | no | P5 |
| balance-sheet | BalanceSheet | reports | yes | yes | P1 |
| profit-loss | ProfitLoss | reports | yes | yes | P1 |
| trial-balance | TrialBalance | reports | yes | yes | P1 |
| day-book | DayBook | reports | yes | yes | P1 |
| outstanding-receivables | OutstandingReceivables | reports | yes | no | P3 |
| outstanding-payables | OutstandingPayables | reports | yes | no | P3 |
| aging-report | AgingReport | reports | yes | no | P3 |
| interest-calculation | InterestCalculation | other | no | no | P5 |
| income-expenditure | IncomeExpenditureAccount | other | no | no | P5 |
| cash-flow | CashFlowStatement | reports | yes | no | P3 |
| ratio-analysis | RatioAnalysis | reports | yes | no | P3 |
| fixed-assets | FixedAssets | other | yes | no | P5 |
| budget-vs-actual | BudgetVsActual | masters | yes | no | P4 |
| ledger-report | GeneralLedger | reports | no | yes | P3 |
| ledger | GeneralLedger | reports | yes | yes | P1 |
| party-statement | PartyLedgerStatement | masters | yes | no | P4 |
| stock-summary | StockSummaryReport | inventory | yes | yes | P1 |
| stock-status | InventoryReport | inventory | no | no | P4 |
| closing-stock | InventoryReport | inventory | no | no | P4 |
| inventory-report | InventoryReport | inventory | no | no | P4 |
| stock-ledger | StockLedgerReport | inventory | yes | no | P4 |
| sales-analysis | SalesAnalysisReport | transactions | yes | no | P2 |
| vat-reports | VatReports | reports | yes | no | P3 |
| gstr1 | VatReports | other | no | no | P5 |
| gstr2 | VatReports | other | no | no | P5 |
| gstr3b | VatReports | other | no | no | P5 |
| gst-summary | VatReports | other | no | no | P5 |
| fiscal-year | FiscalYear | masters | yes | no | P4 |
| audit-log | AuditLog | compliance | yes | yes | P1 |
| accounts-configuration | AccountsConfiguration | masters | yes | no | P4 |
| inventory-config | InventoryConfiguration | inventory | yes | no | P4 |
| inventory-configuration | InventoryConfiguration | inventory | no | no | P4 |
| payroll | Payroll | other | yes | no | P5 |
| salary-process | Payroll | other | no | no | P5 |
| tds-report | TdsReport | reports | yes | no | P3 |
| tds-reports | TdsReport | reports | no | no | P3 |
| tds-certificate | TdsCertificatePage | compliance | no | no | P5 |
| bonus-provision | BonusProvision | other | no | no | P5 |
| gratuity-calculation | GratuityCalculation | other | no | no | P5 |
| pay-heads | PayHeadMaster | other | no | no | P5 |
| vat-classifications | VATClassificationMaster | reports | no | no | P3 |
| master-control-centre | MasterControlCentre | masters | no | no | P4 |
| users | UsersManagement | settings | yes | yes | P1 |
| users-management | UsersManagement | settings | no | yes | P5 |
| settings | CompanySettings | settings | yes | yes | P1 |
| company-settings | CompanySettings | settings | no | yes | P5 |
| sales-reconciliation | BackupRestore | transactions | no | no | P2 |
| backup | BackupRestore | settings | no | yes | P5 |
| backup-restore | BackupRestore | settings | yes | yes | P1 |
| data-import-export | DataExportImport | settings | no | no | P5 |
| data-export-import | DataExportImport | settings | no | no | P5 |
| bank-reconciliation | BankReconciliation | banking | no | yes | P1 |
| employees | EmployeeMaster | masters | no | no | P4 |
| employee-master | EmployeeMaster | masters | no | no | P4 |
| sales-register | SalesRegister | transactions | no | no | P2 |
| purchase-register | PurchaseRegister | transactions | no | no | P2 |
| cash-book | CashBook | other | no | no | P5 |
| bank-book | BankBook | banking | no | no | P3 |
