/**
 * Declarative page registry — incremental strangler over renderPage switch.
 *
 * Batch 1 (STEP 4.3): 10 high-traffic surfaces + aliases.
 * Batch 2: Daily-12 leftovers + GL / P&L / orders / contra / cash book.
 * Batch 3: returns, registers/books, party statement, stock summary, DC/GRN, AR/AP.
 * Batch 4: settings/users/FY, core masters, debit/credit notes, quotations, VAT.
 * Batch 5: Orbix, inventory vouchers, voucher/config hubs, cash-flow, aging, branches.
 * Batch 6 (final): all remaining masters / payroll / POS / misc — switch deleted.
 * renderPage consults this table first; AppPageRoutes registers matching <Route>s.
 */
import React from "react";
import Parties from "../pages/Parties";
import ItemMaster from "../pages/ItemMaster";
import BillingInvoice from "../pages/BillingInvoice";
import PurchaseVoucher from "../pages/PurchaseVoucher";
import PaymentVoucher from "../pages/PaymentVoucher";
import ReceiptVoucher from "../pages/ReceiptVoucher";
import JournalEntries from "../pages/JournalEntries";
import TrialBalance from "../pages/TrialBalance";
import BalanceSheet from "../pages/BalanceSheet";
import FinancialDashboard from "../pages/FinancialDashboard";
import ChartOfAccounts from "../components/ChartOfAccounts";
import DayBook from "../pages/DayBook";
import BankReconciliation from "../pages/BankReconciliation";
import SalesRegister from "../pages/SalesRegister";
import ProfitLoss from "../pages/ProfitLoss";
import GeneralLedger from "../pages/GeneralLedger";
import ContraVoucher from "../pages/ContraVoucher";
import OrderVoucherPage from "../pages/OrderVoucherPage";
import CashBook from "../pages/CashBook";
import PurchaseRegister from "../pages/PurchaseRegister";
import BankBook from "../pages/BankBook";
import PartyLedgerStatement from "../pages/PartyLedgerStatement";
import StockSummaryReport from "../pages/StockSummaryReport";
import DeliveryChallan from "../pages/DeliveryChallan";
import GoodsReceiptNote from "../pages/GoodsReceiptNote";
import OutstandingReceivables from "../pages/OutstandingReceivables";
import OutstandingPayables from "../pages/OutstandingPayables";
import CompanySettings from "../pages/CompanySettings";
import FiscalYear from "../pages/FiscalYear";
import UsersManagement from "../pages/UsersManagement";
import LedgerMaster from "../pages/LedgerMaster";
import Warehouses from "../pages/Warehouses";
import Units from "../pages/Units";
import DebitNoteVoucher from "../pages/DebitNoteVoucher";
import CreditNoteVoucher from "../pages/CreditNoteVoucher";
import QuotationPage from "../pages/QuotationPage";
import VatReports from "../pages/VatReports";
import OrbixWorkspacePage from "../pages/OrbixWorkspacePage";
import StockTransfer from "../pages/StockTransfer";
import PhysicalStockPage2 from "../pages/PhysicalStockPage2";
import StockJournalPage from "../pages/StockJournalPage";
import ProductionPage from "../pages/ProductionPage";
import VoucherEntryHub from "../pages/VoucherEntryHub";
import ConfigurationHub from "../pages/ConfigurationHub";
import CashFlowStatement from "../pages/CashFlowStatement";
import AgingReport from "../pages/AgingReport";
import BranchMaster from "../pages/BranchMaster";
import CostCenters from "../pages/CostCenters";
import StockBook from "../pages/StockBook";
import POSBilling from "../pages/POSBilling";
import InterestCalculation from "../pages/InterestCalculation";
import BudgetMaster from "../pages/BudgetMaster";
import AuditLog from "../pages/AuditLog";
import IncomeExpenditureAccount from "../pages/IncomeExpenditureAccount";
import AccountsConfiguration from "../pages/AccountsConfiguration";
import SalesPersons from "../pages/SalesPersons";
import PriceLists from "../pages/PriceLists";
import UnitConversionMaster from "../pages/UnitConversionMaster";
import RatioAnalysis from "../pages/RatioAnalysis";
import PDCRegister from "../pages/PDCRegister";
import EmployeeLoans from "../pages/EmployeeLoans";
import NotesToAccounts from "../pages/NotesToAccounts";
import EquityStatement from "../pages/EquityStatement";
import FundsFlowStatement from "../pages/FundsFlowStatement";
import FixedAssets from "../pages/FixedAssets";
import BatchManagement from "../pages/BatchManagement";
import PDCManagement from "../pages/PDCManagement";
import Payroll from "../pages/Payroll";
import PayrollRun from "../pages/PayrollRun";
import F11CompanyFeatures from "../pages/F11CompanyFeatures";
import BudgetVsActual from "../pages/BudgetVsActual";
import RecurringVouchers from "../pages/RecurringVouchers";
import InventoryConfiguration from "../pages/InventoryConfiguration";
import ItemGroupMaster from "../pages/ItemGroupMaster";
import InventoryReport from "../pages/InventoryReport";
import BillSundryMaster from "../pages/BillSundryMaster";
import SaleTypeMaster from "../pages/SaleTypeMaster";
import PurchaseTypeMaster from "../pages/PurchaseTypeMaster";
import TaxCategoryMaster from "../pages/TaxCategoryMaster";
import VoucherTypeMaster from "../pages/VoucherTypeMaster";
import StandardNarrationMaster from "../pages/StandardNarrationMaster";
import MiscMasters from "../pages/MiscMasters";
import SchemeMaster from "../pages/SchemeMaster";
import StockLedgerReport from "../pages/StockLedgerReport";
import SalesAnalysisReport from "../pages/SalesAnalysisReport";
import TdsReport from "../pages/TdsReport";
import TdsCertificatePage from "../pages/TdsCertificatePage";
import BonusProvision from "../pages/BonusProvision";
import GratuityCalculation from "../pages/GratuityCalculation";
import PayHeadMaster from "../pages/PayHeadMaster";
import VATClassificationMaster from "../pages/VATClassificationMaster";
import MasterControlCentre from "../pages/MasterControlCentre";
import SalesReconciliationPanel from "../components/SalesReconciliationPanel";
import EmployeeMaster from "../pages/EmployeeMaster";
import BackupRestore from "../pages/BackupRestore";
import DataExportImport from "../pages/DataExportImport";
import CommunicationHub from "../pages/CommunicationHub";
import ChequeRegister from "../pages/ChequeRegister";
import BankStatementImport from "../pages/BankStatementImport";
import ChequePrinting from "../pages/ChequePrinting";
import PrintSettings from "../pages/PrintSettings";
import MaterialIssuedPage from "../pages/MaterialIssuedPage";
import MaterialReceivedPage from "../pages/MaterialReceivedPage";
import UnassemblePage from "../pages/UnassemblePage";
import ReversingJournals from "../pages/ReversingJournals";
import RejectionVoucherPage from "../pages/RejectionVoucherPage";
import JobWorkRegister from "../pages/JobWorkRegister";
import BranchReports from "../pages/BranchReports";
import StatutoryCompliance from "../pages/StatutoryCompliance";
import AdvancedTaxCompliance from "../pages/AdvancedTaxCompliance";
import ScenarioMaster from "../pages/ScenarioMaster";
import { TransactionRouteShell } from "../features/transactions";

export type PageElementFactory = () => React.ReactNode;

/** Canonical page ids migrated in batch 1 (unique surfaces). */
export const DECLARATIVE_BATCH_1: readonly string[] = [
  "dashboard",
  "parties",
  "items",
  "billing",
  "purchase",
  "payment",
  "receipt",
  "journal",
  "trial-balance",
  "balance-sheet",
] as const;

/** Canonical page ids migrated in batch 2 (unique surfaces). */
export const DECLARATIVE_BATCH_2: readonly string[] = [
  "accounts",
  "day-book",
  "bank-reconciliation",
  "sales-register",
  "profit-loss",
  "ledger",
  "contra",
  "sales-order",
  "purchase-order",
  "cash-book",
] as const;

/** Canonical page ids migrated in batch 3 (unique surfaces). */
export const DECLARATIVE_BATCH_3: readonly string[] = [
  "sales-return",
  "purchase-return",
  "purchase-register",
  "bank-book",
  "party-statement",
  "stock-summary",
  "delivery-challan",
  "goods-receipt",
  "outstanding-receivables",
  "outstanding-payables",
] as const;

/** Canonical page ids migrated in batch 4 (unique surfaces). */
export const DECLARATIVE_BATCH_4: readonly string[] = [
  "settings",
  "fiscal-year",
  "users",
  "ledgers",
  "warehouses",
  "units",
  "debit-note",
  "credit-note",
  "quotation",
  "vat-reports",
] as const;

/** Canonical page ids migrated in batch 5 (unique surfaces). */
export const DECLARATIVE_BATCH_5: readonly string[] = [
  "orbix",
  "stock-transfer",
  "physical-stock",
  "stock-journal",
  "production",
  "voucher-entry",
  "configuration-hub",
  "cash-flow",
  "aging-report",
  "branch-master",
] as const;

/** Final remaining surfaces (batch 6) — completes switch deletion. */
export const DECLARATIVE_BATCH_6: readonly string[] = [
  "pdc-register",
  "employee-loans",
  "notes-to-accounts",
  "equity-statement",
  "funds-flow",
  "stock-book",
  "item-groups",
  "unit-conversion",
  "price-lists",
  "cost-centers",
  "sales-persons",
  "standard-narration",
  "budget",
  "batch-management",
  "pdc-management",
  "bill-sundry",
  "sale-type",
  "purchase-type",
  "tax-category",
  "voucher-types",
  "schemes",
  "misc-masters",
  "recurring-vouchers",
  "unassemble",
  "material-issued",
  "material-received",
  "communication-hub",
  "cheque-register",
  "bank-statement-import",
  "cheque-printing",
  "print-settings",
  "reversing-journals",
  "rejection-out",
  "rejection-in",
  "job-work-register",
  "branch-reports",
  "statutory-compliance",
  "advanced-tax",
  "scenario-master",
  "attendance-voucher",
  "interest-calculation",
  "income-expenditure",
  "ratio-analysis",
  "fixed-assets",
  "budget-vs-actual",
  "inventory-report",
  "stock-ledger",
  "sales-analysis",
  "audit-log",
  "accounts-configuration",
  "inventory-config",
  "payroll",
  "f11-company-features",
  "tds-report",
  "tds-certificate",
  "bonus-provision",
  "gratuity-calculation",
  "pay-heads",
  "vat-classifications",
  "master-control-centre",
  "sales-reconciliation",
  "backup",
  "data-import-export",
  "pos",
  "employees",
] as const;

const shellSalesBilling = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Sales invoice"
    description="Bill a customer."
  >
    <BillingInvoice />
  </TransactionRouteShell>
);

const shellPurchase = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Purchase invoice"
    description="Record a supplier bill."
  >
    <PurchaseVoucher />
  </TransactionRouteShell>
);

const shellPayment = () => (
  <TransactionRouteShell
    family="payment"
    mode="settlement-document"
    title="Pay money"
    description="Money paid to a party."
  >
    <PaymentVoucher />
  </TransactionRouteShell>
);

const shellReceipt = () => (
  <TransactionRouteShell
    family="receipt"
    mode="settlement-document"
    title="Receive money"
    description="Money received from a party."
  >
    <ReceiptVoucher />
  </TransactionRouteShell>
);

const shellJournal = () => (
  <TransactionRouteShell
    family="journal"
    mode="journal-document"
    title="Manual journal"
    description="Entries that are not sales or purchases."
  >
    <JournalEntries />
  </TransactionRouteShell>
);

const shellContra = () => (
  <TransactionRouteShell
    family="contra"
    mode="transfer-document"
    title="Transfer between accounts"
    description="Move money between cash/bank."
  >
    <ContraVoucher />
  </TransactionRouteShell>
);

const shellSalesOrder = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Sales order"
    description="Customer order before delivery."
  >
    <OrderVoucherPage type="sales_order" />
  </TransactionRouteShell>
);

const shellPurchaseOrder = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Purchase order"
    description="Order placed with supplier."
  >
    <OrderVoucherPage type="purchase_order" />
  </TransactionRouteShell>
);

const shellSalesReturn = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Sales return"
    description="Reverse or credit a sale."
  >
    <BillingInvoice />
  </TransactionRouteShell>
);

const shellPurchaseReturn = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Purchase return"
    description="Return goods to supplier."
  >
    <BillingInvoice />
  </TransactionRouteShell>
);

const shellDeliveryChallan = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Delivery note"
    description="Goods sent to customer."
  >
    <DeliveryChallan />
  </TransactionRouteShell>
);

const shellGoodsReceipt = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Goods receipt"
    description="Stock received from supplier."
  >
    <GoodsReceiptNote />
  </TransactionRouteShell>
);

const shellDebitNote = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Supplier credit note"
    description="Reduce what you owe a supplier."
  >
    <DebitNoteVoucher />
  </TransactionRouteShell>
);

const shellCreditNote = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Customer credit note"
    description="Reduce what a customer owes you."
  >
    <CreditNoteVoucher />
  </TransactionRouteShell>
);

const shellSalesQuotation = () => (
  <TransactionRouteShell
    family="sales"
    mode="inventory-document"
    title="Quotation"
    description="Price offer."
  >
    <QuotationPage type="sales_quotation" />
  </TransactionRouteShell>
);

const shellPurchaseQuotation = () => (
  <TransactionRouteShell
    family="purchase"
    mode="inventory-document"
    title="Quotation"
    description="Price offer."
  >
    <QuotationPage type="purchase_quotation" />
  </TransactionRouteShell>
);

/**
 * pageId → element. Includes aliases so setCurrentPage("party-master")
 * and /app/party-master both resolve without the giant switch.
 */
export const DECLARATIVE_PAGE_ELEMENTS: Record<string, PageElementFactory> = {
  // ── Batch 1 ──
  dashboard: () => <FinancialDashboard />,
  "financial-dashboard": () => <FinancialDashboard />,
  parties: () => <Parties />,
  "party-master": () => <Parties />,
  items: () => <ItemMaster />,
  "item-master": () => <ItemMaster />,
  billing: shellSalesBilling,
  sales: shellSalesBilling,
  purchase: shellPurchase,
  payment: shellPayment,
  receipt: shellReceipt,
  journal: shellJournal,
  "trial-balance": () => <TrialBalance />,
  "balance-sheet": () => <BalanceSheet />,

  // ── Batch 2 ──
  accounts: () => <ChartOfAccounts />,
  "chart-of-accounts": () => <ChartOfAccounts />,
  "day-book": () => <DayBook />,
  "bank-reconciliation": () => <BankReconciliation />,
  "smart-bank-reconciliation": () => <BankReconciliation />,
  "auto-bank-reconciliation": () => <BankReconciliation />,
  "banking-hub": () => <BankReconciliation />,
  "sales-register": () => <SalesRegister />,
  "profit-loss": () => <ProfitLoss />,
  ledger: () => <GeneralLedger />,
  "ledger-report": () => <GeneralLedger />,
  contra: shellContra,
  "sales-order": shellSalesOrder,
  "purchase-order": shellPurchaseOrder,
  "cash-book": () => <CashBook />,

  // ── Batch 3 ──
  "sales-return": shellSalesReturn,
  "purchase-return": shellPurchaseReturn,
  "purchase-register": () => <PurchaseRegister />,
  "bank-book": () => <BankBook />,
  "party-statement": () => <PartyLedgerStatement />,
  "stock-summary": () => <StockSummaryReport />,
  "delivery-challan": shellDeliveryChallan,
  "goods-receipt": shellGoodsReceipt,
  grn: shellGoodsReceipt,
  "outstanding-receivables": () => <OutstandingReceivables />,
  "outstanding-management": () => <OutstandingReceivables />,
  debtors: () => <OutstandingReceivables />,
  "outstanding-payables": () => <OutstandingPayables />,
  creditors: () => <OutstandingPayables />,

  // ── Batch 4 ──
  settings: () => <CompanySettings />,
  "company-settings": () => <CompanySettings />,
  "fiscal-year": () => <FiscalYear />,
  users: () => <UsersManagement />,
  "users-management": () => <UsersManagement />,
  ledgers: () => <LedgerMaster />,
  "ledger-master": () => <LedgerMaster />,
  warehouses: () => <Warehouses />,
  units: () => <Units />,
  "debit-note": shellDebitNote,
  "credit-note": shellCreditNote,
  quotation: shellSalesQuotation,
  "sales-quotation": shellSalesQuotation,
  "purchase-quotation": shellPurchaseQuotation,
  "vat-reports": () => <VatReports />,
  gstr1: () => <VatReports />,
  gstr2: () => <VatReports />,
  gstr3b: () => <VatReports />,
  "gst-summary": () => <VatReports />,

  // ── Batch 5 ──
  orbix: () => <OrbixWorkspacePage />,
  "stock-transfer": () => <StockTransfer />,
  "physical-stock": () => <PhysicalStockPage2 />,
  "stock-journal": () => <StockJournalPage />,
  production: () => <ProductionPage />,
  "voucher-entry": () => <VoucherEntryHub />,
  "configuration-hub": () => <ConfigurationHub />,
  configuration: () => <ConfigurationHub />,
  holidays: () => <ConfigurationHub />,
  "cash-flow": () => <CashFlowStatement />,
  "aging-report": () => <AgingReport />,
  "debtors-aging": () => <AgingReport />,
  "creditors-aging": () => <AgingReport />,
  "branch-master": () => <BranchMaster />,
  branches: () => <BranchMaster />,

  // ── Batch 6 (final remaining) ──
  "pdc-register": () => <PDCRegister />,
  "employee-loans": () => <EmployeeLoans />,
  "notes-to-accounts": () => <NotesToAccounts />,
  "equity-statement": () => <EquityStatement />,
  "funds-flow": () => <FundsFlowStatement />,
  "funds-flow-statement": () => <FundsFlowStatement />,
  "stock-book": () => <StockBook />,
  "item-groups": () => <ItemGroupMaster />,
  "item-group-master": () => <ItemGroupMaster />,
  "unit-conversion": () => <UnitConversionMaster />,
  "unit-conversions": () => <UnitConversionMaster />,
  "price-lists": () => <PriceLists />,
  "price-list-master": () => <PriceLists />,
  "cost-centers": () => <CostCenters />,
  "cost-centre": () => <CostCenters />,
  "sales-persons": () => <SalesPersons />,
  "standard-narration": () => <StandardNarrationMaster />,
  "standard-narrations": () => <StandardNarrationMaster />,
  budget: () => <BudgetMaster />,
  "batch-management": () => <BatchManagement />,
  batches: () => <BatchManagement />,
  "pdc-summary": () => <PDCManagement />,
  "pdc-management": () => <PDCManagement />,
  "bill-sundry": () => <BillSundryMaster />,
  "bill-sundries": () => <BillSundryMaster />,
  "sale-type": () => <SaleTypeMaster />,
  "sale-types": () => <SaleTypeMaster />,
  "purchase-type": () => <PurchaseTypeMaster />,
  "purchase-types": () => <PurchaseTypeMaster />,
  "tax-category": () => <TaxCategoryMaster />,
  "tax-categories": () => <TaxCategoryMaster />,
  "voucher-types": () => <VoucherTypeMaster />,
  "voucher-series-config": () => <VoucherTypeMaster />,
  schemes: () => <SchemeMaster />,
  "misc-masters": () => <MiscMasters />,
  "material-centres": () => <MiscMasters />,
  "bill-of-material": () => <MiscMasters />,
  bom: () => <MiscMasters />,
  "recurring-vouchers": () => <RecurringVouchers />,
  unassemble: () => <UnassemblePage />,
  "material-issued": () => <MaterialIssuedPage />,
  "material-out": () => <MaterialIssuedPage />,
  "material-received": () => <MaterialReceivedPage />,
  "material-in": () => <MaterialReceivedPage />,
  "communication-hub": () => <CommunicationHub />,
  communication: () => <CommunicationHub />,
  "cheque-register": () => <ChequeRegister />,
  "bank-statement-import": () => <BankStatementImport />,
  "cheque-printing": () => <ChequePrinting />,
  "print-settings": () => <PrintSettings />,
  "print-config": () => <PrintSettings />,
  "print-configuration": () => <PrintSettings />,
  "reversing-journals": () => <ReversingJournals />,
  "reversing-journal": () => <ReversingJournals />,
  "rejection-out": () => <RejectionVoucherPage mode="out" />,
  "rejection-in": () => <RejectionVoucherPage mode="in" />,
  "job-work-register": () => <JobWorkRegister defaultTab="out" />,
  "job-work-out-order": () => <JobWorkRegister defaultTab="out" />,
  "job-work-in-order": () => <JobWorkRegister defaultTab="in" />,
  "branch-reports": () => <BranchReports />,
  "branch-report": () => <BranchReports />,
  "statutory-compliance": () => <StatutoryCompliance />,
  "advanced-tax": () => <AdvancedTaxCompliance />,
  "advanced-tax-compliance": () => <AdvancedTaxCompliance />,
  "scenario-master": () => <ScenarioMaster />,
  scenarios: () => <ScenarioMaster />,
  "attendance-voucher": () => <PayrollRun />,
  "attendance-entry": () => <PayrollRun />,
  "interest-calculation": () => <InterestCalculation />,
  "income-expenditure": () => <IncomeExpenditureAccount />,
  "ratio-analysis": () => <RatioAnalysis />,
  "fixed-assets": () => <FixedAssets />,
  "budget-vs-actual": () => <BudgetVsActual />,
  "stock-status": () => <InventoryReport />,
  "closing-stock": () => <InventoryReport />,
  "inventory-report": () => <InventoryReport />,
  "stock-ledger": () => <StockLedgerReport />,
  "sales-analysis": () => <SalesAnalysisReport />,
  "audit-log": () => <AuditLog />,
  "accounts-configuration": () => <AccountsConfiguration />,
  "inventory-config": () => <InventoryConfiguration />,
  "inventory-configuration": () => <InventoryConfiguration />,
  payroll: () => <Payroll />,
  "salary-process": () => <Payroll />,
  "payroll-processing": () => <Payroll />,
  "f11-company-features": () => <F11CompanyFeatures />,
  "company-features": () => <F11CompanyFeatures />,
  "tds-report": () => <TdsReport />,
  "tds-reports": () => <TdsReport />,
  "tds-certificate": () => <TdsCertificatePage />,
  "bonus-provision": () => <BonusProvision />,
  "gratuity-calculation": () => <GratuityCalculation />,
  "pay-heads": () => <PayHeadMaster />,
  "vat-classifications": () => <VATClassificationMaster />,
  "master-control-centre": () => <MasterControlCentre />,
  "sales-reconciliation": () => (
    <div className="p-4">
      <SalesReconciliationPanel />
    </div>
  ),
  backup: () => <BackupRestore />,
  "backup-restore": () => <BackupRestore />,
  "data-import-export": () => <DataExportImport />,
  "data-export-import": () => <DataExportImport />,
  pos: () => <POSBilling />,
  "pos-mode": () => <POSBilling />,
  "pos-billing": () => <POSBilling />,
  employees: () => <EmployeeMaster />,
  "employee-master": () => <EmployeeMaster />,
};

/** All pageIds that have an explicit <Route> (canonical + aliases). */
export const DECLARATIVE_ROUTE_PAGE_IDS: readonly string[] = Object.keys(
  DECLARATIVE_PAGE_ELEMENTS,
);

export function renderDeclarativePage(pageId: string): React.ReactNode | null {
  const factory = DECLARATIVE_PAGE_ELEMENTS[pageId];
  return factory ? factory() : null;
}

export function isDeclarativePage(pageId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DECLARATIVE_PAGE_ELEMENTS, pageId);
}
