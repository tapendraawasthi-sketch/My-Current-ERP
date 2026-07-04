// src/App.tsx
import React, { useEffect, useRef } from "react";
import { useStore } from "./store/useStore";
import { Toaster } from "react-hot-toast";
import { F12Provider } from "./hooks/useF12Config";
import Layout from "./components/Layout";
import ChartOfAccounts from "./components/ChartOfAccounts";
import Warehouses from "./pages/Warehouses";
import Units from "./pages/Units";
import CostCenters from "./pages/CostCenters";
import Parties from "./pages/Parties";
import StockBook from "./pages/StockBook";
import LedgerMaster from "./pages/LedgerMaster";
import SalesVoucher from "./pages/SalesVoucher";
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
import GatewayScreen from "./components/auth/GatewayScreen";
import CompanyLoginScreen from "./components/auth/CompanyLoginScreen";
import BusyMenuBar from "./components/BusyMenuBar";
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

const App: React.FC = () => {
  const { currentPage, authStage, initializeApp, setCurrentPage } = useStore();

  const initCalledRef = useRef(false);
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

  // Hard safety net: If we are stuck on checking for 10 seconds, force gateway
  useEffect(() => {
    if (authStage === "checking") {
      const timer = setTimeout(() => {
        console.error("App.tsx safety net: stuck in checking for 10s, forcing gateway");
        useStore.setState((state: any) => ({
          ...state,
          isInitializing: false,
          authStage: "gateway",
        }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [authStage]);

  if (authStage === "checking") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f5f6fa" }}
      >
        <div className="text-center">
          <div
            style={{
              width: 40,
              height: 40,
              border: "4px solid #1557b0",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
            className="mx-auto mb-4"
          />
          <p className="text-[12px] mt-1" style={{ color: "#6b7280" }}>
            Loading Sutra ERP…
          </p>
        </div>
      </div>
    );
  }

  if (authStage === "no-company")
    return (
      <>
        <Toaster position="bottom-right" />
        <SignUpWizard />
      </>
    );
  if (authStage === "gateway")
    return (
      <>
        <Toaster position="bottom-right" />
        <GatewayScreen />
      </>
    );
  if (authStage === "company-login")
    return (
      <>
        <Toaster position="bottom-right" />
        <CompanyLoginScreen />
      </>
    );

  const renderPage = () => {
    switch (currentPage) {
      // ─── Dashboards ─────────────────────────────────────────────────────────────
      case "financial-dashboard":
      case "dashboard":
        return <FinancialDashboard />;

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
      case "billing":
      case "sales-return":
        return <BillingInvoice />;
      case "sales":
        return <SalesVoucher />;
      case "delivery-challan":
        return <DeliveryChallan />;
      case "quotation":
      case "sales-quotation":
        return <QuotationPage type="sales_quotation" />;
      case "sales-order":
        return <OrderVoucherPage type="sales_order" />;

      // Purchase Transactions
      case "purchase":
      case "purchase-return":
        return <PurchaseVoucher />;
      case "goods-receipt":
      case "grn":
        return <GoodsReceiptNote />;
      case "purchase-order":
        return <OrderVoucherPage type="purchase_order" />;
      case "purchase-quotation":
        return <QuotationPage type="purchase_quotation" />;

      // Finance Vouchers
      case "journal":
        return <JournalEntries />;
      case "payment":
        return <PaymentVoucher />;
      case "receipt":
        return <ReceiptVoucher />;
      case "contra":
        return <ContraVoucher />;
      case "debit-note":
        return <DebitNoteVoucher />;
      case "credit-note":
        return <CreditNoteVoucher />;
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
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#1f2937",
            border: "1px solid #e5e7eb",
            fontSize: "12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          },
          success: {
            iconTheme: { primary: "#1557b0", secondary: "#ffffff" },
          },
          error: {
            iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
          },
        }}
      />
      <F12Provider>
        <Layout>
          <div className="flex flex-col h-full">
            <main className="flex-1 overflow-y-auto" style={{ background: "#f5f6fa" }}>
              {renderPage()}
            </main>
          </div>
        </Layout>
      </F12Provider>
    </>
  );
};

export default App;
