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
import RatioAnalysis from "./pages/RatioAnalysis";
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
import PayrollRun from "./pages/PayrollRun";
import BankStatementImport from "./pages/BankStatementImport";
import OverdueBillsInterest from "./pages/OverdueBillsInterest";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AccountGroupMaster from "./pages/AccountGroupMaster";
import ItemGroupMaster from "./pages/ItemGroupMaster";
import UnitConversionMaster from "./pages/UnitConversionMaster";
import StandardNarrationMaster from "./pages/StandardNarrationMaster";
import BillSundryMaster from "./pages/BillSundryMaster";
import SaleTypeMaster from "./pages/SaleTypeMaster";
import PurchaseTypeMaster from "./pages/PurchaseTypeMaster";
import TaxCategoryMaster from "./pages/TaxCategoryMaster";
import DiscountStructureMaster from "./pages/DiscountStructureMaster";
import ConfigurationHub from "./pages/ConfigurationHub";
import BulkUpdations from "./pages/BulkUpdations";
import DataExportImport from "./pages/DataExportImport";
import MiscDataEntry from "./pages/MiscDataEntry";

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
    case "ratio-analysis":
      return (
        <ErrorBoundary>
          <RatioAnalysis />
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
    case "backup":
    case "backup-restore":
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
    case "employees":
    case "salesmen":
      return (
        <ErrorBoundary>
          <EmployeeMaster />
        </ErrorBoundary>
      );
    case "payroll-run":
    case "payslip":
      return (
        <ErrorBoundary>
          <PayrollRun />
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
    case "salesman-report":
      return (
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      );
    case "account-groups":
      return <ErrorBoundary><AccountGroupMaster /></ErrorBoundary>;
    case "item-groups":
      return <ErrorBoundary><ItemGroupMaster /></ErrorBoundary>;
    case "unit-conversions":
      return <ErrorBoundary><UnitConversionMaster /></ErrorBoundary>;
    case "standard-narrations":
      return <ErrorBoundary><StandardNarrationMaster /></ErrorBoundary>;
    case "bill-sundries":
      return <ErrorBoundary><BillSundryMaster /></ErrorBoundary>;
    case "sale-types":
      return <ErrorBoundary><SaleTypeMaster /></ErrorBoundary>;
    case "purchase-types":
      return <ErrorBoundary><PurchaseTypeMaster /></ErrorBoundary>;
    case "tax-categories":
      return <ErrorBoundary><TaxCategoryMaster /></ErrorBoundary>;
    case "discount-structures":
      return <ErrorBoundary><DiscountStructureMaster /></ErrorBoundary>;
    case "configuration":
      return <ErrorBoundary><ConfigurationHub /></ErrorBoundary>;
    case "holidays":
      return <ErrorBoundary><ConfigurationHub /></ErrorBoundary>;
    case "bulk-updations":
      return <ErrorBoundary><BulkUpdations /></ErrorBoundary>;
    case "data-export-import":
      return <ErrorBoundary><DataExportImport /></ErrorBoundary>;
    case "misc-data-entry":
      return <ErrorBoundary><MiscDataEntry /></ErrorBoundary>;
    default:
      return (
        <ErrorBoundary>
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#9DC07A] rounded-lg p-6">
            <h2 className="text-[15px] font-bold text-[#000000]">404 - Page Not Found</h2>
            <p className="text-[11px] text-[#000000] mt-1">The requested page "{currentPage}" could not be found.</p>
            <button
              onClick={() => useStore.getState().setCurrentPage("dashboard")}
              className="mt-4 h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-semibold rounded-md cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </ErrorBoundary>
      );
  }
}

import ShortcutPanel from "./components/ShortcutPanel";

export default function App() {
  const { currentUser, initializeApp } = useStore();
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeApp();
      } catch (err) {
        console.error("[Sutra ERP] App init error:", err);
      } finally {
        setIsDbReady(true);
      }
    };
    init();
  }, [initializeApp]);

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E4F1D9]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-[#3D6B25] animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#000000] mb-2">Loading Sutra ERP...</h2>
          <p className="text-[#000000]">Please wait while we initialize the application</p>
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
      <ShortcutPanel />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1A2E14",
            color: "#E4F1D9",
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
