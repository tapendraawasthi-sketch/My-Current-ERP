// @ts-nocheck
import React, { useEffect } from "react";
import { useStore } from "./store";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import BusyMenuBar from "./components/BusyMenuBar";
import Dashboard from "./pages/Dashboard";
import ChartOfAccounts from "./components/ChartOfAccounts";
import Warehouses from "./pages/Warehouses";
import Units from "./pages/Units";
import CostCenters from "./pages/CostCenters";
import Parties from "./pages/Parties";
import PartyForm from "./pages/PartyForm";
import ItemMaster from "./pages/ItemMaster";
import SalesVoucher from "./pages/SalesVoucher";
import SalesReturn from "./pages/SalesReturn";
import PurchaseVoucher from "./pages/PurchaseVoucher";
import PurchaseReturn from "./pages/PurchaseReturn";
import JournalVoucher from "./pages/JournalVoucher";
import PaymentVoucher from "./pages/PaymentVoucher";
import ReceiptVoucher from "./pages/ReceiptVoucher";
import ContraVoucher from "./pages/ContraVoucher";
import DeliveryChallan from "./pages/DeliveryChallan";
import GoodsReceiptNote from "./pages/GoodsReceiptNote";
import StockTransfer from "./pages/StockTransfer";
import StockAdjustment from "./pages/StockAdjustment";
import PhysicalStock from "./pages/PhysicalStock";
import Quotation from "./pages/Quotation";
import SalesOrder from "./pages/SalesOrder";
import PurchaseOrder from "./pages/PurchaseOrder";
import CreditNote from "./pages/CreditNote";
import DebitNote from "./pages/DebitNote";
import BalanceSheet from "./pages/BalanceSheet";
import ProfitLoss from "./pages/ProfitLoss";
import TrialBalance from "./pages/TrialBalance";
import DayBook from "./pages/DayBook";
import LedgerReport from "./pages/LedgerReport";
import OutstandingReceivables from "./pages/OutstandingReceivables";
import OutstandingPayables from "./pages/OutstandingPayables";
import AgingReport from "./pages/AgingReport";
import PartyStatement from "./pages/PartyStatement";
import InterestCalculation from "./pages/InterestCalculation";
import StockSummary from "./pages/StockSummary";
import StockMovement from "./pages/StockMovement";
import BudgetMaster from "./pages/BudgetMaster";
import Settings from "./pages/Settings";
import FiscalYear from "./pages/FiscalYear";
import Backup from "./pages/Backup";
import AuditLog from "./pages/AuditLog";
import ImportExport from "./pages/ImportExport";
import UserManagement from "./pages/UserManagement";
import Workflow from "./pages/Workflow";
// ── Phase 4 new pages ─────────────────────────────────────────────────────────
import SalesPersons from "./pages/SalesPersons";
import PriceLists from "./pages/PriceLists";
import UnitConversionMaster from "./pages/UnitConversionMaster";
import StandardNarrationMaster from "./pages/StandardNarrationMaster";
import BillSundryMaster from "./pages/BillSundryMaster";

// ─── Gateway / Auth ───────────────────────────────────────────────────────────
import Gateway from "./pages/AuthGateway";

const App: React.FC = () => {
  const {
    currentPage,
    isInitialised,
    isInitialising,
    initializeApp,
    company,
  } = useStore();

  useEffect(() => {
    initializeApp();
  }, []);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (isInitialising) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Gateway (not yet initialised / no company) ────────────────────────────
  if (!isInitialised || currentPage === "gateway") {
    return (
      <>
        <Toaster position="top-right" />
        <Gateway />
      </>
    );
  }

  // ── Page resolver ─────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {

      // ── Masters ────────────────────────────────────────────────────────────
      case "accounts":          return <ChartOfAccounts />;
      case "cost-centers":      return <CostCenters />;
      case "budget":            return <BudgetMaster />;
      case "parties":           return <Parties />;
      case "party-form":        return <PartyForm onClose={() => useStore.getState().setCurrentPage("parties")} />;
      case "item-master":       return <ItemMaster />;
      case "warehouses":        return <Warehouses />;
      case "units":             return <Units />;
      case "unit-conversion":   return <UnitConversionMaster />;
      // ── Phase 4 new routes ────────────────────────────────────────────────
      case "sales-persons":     return <SalesPersons />;
      case "price-lists":       return <PriceLists />;
      case "standard-narration":return <StandardNarrationMaster />;
      case "bill-sundry":       return <BillSundryMaster />;

      // ── Sales transactions ─────────────────────────────────────────────────
      case "sales":             return <SalesVoucher />;
      case "sales-return":      return <SalesReturn />;
      case "delivery-challan":  return <DeliveryChallan />;
      case "quotation":         return <Quotation />;
      case "sales-order":       return <SalesOrder />;

      // ── Purchase transactions ──────────────────────────────────────────────
      case "purchase":          return <PurchaseVoucher />;
      case "purchase-return":   return <PurchaseReturn />;
      case "goods-receipt":     return <GoodsReceiptNote />;
      case "purchase-order":    return <PurchaseOrder />;

      // ── Inventory transactions ─────────────────────────────────────────────
      case "stock-transfer":    return <StockTransfer />;
      case "stock-adjustment":  return <StockAdjustment />;
      case "physical-stock":    return <PhysicalStock />;

      // ── Finance / Accounts transactions ───────────────────────────────────
      case "journal":           return <JournalVoucher />;
      case "payment":           return <PaymentVoucher />;
      case "receipt":           return <ReceiptVoucher />;
      case "contra":            return <ContraVoucher />;
      case "credit-note":       return <CreditNote />;
      case "debit-note":        return <DebitNote />;

      // ── Financial reports ─────────────────────────────────────────────────
      case "balance-sheet":     return <BalanceSheet />;
      case "profit-loss":       return <ProfitLoss />;
      case "trial-balance":     return <TrialBalance />;
      case "day-book":          return <DayBook />;
      case "ledger-report":     return <LedgerReport />;

      // ── Party reports ─────────────────────────────────────────────────────
      case "outstanding-receivables": return <OutstandingReceivables />;
      case "outstanding-payables":    return <OutstandingPayables />;
      case "aging-report":            return <AgingReport />;
      case "party-statement":         return <PartyStatement />;
      case "interest-calculation":    return <InterestCalculation />;

      // ── Inventory reports ─────────────────────────────────────────────────
      case "stock-summary":     return <StockSummary />;
      case "stock-movement":    return <StockMovement />;

      // ── Company / utilities ───────────────────────────────────────────────
      case "settings":          return <Settings />;
      case "fiscal-year":       return <FiscalYear />;
      case "backup":            return <Backup />;
      case "audit-log":         return <AuditLog />;
      case "import-export":     return <ImportExport />;
      case "user-management":   return <UserManagement />;
      case "workflow":          return <Workflow />;

      // ── Dashboard / fallback ──────────────────────────────────────────────
      default:                  return <Dashboard />;
    }
  };

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />
      <Layout>
        <div className="flex flex-col h-full">
          <BusyMenuBar />
          <main className="flex-1 overflow-y-auto bg-gray-50">
            {renderPage()}
          </main>
        </div>
      </Layout>
    </>
  );
};

export default App;
