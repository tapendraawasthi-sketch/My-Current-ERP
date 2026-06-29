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
import StockBook from "./pages/StockBook";
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

// ── Phase 4 new pages ─────────────────────────────────────────────────────────
import SalesPersons from "./pages/SalesPersons";
import PriceLists from "./pages/PriceLists";
import UnitConversionMaster from "./pages/UnitConversionMaster";
import StandardNarrationMaster from "./pages/StandardNarrationMaster";
import BillSundryMaster from "./pages/BillSundryMaster";
import JournalEntries from "./pages/JournalEntries";
import DebitNoteVoucher from "./pages/DebitNoteVoucher";
import CreditNoteVoucher from "./pages/CreditNoteVoucher";
import PhysicalStockPage from "./pages/PhysicalStockPage";
import CashFlowStatement from "./pages/CashFlowStatement";
import GeneralLedger from "./pages/GeneralLedger";
import VatReports from "./pages/VatReports";
import BillingInvoice from "./pages/BillingInvoice";
import PartyStatement from "./pages/PartyStatement";

// ─── Auth screens (Tally-style stage machine) ─────────────────────────────────
import SignUpWizard from "./components/auth/SignUpWizard";
import GatewayScreen from "./components/auth/GatewayScreen";
import CompanyLoginScreen from "./components/auth/CompanyLoginScreen";

const App: React.FC = () => {
  const { currentPage, authStage, initializeApp } = useStore();

  useEffect(() => {
    initializeApp();
  }, []);

  // ── Auth Stage Machine — single source of truth for what renders ──────────

  if (authStage === "checking") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#E4F1D9" }}
      >
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1557b0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[12px] mt-1" style={{ color: "#1f2937" }}>
            Loading Sutra ERP…
          </p>
        </div>
      </div>
    );
  }

  if (authStage === "no-company") {
    return (
      <>
        <Toaster position="top-right" />
        <SignUpWizard />
      </>
    );
  }

  if (authStage === "gateway") {
    return (
      <>
        <Toaster position="top-right" />
        <GatewayScreen />
      </>
    );
  }

  if (authStage === "company-login") {
    return (
      <>
        <Toaster position="top-right" />
        <CompanyLoginScreen />
      </>
    );
  }

  // authStage === "authenticated" — render the full app shell

  // ── Page resolver ─────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {
      // ── Masters ──────────────────────────────────────────────────────────
      case "accounts":
        return <ChartOfAccounts />;
      case "cost-centers":
        return <CostCenters />;
      case "budget":
        return <BudgetMaster />;
      case "parties":
        return <Parties />;
      case "item-master":
        return <StockBook />;
      case "warehouses":
        return <Warehouses />;
      case "units":
        return <Units />;
      case "unit-conversion":
        return <UnitConversionMaster />;

      // ── Phase 4 masters ───────────────────────────────────────────────────
      case "sales-persons":
        return <SalesPersons />;
      case "price-lists":
        return <PriceLists />;
      case "standard-narration":
        return <StandardNarrationMaster />;
      case "bill-sundry":
        return <BillSundryMaster />;

      // ── Sales transactions ────────────────────────────────────────────────
      case "billing":
        return <BillingInvoice />;
      case "sales":
        return <SalesVoucher />;
      case "sales-return":
        return <BillingInvoice />;
      case "delivery-challan":
        return <DeliveryChallan />;
      case "quotation":
        return <Quotation />;
      case "sales-order":
        return <SalesOrder />;

      // ── Purchase transactions ─────────────────────────────────────────────
      case "purchase":
        return <PurchaseVoucher />;
      case "purchase-return":
        return <BillingInvoice />;
      case "goods-receipt":
        return <GoodsReceiptNote />;
      case "purchase-order":
        return <PurchaseOrder />;

      // ── Inventory transactions ────────────────────────────────────────────
      case "stock-transfer":
        return <StockTransfer />;
      case "physical-stock":
        return <PhysicalStockPage />;

      // ── Finance / Accounts ────────────────────────────────────────────────
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

      // ── Financial reports ─────────────────────────────────────────────────
      case "balance-sheet":
        return <BalanceSheet />;
      case "profit-loss":
        return <ProfitLoss />;
      case "trial-balance":
        return <TrialBalance />;
      case "day-book":
        return <DayBook />;
      case "cash-flow":
        return <CashFlowStatement />;
      case "ledger-report":
        return <GeneralLedger />;
      case "ledger":
        return <GeneralLedger />;

      // ── GST / VAT reports ─────────────────────────────────────────────────
      case "vat-reports":
        return <VatReports />;
      case "gstr1":
      case "gstr2":
      case "gstr3b":
      case "gst-summary":
        return <VatReports />;

      // ── Party reports ─────────────────────────────────────────────────────
      case "outstanding-receivables":
        return <OutstandingReceivables />;
      case "outstanding-payables":
        return <OutstandingPayables />;
      case "aging-report":
        return <AgingReport />;
      case "party-statement":
        return <PartyStatement />;
      case "interest-calculation":
        return <InterestCalculation />;

      // ── Inventory reports ─────────────────────────────────────────────────
      case "stock-summary":
        return <StockSummary />;

      // ── Company / utilities ───────────────────────────────────────────────
      case "fiscal-year":
        return <FiscalYear />;
      case "audit-log":
        return <AuditLog />;

      // ── Dashboard / fallback ──────────────────────────────────────────────
      default:
        return <Dashboard />;
    }
  };

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />
      <Layout>
        <div className="flex flex-col h-full">
          <main className="flex-1 overflow-y-auto bg-[#f5f6fa]">{renderPage()}</main>
        </div>
      </Layout>
    </>
  );
};

export default App;
