import React, { useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import { Toaster } from "react-hot-toast";
import { Loader2, Keyboard } from "lucide-react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import Layout from "./components/Layout";
import AuthGateway from "./pages/AuthGateway";
import Gateway from "./components/Gateway";
import Dashboard from "./components/Dashboard";
import ChartOfAccounts from "./components/ChartOfAccounts";
import PartiesDirectory from "./components/PartiesDirectory";
import StockBook from "./pages/StockBook";
import TallyVoucherPage from "./pages/TallyVoucherPage";
import VouchersRegister from "./components/VouchersRegister";
import BillingInvoice from "./pages/BillingInvoice";
import DebitCreditNote from "./pages/DebitCreditNote";
import SalesOrder from "./pages/SalesOrder";
import PurchaseOrder from "./pages/PurchaseOrder";
import StockJournalPage from "./pages/StockJournalPage";
import ProductionPage from "./pages/ProductionPage";
import UnassemblePage from "./pages/UnassemblePage";
import MaterialIssuedPage from "./pages/MaterialIssuedPage";
import MaterialReceivedPage from "./pages/MaterialReceivedPage";
import PhysicalStockPage from "./pages/PhysicalStockPage";
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
import StockCategoryMaster from "./pages/StockCategoryMaster";
import VoucherTypeMaster from "./pages/VoucherTypeMaster";
import ScenarioMaster from "./pages/ScenarioMaster";
import CostCategoryMaster from "./pages/CostCategoryMaster";
import CostCentreClassMaster from "./pages/CostCentreClassMaster";
import ReorderLevelMaster from "./pages/ReorderLevelMaster";
import PriceLevelMaster from "./pages/PriceLevelMaster";
import PriceListMaster from "./pages/PriceListMaster";
import HSCodeMaster from "./pages/HSCodeMaster";
import BatchMaster from "./pages/BatchMaster";
import VATClassificationMaster from "./pages/VATClassificationMaster";
import TDSNatureOfPaymentMaster from "./pages/TDSNatureOfPaymentMaster";
import EmployeeGroupMaster from "./pages/EmployeeGroupMaster";
import PayHeadMaster from "./pages/PayHeadMaster";
import SalaryDetailsMaster from "./pages/SalaryDetailsMaster";
import PayrollUnitMaster from "./pages/PayrollUnitMaster";
import AttendanceTypeMaster from "./pages/AttendanceTypeMaster";
import LedgerMaster from "./pages/LedgerMaster";
import MasterControlCentre from "./pages/MasterControlCentre";
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
import VoucherEntryHub from "./pages/VoucherEntryHub";
import SalesVoucher from "./pages/SalesVoucher";
import PurchaseVoucher from "./pages/PurchaseVoucher";
import CreditNoteVoucher from "./pages/CreditNoteVoucher";
import DebitNoteVoucher from "./pages/DebitNoteVoucher";
import StockJournalVoucher from "./pages/StockJournalPage";
import SalesOrderVoucher from "./pages/SalesOrderVoucher";
import MemorandumVoucher from "./pages/MemorandumVoucher";
import VouchersRegisterFull from "./pages/VouchersRegisterFull";
import F11CompanyFeatures from './pages/F11CompanyFeatures';

function MainRouter() {
  const { currentPage } = useStore();

  switch (currentPage) {
    case "gateway":
    case "dashboard":
      return (
        <ErrorBoundary>
          <Gateway />
        </ErrorBoundary>
      );
    case "analytics-dashboard":
      return (
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      );
    case "bill-wise-pending":
      return (
        <ErrorBoundary>
          <BillWisePending />
        </ErrorBoundary>
      );
    case "party-ledger":
      return (
        <ErrorBoundary>
          <PartyLedgerStatement />
        </ErrorBoundary>
      );
    case "vouchers-log":
      return (
        <ErrorBoundary>
          <VouchersRegisterFull />
        </ErrorBoundary>
      );
    case "bank-statement-import":
      return (
        <ErrorBoundary>
          <BankStatementImport />
        </ErrorBoundary>
      );
    case "overdue-bills-interest":
      return (
        <ErrorBoundary>
          <OverdueBillsInterest />
        </ErrorBoundary>
      );
    case "currency-master":
      return (
        <ErrorBoundary>
          <ConfigurationHub />
        </ErrorBoundary>
      );
    case "shortcuts":
      return (
        <ErrorBoundary>
          <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Keyboard Shortcuts</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#D4EABD" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", border: "1px solid #000" }}>Key</th>
                  <th style={{ padding: "6px 12px", textAlign: "left", border: "1px solid #000" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Ctrl+N", "New Voucher"], ["Ctrl+I", "New Invoice"],
                  ["F2", "Save"], ["F5", "List View"],
                  ["Ctrl+B", "Balance Sheet"], ["Ctrl+T", "Trial Balance"],
                  ["Ctrl+P", "Parties Directory"], ["Ctrl+A", "Chart of Accounts"],
                  ["Ctrl+D", "Dashboard"], ["?", "Toggle Shortcut Panel"],
                  ["B", "Balance Sheet"], ["T", "Trial Balance"],
                  ["S", "Stock Status"], ["A", "Account Summary"],
                  ["L", "Account Ledger"], ["V", "VAT Report"],
                  ["D", "Day Book"], ["G", "GST/VAT Summary"],
                  ["F", "Configuration"], ["U", "Switch User"],
                ].map(([key, label]) => (
                  <tr key={key}>
                    <td style={{ padding: "5px 12px", border: "1px solid #000", fontWeight: 700, fontFamily: "monospace" }}>{key}</td>
                    <td style={{ padding: "5px 12px", border: "1px solid #000" }}>{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      );
    case "ird-portal":
      window.open("https://ird.gov.np", "_blank", "noopener,noreferrer");
      return <ErrorBoundary><Dashboard /></ErrorBoundary>;
    case "etds-portal":
      window.open("https://etds.ird.gov.np", "_blank", "noopener,noreferrer");
      return <ErrorBoundary><Dashboard /></ErrorBoundary>;
    case "accounts":
      return (
        <ErrorBoundary>
          <ChartOfAccounts />
        </ErrorBoundary>
      );
    case "journal":
    case "payment":
    case "receipt":
    case "contra":
      return (
        <ErrorBoundary>
          <TallyVoucherPage type={currentPage as any} />
        </ErrorBoundary>
      );
    case "sales-voucher":
    case "sales-invoice":
      return (
        <ErrorBoundary>
          <SalesVoucher />
        </ErrorBoundary>
      );
    case "purchase-voucher":
    case "purchase-invoice":
      return (
        <ErrorBoundary>
          <PurchaseVoucher />
        </ErrorBoundary>
      );
    case "sales-return":
    case "purchase-return":
    case "billing":
      return (
        <ErrorBoundary>
          <BillingInvoice />
        </ErrorBoundary>
      );
    case "debit-note":
      return (
        <ErrorBoundary>
          <DebitNoteVoucher />
        </ErrorBoundary>
      );
    case "credit-note":
      return (
        <ErrorBoundary>
          <CreditNoteVoucher />
        </ErrorBoundary>
      );
    case "sales-order-voucher":
    case "sales-order":
      return (
        <ErrorBoundary>
          <SalesOrderVoucher />
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
    case "stock-journal-voucher":
    case "stock-journal":
      return (
        <ErrorBoundary>
          <StockJournalVoucher />
        </ErrorBoundary>
      );
    case "production":
      return (
        <ErrorBoundary>
          <ProductionPage />
        </ErrorBoundary>
      );
    case "unassemble":
      return (
        <ErrorBoundary>
          <UnassemblePage />
        </ErrorBoundary>
      );
    case "material-issued":
      return (
        <ErrorBoundary>
          <MaterialIssuedPage />
        </ErrorBoundary>
      );
    case "material-received":
      return (
        <ErrorBoundary>
          <MaterialReceivedPage />
        </ErrorBoundary>
      );
    case "physical-stock":
      return (
        <ErrorBoundary>
          <PhysicalStockPage />
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
          <VouchersRegisterFull />
        </ErrorBoundary>
      );
    case "vouchers":
      return (
        <ErrorBoundary>
          <VouchersRegisterFull />
        </ErrorBoundary>
      );
    case "voucher-register-full":
      return (
        <ErrorBoundary>
          <VouchersRegisterFull />
        </ErrorBoundary>
      );
    case "voucher-hub":
    case "voucher-entry-hub":
      return (
        <ErrorBoundary>
          <VoucherEntryHub />
        </ErrorBoundary>
      );
    case "memorandum-voucher":
    case "memorandum":
      return (
        <ErrorBoundary>
          <MemorandumVoucher />
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
    case "f11-company-features":
      return (
        <ErrorBoundary>
          <F11CompanyFeatures />
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
    case "ledgers":
      return <ErrorBoundary><LedgerMaster /></ErrorBoundary>;
    case "master-control-centre":
      return <ErrorBoundary><MasterControlCentre /></ErrorBoundary>;
    case "item-groups":
      return <ErrorBoundary><ItemGroupMaster /></ErrorBoundary>;
    case "stock-categories":
      return <ErrorBoundary><StockCategoryMaster /></ErrorBoundary>;
    case "voucher-types":
      return <ErrorBoundary><VoucherTypeMaster /></ErrorBoundary>;
    case "scenarios":
      return <ErrorBoundary><ScenarioMaster /></ErrorBoundary>;
    case "cost-categories":
      return <ErrorBoundary><CostCategoryMaster /></ErrorBoundary>;
    case "cost-centre-classes":
      return <ErrorBoundary><CostCentreClassMaster /></ErrorBoundary>;
    case "reorder-levels":
      return <ErrorBoundary><ReorderLevelMaster /></ErrorBoundary>;
    case "price-levels":
      return <ErrorBoundary><PriceLevelMaster /></ErrorBoundary>;
    case "price-lists":
      return <ErrorBoundary><PriceListMaster /></ErrorBoundary>;
    case "hs-codes":
      return <ErrorBoundary><HSCodeMaster /></ErrorBoundary>;
    case "batches":
      return <ErrorBoundary><BatchMaster /></ErrorBoundary>;
    case "vat-classifications":
      return <ErrorBoundary><VATClassificationMaster /></ErrorBoundary>;
    case "tds-nature-of-payments":
      return <ErrorBoundary><TDSNatureOfPaymentMaster /></ErrorBoundary>;
    case "employee-groups":
      return <ErrorBoundary><EmployeeGroupMaster /></ErrorBoundary>;
    case "pay-heads":
      return <ErrorBoundary><PayHeadMaster /></ErrorBoundary>;
    case "salary-details":
      return <ErrorBoundary><SalaryDetailsMaster /></ErrorBoundary>;
    case "payroll-units":
      return <ErrorBoundary><PayrollUnitMaster /></ErrorBoundary>;
    case "attendance-types":
      return <ErrorBoundary><AttendanceTypeMaster /></ErrorBoundary>;
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
    duration: 4000,
    style: {
      background: "#1F2937",
      color: "#FFFFFF",
      fontSize: "12px",
      fontWeight: "500",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      border: "1px solid rgba(255,255,255,0.08)",
      maxWidth: "380px",
    },
    success: {
      style: {
        background: "#14532D",
        color: "#FFFFFF",
        border: "1px solid #22c55e",
      },
      iconTheme: {
        primary: "#4ade80",
        secondary: "#14532D",
      },
    },
    error: {
      style: {
        background: "#7F1D1D",
        color: "#FFFFFF",
        border: "1px solid #ef4444",
      },
      iconTheme: {
        primary: "#f87171",
        secondary: "#7F1D1D",
      },
    },
  }}
/>
    </>
  );
}
