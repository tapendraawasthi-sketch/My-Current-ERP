// src/App.tsx
import React, { useEffect, useRef } from "react";
import { useStore } from "./store/useStore";
import { ToastProvider } from "@/design-system";
import { F12Provider } from "./hooks/useF12Config";
import F12Panel from "./components/F12Panel";
import Layout from "./components/Layout";
import ChartOfAccounts from "./components/ChartOfAccounts";
import Warehouses from "./pages/Warehouses";
import Units from "./pages/Units";
import CostCenters from "./pages/CostCenters";
import Parties from "./pages/Parties";
import StockBook from "./pages/StockBook";
import LedgerMaster from "./pages/LedgerMaster";
import PurchaseVoucher from "./pages/PurchaseVoucher";
import PaymentVoucher from "./pages/PaymentVoucher";
import ReceiptVoucher from "./pages/ReceiptVoucher";
import ContraVoucher from "./pages/ContraVoucher";
import DeliveryChallan from "./pages/DeliveryChallan";
import GoodsReceiptNote from "./pages/GoodsReceiptNote";
import StockTransfer from "./pages/StockTransfer";
import Quotation from "./pages/Quotation";
import SalesOrder from "./pages/SalesOrder";
import PurchaseOrder from "./pages/PurchaseOrder";
import BalanceSheet from "./pages/BalanceSheet";
import ProfitLoss from "./pages/ProfitLoss";
import TrialBalance from "./pages/TrialBalance";
import DayBook from "./pages/DayBook";
import OutstandingReceivables from "./pages/OutstandingReceivables";
import OutstandingPayables from "./pages/OutstandingPayables";
import AgingReport from "./pages/AgingReport";
import InterestCalculation from "./pages/InterestCalculation";
import StockSummary from "./pages/StockSummary";
import BudgetMaster from "./pages/BudgetMaster";
import FiscalYear from "./pages/FiscalYear";
import AuditLog from "./pages/AuditLog";
import IncomeExpenditureAccount from "./pages/IncomeExpenditureAccount";
import AccountsConfiguration from "./pages/AccountsConfiguration";
import SalesPersons from "./pages/SalesPersons";
import PriceLists from "./pages/PriceLists";
import UnitConversionMaster from "./pages/UnitConversionMaster";
import JournalEntries from "./pages/JournalEntries";
import DebitNoteVoucher from "./pages/DebitNoteVoucher";
import CreditNoteVoucher from "./pages/CreditNoteVoucher";
import PhysicalStockPage from "./pages/PhysicalStockPage";
import CashFlowStatement from "./pages/CashFlowStatement";
import RatioAnalysis from "./pages/RatioAnalysis";
import FixedAssetRegister from "./pages/FixedAssetRegister";
import PDCRegister from "./pages/PDCRegister";
import EmployeeLoans from "./pages/EmployeeLoans";
import NotesToAccounts from "./pages/NotesToAccounts";
import EquityStatement from "./pages/EquityStatement";
import FundsFlowStatement from "./pages/FundsFlowStatement";
import FixedAssets from "./pages/FixedAssets";
import BatchManagement from "./pages/BatchManagement";
import PDCManagement from "./pages/PDCManagement";
import Payroll from "./pages/Payroll";
import PayrollRun from "./pages/PayrollRun";
import BudgetVsActual from "./pages/BudgetVsActual";
import RecurringVouchers from "./pages/RecurringVouchers";
import FinancialDashboard from "./pages/FinancialDashboard";
import OrbixWorkspacePage from "./pages/OrbixWorkspacePage";
import GeneralLedger from "./pages/GeneralLedger";
import VatReports from "./pages/VatReports";
import BillingInvoice from "./pages/BillingInvoice";
import PartyStatement from "./pages/PartyStatement";
import InventoryConfiguration from "./pages/InventoryConfiguration";
import ItemGroupMaster from "./pages/ItemGroupMaster";
import StockJournalPage from "./pages/StockJournalPage";
import ProductionPage from "./pages/ProductionPage";
import InventoryReport from "./pages/InventoryReport";
import SignUpWizard from "./components/auth/SignUpWizard";
import InitErrorScreen from "./components/InitErrorScreen";
import GatewayScreen from "./components/auth/GatewayScreen";
import CompanyLoginScreen from "./components/auth/CompanyLoginScreen";
import { SessionRestoringScreen } from "./components/auth/AuthAccessSurfaces";
// import { TitleBar, StatusBar, CommandHintBar, ShortcutSidebar } from "./components/BusyShell";

// NEW BUSY FEATURE PAGES
import BillSundryMaster from "./pages/BillSundryMaster";
import SaleTypeMaster from "./pages/SaleTypeMaster";
import PurchaseTypeMaster from "./pages/PurchaseTypeMaster";
import TaxCategoryMaster from "./pages/TaxCategoryMaster";
import VoucherTypeMaster from "./pages/VoucherTypeMaster";
import StandardNarrationMaster from "./pages/StandardNarrationMaster";
import MiscMasters from "./pages/MiscMasters";
import SchemeMaster from "./pages/SchemeMaster";
import OrderVoucherPage from "./pages/OrderVoucherPage";
import QuotationPage from "./pages/QuotationPage";
import PhysicalStockPage2 from "./pages/PhysicalStockPage2";
import StockLedgerReport from "./pages/StockLedgerReport";
import SalesAnalysisReport from "./pages/SalesAnalysisReport";
import StockSummaryReport from "./pages/StockSummaryReport";
import TdsReport from "./pages/TdsReport";
import TdsCertificatePage from "./pages/TdsCertificatePage";
import BonusProvision from "./pages/BonusProvision";
import GratuityCalculation from "./pages/GratuityCalculation";
import PayHeadMaster from "./pages/PayHeadMaster";
import VATClassificationMaster from "./pages/VATClassificationMaster";
import MasterControlCentre from "./pages/MasterControlCentre";
import UsersManagement from "./pages/UsersManagement";
import CompanySettings from "./pages/CompanySettings";
import SalesReconciliationPanel from "./components/SalesReconciliationPanel";
import BankReconciliation from "./pages/BankReconciliation";
import EmployeeMaster from "./pages/EmployeeMaster";
import BackupRestore from "./pages/BackupRestore";
import DataExportImport from "./pages/DataExportImport";
import SalesRegister from "./pages/SalesRegister";
import PurchaseRegister from "./pages/PurchaseRegister";
import CashBook from "./pages/CashBook";
import BankBook from "./pages/BankBook";
import PartyLedgerStatement from "./pages/PartyLedgerStatement";
import VoucherEntryHub from "./pages/VoucherEntryHub";
import { TransactionRouteShell } from "./features/transactions";
import ConfigurationHub from "./pages/ConfigurationHub";
import CommunicationHub from "./pages/CommunicationHub";
import ChequeRegister from "./pages/ChequeRegister";
import BankStatementImport from "./pages/BankStatementImport";
import ChequePrinting from "./pages/ChequePrinting";
import MaterialIssuedPage from "./pages/MaterialIssuedPage";
import MaterialReceivedPage from "./pages/MaterialReceivedPage";
import UnassemblePage from "./pages/UnassemblePage";
import ReversingJournals from "./pages/ReversingJournals";
import RejectionVoucherPage from "./pages/RejectionVoucherPage";
import JobWorkRegister from "./pages/JobWorkRegister";

type AppProps = {
  onMounted?: () => void;
};

const App: React.FC<AppProps> = ({ onMounted }) => {
  const { currentPage, authStage, initializeApp, setCurrentPage } = useStore();

  const initCalledRef = useRef(false);
  useEffect(() => {
    onMounted?.();
  }, [onMounted]);

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setCurrentPage(customEvent.detail);
      }
    };
    window.addEventListener("navigate", handleNav);
    return () => window.removeEventListener("navigate", handleNav);
  }, [setCurrentPage]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setCurrentPage("balance-sheet");
      } else if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        setCurrentPage("trial-balance");
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setCurrentPage("ledger");
      } else if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        setCurrentPage("vat-reports");
      } else if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        setCurrentPage("users");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCurrentPage]);

  const renderAuthStage = () => {
    if (authStage === "checking") {
      return <SessionRestoringScreen />;
    }

    if (authStage === "error") {
      return <InitErrorScreen />;
    }

    if (authStage === "no-company") {
      return <SignUpWizard />;
    }

    if (authStage === "gateway") {
      return <GatewayScreen />;
    }

    if (authStage === "company-login") {
      return <CompanyLoginScreen />;
    }

    return (
      <F12Provider>
        <Layout>{renderPage()}</Layout>
        <F12Panel />
      </F12Provider>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      // ─── Dashboards ─────────────────────────────────────────────────────────────
      case "financial-dashboard":
      case "dashboard":
        return <FinancialDashboard />;

      case "orbix":
        return <OrbixWorkspacePage />;

      // New Modules
      case "pdc-register":
        return <PDCRegister />;
      case "employee-loans":
        return <EmployeeLoans />;
      case "notes-to-accounts":
        return <NotesToAccounts />;
      case "equity-statement":
        return <EquityStatement />;
      case "funds-flow":
      case "funds-flow-statement":
        return <FundsFlowStatement />;

      // Masters
      case "accounts":
      case "chart-of-accounts":
        return <ChartOfAccounts />;
      case "parties":
      case "party-master":
        return <Parties />;
      case "item-master":
      case "items":
      case "stock-book":
        return <StockBook />;
      case "item-groups":
      case "item-group-master":
        return <ItemGroupMaster />;
      case "warehouses":
        return <Warehouses />;
      case "units":
        return <Units />;
      case "unit-conversion":
      case "unit-conversions":
        return <UnitConversionMaster />;
      case "ledgers":
      case "ledger-master":
        return <LedgerMaster />;
      case "price-lists":
      case "price-list-master":
        return <PriceLists />;
      case "cost-centers":
      case "cost-centre":
        return <CostCenters />;
      case "sales-persons":
        return <SalesPersons />;
      case "standard-narration":
      case "standard-narrations":
        return <StandardNarrationMaster />;
      case "budget":
        return <BudgetMaster />;
      case "batch-management":
      case "batches":
        return <BatchManagement />;
      case "pdc-summary":
      case "pdc-management":
        return <PDCManagement />;

      // NEW BUSY MASTERS
      case "bill-sundry":
      case "bill-sundries":
        return <BillSundryMaster />;
      case "sale-type":
      case "sale-types":
        return <SaleTypeMaster />;
      case "purchase-type":
      case "purchase-types":
        return <PurchaseTypeMaster />;
      case "tax-category":
      case "tax-categories":
        return <TaxCategoryMaster />;
      case "voucher-types":
      case "voucher-series-config":
        return <VoucherTypeMaster />;
      case "schemes":
        return <SchemeMaster />;
      case "misc-masters":
      case "material-centres":
      case "bill-of-material":
      case "bom":
        return <MiscMasters />;

      // Sales Transactions
      case "sales":
      case "billing":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Sales invoice"
            description="Bill a customer."
          >
            <BillingInvoice />
          </TransactionRouteShell>
        );
      case "sales-return":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Sales return"
            description="Reverse or credit a sale."
          >
            <BillingInvoice />
          </TransactionRouteShell>
        );
      case "delivery-challan":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Delivery note"
            description="Goods sent to customer."
          >
            <DeliveryChallan />
          </TransactionRouteShell>
        );
      case "quotation":
      case "sales-quotation":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Quotation"
            description="Price offer."
          >
            <QuotationPage type="sales_quotation" />
          </TransactionRouteShell>
        );
      case "sales-order":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Sales order"
            description="Customer order before delivery."
          >
            <OrderVoucherPage type="sales_order" />
          </TransactionRouteShell>
        );

      // Purchase Transactions
      case "purchase":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Purchase invoice"
            description="Record a supplier bill."
          >
            <PurchaseVoucher />
          </TransactionRouteShell>
        );
      case "purchase-return":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Purchase return"
            description="Return goods to supplier."
          >
            <BillingInvoice />
          </TransactionRouteShell>
        );
      case "goods-receipt":
      case "grn":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Goods receipt"
            description="Stock received from supplier."
          >
            <GoodsReceiptNote />
          </TransactionRouteShell>
        );
      case "purchase-order":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Purchase order"
            description="Order placed with supplier."
          >
            <OrderVoucherPage type="purchase_order" />
          </TransactionRouteShell>
        );
      case "purchase-quotation":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Quotation"
            description="Price offer."
          >
            <QuotationPage type="purchase_quotation" />
          </TransactionRouteShell>
        );

      // Finance Vouchers
      case "journal":
        return (
          <TransactionRouteShell
            family="journal"
            mode="journal-document"
            title="Manual journal"
            description="Entries that are not sales or purchases."
          >
            <JournalEntries />
          </TransactionRouteShell>
        );
      case "payment":
        return (
          <TransactionRouteShell
            family="payment"
            mode="settlement-document"
            title="Pay money"
            description="Money paid to a party."
          >
            <PaymentVoucher />
          </TransactionRouteShell>
        );
      case "receipt":
        return (
          <TransactionRouteShell
            family="receipt"
            mode="settlement-document"
            title="Receive money"
            description="Money received from a party."
          >
            <ReceiptVoucher />
          </TransactionRouteShell>
        );
      case "contra":
        return (
          <TransactionRouteShell
            family="contra"
            mode="transfer-document"
            title="Transfer between accounts"
            description="Move money between cash/bank."
          >
            <ContraVoucher />
          </TransactionRouteShell>
        );
      case "debit-note":
        return (
          <TransactionRouteShell
            family="purchase"
            mode="inventory-document"
            title="Supplier credit note"
            description="Reduce what you owe a supplier."
          >
            <DebitNoteVoucher />
          </TransactionRouteShell>
        );
      case "credit-note":
        return (
          <TransactionRouteShell
            family="sales"
            mode="inventory-document"
            title="Customer credit note"
            description="Reduce what a customer owes you."
          >
            <CreditNoteVoucher />
          </TransactionRouteShell>
        );
      case "recurring-vouchers":
        return <RecurringVouchers />;

      // Inventory Vouchers
      case "stock-transfer":
        return <StockTransfer />;
      case "physical-stock":
        return <PhysicalStockPage2 />;
      case "stock-journal":
        return <StockJournalPage />;
      case "production":
        return <ProductionPage />;
      case "unassemble":
        return <UnassemblePage />;
      case "material-issued":
      case "material-out":
        return <MaterialIssuedPage />;
      case "material-received":
      case "material-in":
        return <MaterialReceivedPage />;
      case "voucher-entry":
        return <VoucherEntryHub />;
      case "configuration-hub":
      case "configuration":
      case "holidays":
        return <ConfigurationHub />;
      case "communication-hub":
      case "communication":
        return <CommunicationHub />;
      case "cheque-register":
        return <ChequeRegister />;
      case "bank-statement-import":
        return <BankStatementImport />;
      case "cheque-printing":
        return <ChequePrinting />;
      case "reversing-journals":
      case "reversing-journal":
        return <ReversingJournals />;
      case "rejection-out":
        return <RejectionVoucherPage mode="out" />;
      case "rejection-in":
        return <RejectionVoucherPage mode="in" />;
      case "job-work-register":
      case "job-work-out-order":
      case "job-work-in-order":
        return <JobWorkRegister defaultTab={currentPage === "job-work-in-order" ? "in" : "out"} />;
      case "attendance-voucher":
      case "attendance-entry":
        return <PayrollRun />;

      // Financial Reports
      case "balance-sheet":
        return <BalanceSheet />;
      case "profit-loss":
        return <ProfitLoss />;
      case "trial-balance":
        return <TrialBalance />;
      case "day-book":
        return <DayBook />;
      case "outstanding-receivables":
        return <OutstandingReceivables />;
      case "outstanding-payables":
        return <OutstandingPayables />;
      case "aging-report":
        return <AgingReport />;
      case "interest-calculation":
        return <InterestCalculation />;
      case "income-expenditure":
        return <IncomeExpenditureAccount />;
      case "cash-flow":
        return <CashFlowStatement />;
      case "ratio-analysis":
        return <RatioAnalysis />;
      case "fixed-assets":
        return <FixedAssets />;
      case "budget-vs-actual":
        return <BudgetVsActual />;
      case "ledger-report":
      case "ledger":
        return <GeneralLedger />;
      case "party-statement":
        return <PartyLedgerStatement />;

      // Inventory Reports
      case "stock-summary":
        return <StockSummaryReport />;
      case "stock-status":
      case "closing-stock":
      case "inventory-report":
        return <InventoryReport />;
      case "stock-ledger":
        return <StockLedgerReport />;
      case "sales-analysis":
        return <SalesAnalysisReport />;

      // GST / VAT Reports
      case "vat-reports":
      case "gstr1":
      case "gstr2":
      case "gstr3b":
      case "gst-summary":
        return <VatReports />;

      // Company / Utilities
      case "fiscal-year":
        return <FiscalYear />;
      case "audit-log":
        return <AuditLog />;
      case "accounts-configuration":
        return <AccountsConfiguration />;
      case "inventory-config":
      case "inventory-configuration":
        return <InventoryConfiguration />;
      case "payroll":
      case "salary-process":
        return <Payroll />;
      case "tds-report":
      case "tds-reports":
        return <TdsReport />;
      case "tds-certificate":
        return <TdsCertificatePage />;
      case "bonus-provision":
        return <BonusProvision />;
      case "gratuity-calculation":
        return <GratuityCalculation />;
      case "pay-heads":
        return <PayHeadMaster />;
      case "vat-classifications":
        return <VATClassificationMaster />;
      case "master-control-centre":
        return <MasterControlCentre />;
      case "users":
      case "users-management":
        return <UsersManagement />;
      case "settings":
      case "company-settings":
        return <CompanySettings />;
      case "sales-reconciliation":
        return (
          <div className="p-4">
            <SalesReconciliationPanel />
          </div>
        );
      case "backup":
      case "backup-restore":
        return <BackupRestore />;
      case "data-import-export":
      case "data-export-import":
        return <DataExportImport />;
      case "bank-reconciliation":
        return <BankReconciliation />;
      case "employees":
      case "employee-master":
        return <EmployeeMaster />;
      case "sales-register":
        return <SalesRegister />;
      case "purchase-register":
        return <PurchaseRegister />;
      case "cash-book":
        return <CashBook />;
      case "bank-book":
        return <BankBook />;

      default:
        return <FinancialDashboard />;
    }
  };

  return (
    <ToastProvider>
      {renderAuthStage()}
    </ToastProvider>
  );
};

export default App;
