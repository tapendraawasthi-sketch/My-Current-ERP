import React, { useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import { Toaster } from "react-hot-toast";
import { Loader2, Keyboard } from "lucide-react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import Layout from "./components/Layout";
import AuthGateway from "./pages/AuthGateway";
import Dashboard from "./components/Dashboard";
import ChartOfAccounts from "./components/ChartOfAccounts";
import PartiesDirectory from "./components/PartiesDirectory";
import StockBook from "./pages/StockBook";
import JournalEntries from "./pages/JournalEntries";
import PaymentVoucher from "./pages/PaymentVoucher";
import ReceiptVoucher from "./pages/ReceiptVoucher";
import ContraVoucher from "./pages/ContraVoucher";
import VouchersRegister from "./components/VouchersRegister";
import BillingInvoice from "./pages/BillingInvoice";
import DebitCreditNote from "./pages/DebitCreditNote";
import SalesOrder from "./pages/SalesOrder";
import PurchaseOrder from "./pages/PurchaseOrder";
import StockJournalPage from "./pages/StockJournalPage";
import GeneralLedger from "./pages/GeneralLedger";
import TrialBalance from "./pages/TrialBalance";
import ProfitLoss from "./pages/ProfitLoss";
import BalanceSheet from "./pages/BalanceSheet";
import CashFlowStatement from "./pages/CashFlowStatement";
import VatReports from "./pages/VatReports";
import AgingReport from "./pages/AgingReport";
import PartyLedgerStatement from "./pages/PartyLedgerStatement";
import DayBook from "./pages/DayBook";
import CashBook from "./pages/CashBook";
import BankBook from "./pages/BankBook";
import InventoryReport from "./pages/InventoryReport";
import StockSummary from "./pages/StockSummary";
import SystemSettings from "./components/SystemSettings";
import CompanySettings from "./pages/CompanySettings";
import FiscalYear from "./pages/FiscalYear";
import UsersManagement from "./pages/UsersManagement";
import AuditLog from "./pages/AuditLog";
import ApprovalQueue from "./pages/ApprovalQueue";
import BackupRestore from "./pages/BackupRestore";
import OpeningBalance from "./pages/OpeningBalance";
import TdsReport from "./pages/TdsReport";
import TdsPayment from "./pages/TdsPayment";
import BankReconciliation from "./pages/BankReconciliation";
import CostCenters from "./pages/CostCenters";
import CostCenterReport from "./pages/CostCenterReport";
import BillWisePending from "./pages/BillWisePending";
import BudgetMaster from "./pages/BudgetMaster";
import BudgetVsActual from "./pages/BudgetVsActual";
import DeliveryChallan from "./pages/DeliveryChallan";
import GoodsReceiptNote from "./pages/GoodsReceiptNote";
import Warehouses from "./pages/Warehouses";
import Units from "./pages/Units";
import BankAccountsPage from "./pages/BankAccountsPage";
import RecurringVouchers from "./pages/RecurringVouchers";
import POSMode from "./pages/POSMode";
import EmployeeMaster from "./pages/EmployeeMaster";
import BankStatementImport from "./pages/BankStatementImport";
import OverdueBillsInterest from "./pages/OverdueBillsInterest";
import DataImport from "./pages/DataImport";
import DataExport from "./pages/DataExport";
import BillSundryPage from "./pages/BillSundry";
import StandardNarrationsPage from "./pages/StandardNarrations";
import InterestSlabConfig from "./pages/InterestSlabConfig";
import FixedAssets from "./pages/FixedAssets";
import DepreciationChart from "./pages/DepreciationChart";
import BillOfMaterialPage from "./pages/BillOfMaterial";
import ProductionVoucherPage from "./pages/ProductionVoucher";
import PhysicalStockPage from "./pages/PhysicalStock";
import CbmsLog from "./pages/CbmsLog";
import CurrencyMaster from "./pages/CurrencyMaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import KeyboardShortcutsHelp from "./components/ui/KeyboardShortcutsHelp";

function MainRouter() {
  const { currentPage } = useStore();

  switch (currentPage) {
    case "dashboard":
      return (
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      );
    case "accounts":
      return (
        <ErrorBoundary>
          <ChartOfAccounts />
        </ErrorBoundary>
      );
    case "journal":
      return (
        <ErrorBoundary>
          <JournalEntries />
        </ErrorBoundary>
      );
    case "payment":
      return (
        <ErrorBoundary>
          <PaymentVoucher />
        </ErrorBoundary>
      );
    case "receipt":
      return (
        <ErrorBoundary>
          <ReceiptVoucher />
        </ErrorBoundary>
      );
    case "contra":
      return (
        <ErrorBoundary>
          <ContraVoucher />
        </ErrorBoundary>
      );
    case "sales-invoice":
    case "purchase-invoice":
    case "sales-return":
    case "purchase-return":
    case "billing":
      return (
        <ErrorBoundary>
          <BillingInvoice />
        </ErrorBoundary>
      );
    case "debit-note":
    case "credit-note":
      return (
        <ErrorBoundary>
          <DebitCreditNote />
        </ErrorBoundary>
      );
    case "sales-order":
      return (
        <ErrorBoundary>
          <SalesOrder />
        </ErrorBoundary>
      );
    case "purchase-order":
      return (
        <ErrorBoundary>
          <PurchaseOrder />
        </ErrorBoundary>
      );
    case "delivery-challan":
      return (
        <ErrorBoundary>
          <DeliveryChallan />
        </ErrorBoundary>
      );
    case "grn":
      return (
        <ErrorBoundary>
          <GoodsReceiptNote />
        </ErrorBoundary>
      );
    case "stock-journal":
      return (
        <ErrorBoundary>
          <StockJournalPage />
        </ErrorBoundary>
      );
    case "opening-balance":
      return (
        <ErrorBoundary>
          <OpeningBalance />
        </ErrorBoundary>
      );
    case "ledger":
      return (
        <ErrorBoundary>
          <GeneralLedger />
        </ErrorBoundary>
      );
    case "ledgers":
      return (
        <ErrorBoundary>
          <ChartOfAccounts />
        </ErrorBoundary>
      );
    case "trial-balance":
      return (
        <ErrorBoundary>
          <TrialBalance />
        </ErrorBoundary>
      );
    case "profit-loss":
      return (
        <ErrorBoundary>
          <ProfitLoss />
        </ErrorBoundary>
      );
    case "balance-sheet":
      return (
        <ErrorBoundary>
          <BalanceSheet />
        </ErrorBoundary>
      );
    case "cash-flow":
      return (
        <ErrorBoundary>
          <CashFlowStatement />
        </ErrorBoundary>
      );
    case "day-book":
      return (
        <ErrorBoundary>
          <DayBook />
        </ErrorBoundary>
      );
    case "cash-book":
      return (
        <ErrorBoundary>
          <CashBook />
        </ErrorBoundary>
      );
    case "bank-book":
      return (
        <ErrorBoundary>
          <BankBook />
        </ErrorBoundary>
      );
    case "sales-register":
    case "purchase-register":
      return (
        <ErrorBoundary>
          <VouchersRegister />
        </ErrorBoundary>
      );
    case "vouchers":
      return (
        <ErrorBoundary>
          <VouchersRegister />
        </ErrorBoundary>
      );
    case "parties":
      return (
        <ErrorBoundary>
          <PartiesDirectory />
        </ErrorBoundary>
      );
    case "items":
      return (
        <ErrorBoundary>
          <StockBook />
        </ErrorBoundary>
      );
    case "warehouses":
      return (
        <ErrorBoundary>
          <Warehouses />
        </ErrorBoundary>
      );
    case "units":
      return (
        <ErrorBoundary>
          <Units />
        </ErrorBoundary>
      );
    case "cost-centers":
      return (
        <ErrorBoundary>
          <CostCenters />
        </ErrorBoundary>
      );
    case "bill-sundry":
      return (
        <ErrorBoundary>
          <BillSundryPage />
        </ErrorBoundary>
      );
    case "standard-narrations":
      return (
        <ErrorBoundary>
          <StandardNarrationsPage />
        </ErrorBoundary>
      );
    case "cost-center-report":
      return (
        <ErrorBoundary>
          <CostCenterReport />
        </ErrorBoundary>
      );
    case "bank-accounts":
      return (
        <ErrorBoundary>
          <BankAccountsPage />
        </ErrorBoundary>
      );
    case "bank-reconciliation":
      return (
        <ErrorBoundary>
          <BankReconciliation />
        </ErrorBoundary>
      );
    case "vat-reports":
      return (
        <ErrorBoundary>
          <VatReports />
        </ErrorBoundary>
      );
    case "tds-report":
      return (
        <ErrorBoundary>
          <TdsReport />
        </ErrorBoundary>
      );
    case "tds-payment":
      return (
        <ErrorBoundary>
          <TdsPayment />
        </ErrorBoundary>
      );
    case "aging-report":
      return (
        <ErrorBoundary>
          <AgingReport />
        </ErrorBoundary>
      );
    case "party-statement":
      return (
        <ErrorBoundary>
          <PartyLedgerStatement />
        </ErrorBoundary>
      );
    case "bill-pending":
      return (
        <ErrorBoundary>
          <BillWisePending />
        </ErrorBoundary>
      );
    case "budget":
      return (
        <ErrorBoundary>
          <BudgetMaster />
        </ErrorBoundary>
      );
    case "budget-vs-actual":
      return (
        <ErrorBoundary>
          <BudgetVsActual />
        </ErrorBoundary>
      );
    case "inventory-report":
      return (
        <ErrorBoundary>
          <InventoryReport />
        </ErrorBoundary>
      );
    case "stock-summary":
      return (
        <ErrorBoundary>
          <StockSummary />
        </ErrorBoundary>
      );
    case "settings":
      return (
        <ErrorBoundary>
          <CompanySettings />
        </ErrorBoundary>
      );
    case "fiscal-year":
      return (
        <ErrorBoundary>
          <FiscalYear />
        </ErrorBoundary>
      );
    case "users":
      return (
        <ErrorBoundary>
          <UsersManagement />
        </ErrorBoundary>
      );
    case "audit-log":
      return (
        <ErrorBoundary>
          <AuditLog />
        </ErrorBoundary>
      );
    case "approval-queue":
      return (
        <ErrorBoundary>
          <ApprovalQueue />
        </ErrorBoundary>
      );
    case "backup":
      return (
        <ErrorBoundary>
          <BackupRestore />
        </ErrorBoundary>
      );
    case "recurring-vouchers":
      return (
        <ErrorBoundary>
          <RecurringVouchers />
        </ErrorBoundary>
      );
    case "pos":
      return (
        <ErrorBoundary>
          <POSMode />
        </ErrorBoundary>
      );
    case "price-lists":
      return (
        <ErrorBoundary>
          <POSMode />
        </ErrorBoundary>
      );
    case "salesmen":
      return (
        <ErrorBoundary>
          <EmployeeMaster />
        </ErrorBoundary>
      );
    case "bank-statement-import":
      return (
        <ErrorBoundary>
          <BankStatementImport />
        </ErrorBoundary>
      );
    case "data-import":
      return (
        <ErrorBoundary>
          <DataImport />
        </ErrorBoundary>
      );
    case "data-export":
      return (
        <ErrorBoundary>
          <DataExport />
        </ErrorBoundary>
      );
    case "bank-import":
      return (
        <ErrorBoundary>
          <BankStatementImport />
        </ErrorBoundary>
      );
    case "overdue-interest":
      return (
        <ErrorBoundary>
          <OverdueBillsInterest />
        </ErrorBoundary>
      );
    case "interest-slabs":
      return (
        <ErrorBoundary>
          <InterestSlabConfig />
        </ErrorBoundary>
      );
    case "fixed-assets":
      return (
        <ErrorBoundary>
          <FixedAssets />
        </ErrorBoundary>
      );
    case "depreciation-chart":
      return (
        <ErrorBoundary>
          <DepreciationChart />
        </ErrorBoundary>
      );
    case "bom":
      return (
        <ErrorBoundary>
          <BillOfMaterialPage />
        </ErrorBoundary>
      );
    case "production-voucher":
      return (
        <ErrorBoundary>
          <ProductionVoucherPage />
        </ErrorBoundary>
      );
    case "physical-stock":
      return (
        <ErrorBoundary>
          <PhysicalStockPage />
        </ErrorBoundary>
      );
    case "cbms-log":
      return (
        <ErrorBoundary>
          <CbmsLog />
        </ErrorBoundary>
      );
    case "currencies":
      return (
        <ErrorBoundary>
          <CurrencyMaster />
        </ErrorBoundary>
      );
    case "salesman-report":
      return (
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      );
    default:
      return (
        <ErrorBoundary>
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-[15px] font-bold text-gray-800">404 - Page Not Found</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              The requested page "{currentPage}" could not be found.
            </p>
            <button
              onClick={() => useStore.getState().setCurrentPage("dashboard")}
              className="mt-4 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </ErrorBoundary>
      );
  }
}



export default function App() {
  const { currentUser, initializeApp } = useStore();
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeApp();
      setIsDbReady(true);
    };
    init();
  }, [initializeApp]);

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4ff]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-[#1557b0] animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Sutra ERP...</h2>
          <p className="text-gray-600">Please wait while we initialize the application</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGateway>
        <div />
      </AuthGateway>
    );
  }

  return (
    <>
      <Layout>
        <MainRouter />
      </Layout>
      <KeyboardShortcutsHelp />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e2433",
            color: "#f0f4ff",
            fontSize: "12px",
            fontWeight: "500",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
        }}
      />
    </>
  );
}
