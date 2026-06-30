import React, { useEffect, useCallback } from "react";
import { useStore } from "./store/useStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { seedShortcutsIfEmpty } from "./lib/db";
import Layout from "./components/Layout";
import toast from "react-hot-toast";

// ── Page imports ────────────────────────────────────────────────────────────────
import Dashboard         from "./pages/Dashboard";
import ChartOfAccounts  from "./components/ChartOfAccounts";
import JournalVoucher   from "./pages/JournalVoucher";
import PaymentVoucher   from "./pages/PaymentVoucher";
import ReceiptVoucher   from "./pages/ReceiptVoucher";
import ContraVoucher    from "./pages/ContraVoucher";
import DayBook          from "./pages/DayBook";
import TrialBalance     from "./pages/TrialBalance";
import BalanceSheet     from "./pages/BalanceSheet";
import ProfitLoss       from "./pages/ProfitLoss";
import VatReports       from "./pages/VatReports";
import AgingReport      from "./pages/AgingReport";
import BillingInvoice   from "./pages/BillingInvoice";
import StockBook        from "./pages/StockBook";
import StockSummaryReport from "./pages/StockSummaryReport";
import StockLedgerReport  from "./pages/StockLedgerReport";
import SalesAnalysisReport from "./pages/SalesAnalysisReport";
import PartiesDirectory from "./components/PartiesDirectory";
import UserManagement   from "./pages/UsersManagement";
import CompanySettings  from "./pages/CompanySettings";
import FiscalYears      from "./pages/FiscalYear";
import AuditLog         from "./pages/AuditLog";
import POSBilling       from "./pages/POSBilling";
import OutstandingReceivables from "./pages/OutstandingReceivables";
import OutstandingPayables    from "./pages/OutstandingPayables";
import InterestCalculation    from "./pages/InterestCalculation";
import BudgetVsActual         from "./pages/BudgetVsActual";
import BankReconciliation     from "./pages/BankReconciliation";
import BillSundryMaster       from "./pages/BillSundryMaster";
import SaleTypeMaster         from "./pages/SaleTypeMaster";
import PurchaseTypeMaster     from "./pages/PurchaseTypeMaster";
import TaxCategoryMaster      from "./pages/TaxCategoryMaster";
import VoucherTypeMaster      from "./pages/VoucherTypeMaster";
import StandardNarrationMaster from "./pages/StandardNarrationMaster";
import GeneralLedger          from "./pages/GeneralLedger";
import ShortcutPanel          from "./components/ShortcutPanel";
import SystemSettings         from "./components/SystemSettings";
import InventoryConfiguration from "./pages/InventoryConfiguration";
import NepalReports           from "./pages/NepalReports";
import PhysicalStockPage      from "./pages/PhysicalStockPage2";
import GodownTransfer         from "./pages/GodownTransfer";
import StockJournal           from "./pages/StockJournal";
import CbmsPage               from "./pages/CbmsDashboard";

// Auth screens
import SignUpWizard       from "./components/auth/SignUpWizard";
import CompanyLoginScreen from "./components/auth/CompanyLoginScreen";

function renderPage(page: string): React.ReactNode {
  // Fix BUG-067: ALL sidebar menu pages have corresponding routes
  switch (page) {
    // Accounting
    case "dashboard":              return <Dashboard />;
    case "accounts":               return <ChartOfAccounts />;
    case "journal":                return <JournalVoucher />;
    case "payment":                return <PaymentVoucher />;
    case "receipt":                return <ReceiptVoucher />;
    case "contra":                 return <ContraVoucher />;
    case "day-book":               return <DayBook />;
    case "ledger":                 return <GeneralLedger />;
    case "trial-balance":          return <TrialBalance />;
    case "balance-sheet":          return <BalanceSheet />;
    case "profit-loss":            return <ProfitLoss />;
    case "nepal-reports":          return <NepalReports />;
    case "vat-reports":            return <VatReports />;
    case "aging-report":           return <AgingReport />;
    case "outstanding-receivables":return <OutstandingReceivables />;
    case "outstanding-payables":   return <OutstandingPayables />;
    case "interest-calculation":   return <InterestCalculation />;
    case "budget-vs-actual":       return <BudgetVsActual />;
    case "bank-reconciliation":    return <BankReconciliation />;
    // Inventory
    case "items":                  return <StockBook />;
    case "stock-summary":          return <StockSummaryReport />;
    case "stock-ledger":           return <StockLedgerReport />;
    case "stock-journal":          return <StockJournal />;
    case "physical-stock":         return <PhysicalStockPage />;
    case "godown-transfer":        return <GodownTransfer />;
    case "stock-status":           return <StockSummaryReport />;
    // Billing
    case "billing":                return <BillingInvoice />;
    case "sales-analysis":         return <SalesAnalysisReport />;
    case "pos":                    return <POSBilling />;
    // Masters
    case "parties":                return <PartiesDirectory />;
    case "bill-sundry":            return <BillSundryMaster />;
    case "sale-type":              return <SaleTypeMaster />;
    case "purchase-type":          return <PurchaseTypeMaster />;
    case "tax-category":           return <TaxCategoryMaster />;
    case "voucher-type":           return <VoucherTypeMaster />;
    case "standard-narration":     return <StandardNarrationMaster />;
    case "inventory-config":       return <InventoryConfiguration />;
    // Compliance
    case "cbms":                   return <CbmsPage />;
    // Settings
    case "users":                  return <UserManagement />;
    case "company-settings":       return <CompanySettings />;
    case "shortcuts":              return <ShortcutPanel />;
    case "fiscal-years":           return <FiscalYears />;
    case "audit-log":              return <AuditLog />;
    case "system-settings":        return <SystemSettings />;
    // Default
    default:
      return <Dashboard />;
  }
}

const App: React.FC = () => {
  const {
    currentUser,
    companies,
    currentPage,
    setCurrentPage,
    isInitialized,
    initializeApp,
  } = useStore();

  // Initialize app and seed shortcuts on first load
  useEffect(() => {
    initializeApp();
    seedShortcutsIfEmpty().catch(console.error);
  }, [initializeApp]);

  // Fix BUG-036, BUG-040: complete global shortcut handler
  const handleShortcutAction = useCallback((action: string) => {
    switch (action) {
      // Navigation shortcuts
      case "balance-sheet":   setCurrentPage("balance-sheet");   break;
      case "trial-balance":   setCurrentPage("trial-balance");   break;
      case "ledger":          setCurrentPage("ledger");           break;
      case "vat-reports":     setCurrentPage("vat-reports");      break;
      case "day-book":        setCurrentPage("day-book");         break;
      case "profit-loss":     setCurrentPage("profit-loss");      break;
      case "stock-summary":   setCurrentPage("stock-summary");    break;
      case "aging-report":    setCurrentPage("aging-report");     break;
      // Form actions — dispatched as custom events for form components to handle
      case "save":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "save" } }));
        break;
      case "narration":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "narration" } }));
        break;
      case "delete-row":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "delete-row" } }));
        break;
      case "new":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "new" } }));
        break;
      case "refresh":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "refresh" } }));
        break;
      case "print":
        window.print();
        break;
      case "export":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "export" } }));
        break;
      case "config":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "config" } }));
        break;
      case "cancel":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "cancel" } }));
        break;
      case "type":
        window.dispatchEvent(new CustomEvent("erp:shortcut", { detail: { action: "type" } }));
        break;
      default:
        break;
    }
  }, [setCurrentPage]);

  useKeyboardShortcuts({
    onAction:    handleShortcutAction,
    currentPage: currentPage,
    disabled:    !currentUser,
  });

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f6fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1557b0] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-gray-600 font-medium">Initializing SUTRA ERP…</span>
        </div>
      </div>
    );
  }

  // Auth: no companies → signup
  if (!companies || companies.length === 0) {
    return <SignUpWizard />;
  }

  // Auth: not logged in → login
  if (!currentUser) {
    return <CompanyLoginScreen />;
  }

  return (
    <Layout>
      {renderPage(currentPage)}
    </Layout>
  );
};

export default App;
