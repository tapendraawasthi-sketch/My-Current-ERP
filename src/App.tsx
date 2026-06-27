import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useStore } from './store/useStore';
import LoadingSpinner from './components/ui/Spinner';
import { Toaster } from 'react-hot-toast';

// Existing imports...
import BulkUpdations from './pages/BulkUpdations';
import ChartOfAccounts from './components/ChartOfAccounts';

// Refactored Tally Components
import BackupRestore from './components/tally/BackupRestore';
import ControlCentre from './components/tally/ControlCentre';
import DataExportImport from './components/tally/DataExportImport';
import F11CompanyFeatures from './components/tally/F11CompanyFeatures';
import PrintConfiguration from './components/tally/PrintConfiguration';
import RolesManagement from './components/tally/RolesManagement';
import SecurityControl from './components/tally/SecurityControl';
import TallyVault from './components/tally/TallyVault';

// Modals and Utilities
import { CalculatorPanel } from './components/ui/CalculatorPanel';
import { DisplayLanguageModal, DataEntryLanguageModal } from './components/ui/LanguageModal';

// Lazy load heavy pages
const Dashboard = lazy(() => import('./components/Dashboard'));
const VoucherEntryHub = lazy(() => import('./pages/VoucherEntryHub'));
const PartyMaster = lazy(() => import('./pages/PartyMaster'));
const ItemMaster = lazy(() => import('./pages/ItemMaster'));
const UnitConversionMaster = lazy(() => import('./pages/UnitConversionMaster'));
const BillSundryMaster = lazy(() => import('./pages/BillSundryMaster'));
const ConfigurationHub = lazy(() => import('./pages/ConfigurationHub'));
const MemorandumVoucher = lazy(() => import('./pages/MemorandumVoucher'));
const SalesRegister = lazy(() => import('./pages/SalesRegister'));
const PurchaseRegister = lazy(() => import('./pages/PurchaseRegister'));
const JournalRegister = lazy(() => import('./pages/JournalRegister'));
const DayBook = lazy(() => import('./pages/DayBook'));
const GeneralLedger = lazy(() => import('./pages/GeneralLedger'));
const TrialBalance = lazy(() => import('./pages/TrialBalance'));
const ProfitLoss = lazy(() => import('./pages/ProfitLoss'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet'));
const CashFlowStatement = lazy(() => import('./pages/CashFlowStatement'));
const FundsFlowStatement = lazy(() => import('./pages/FundsFlowStatement'));
const StockBook = lazy(() => import('./pages/StockBook'));
const StockSummary = lazy(() => import('./pages/StockSummary'));
const SalesOrderOutstanding = lazy(() => import('./pages/SalesOrderOutstanding'));
const PurchaseOrderOutstanding = lazy(() => import('./pages/PurchaseOrderOutstanding'));
const DebtorsAging = lazy(() => import('./pages/DebtorsAging'));
const CreditorsAging = lazy(() => import('./pages/CreditorsAging'));
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const GstReports = lazy(() => import('./pages/GstReports'));
const TdsReports = lazy(() => import('./pages/TdsReports'));
const VatReports = lazy(() => import('./pages/VatReports'));
const Payroll = lazy(() => import('./pages/Payroll'));
const PayrollReports = lazy(() => import('./pages/PayrollReports'));
const Budgets = lazy(() => import('./pages/Budgets'));
const RatioAnalysis = lazy(() => import('./pages/RatioAnalysis'));
const StatisticsReport = lazy(() => import('./pages/StatisticsReport'));
const ExceptionReports = lazy(() => import('./pages/ExceptionReports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Troubleshooting = lazy(() => import('./pages/Troubleshooting'));
const CbmsDashboard = lazy(() => import('./pages/CbmsDashboard'));
const ReceiptVoucher = lazy(() => import('./pages/ReceiptVoucher'));
const PaymentVoucher = lazy(() => import('./pages/PaymentVoucher'));
const ContraVoucher = lazy(() => import('./pages/ContraVoucher'));
const JournalEntries = lazy(() => import('./pages/JournalEntries'));
const SalesVoucher = lazy(() => import('./pages/SalesVoucher'));
const PurchaseVoucher = lazy(() => import('./pages/PurchaseVoucher'));
const DebitNoteVoucher = lazy(() => import('./pages/DebitNoteVoucher'));
const CreditNoteVoucher = lazy(() => import('./pages/CreditNoteVoucher'));
const SalesOrderVoucher = lazy(() => import('./pages/SalesOrderVoucher'));
const PurchaseOrder = lazy(() => import('./pages/PurchaseOrder'));
const StockJournalPage = lazy(() => import('./pages/StockJournalPage'));
const PhysicalStockPage = lazy(() => import('./pages/PhysicalStockPage'));
const MaterialIssuedPage = lazy(() => import('./pages/MaterialIssuedPage'));
const MaterialReceivedPage = lazy(() => import('./pages/MaterialReceivedPage'));
const ProductionPage = lazy(() => import('./pages/ProductionPage'));
const UnassemblePage = lazy(() => import('./pages/UnassemblePage'));
const DeliveryChallan = lazy(() => import('./pages/DeliveryChallan'));
const GoodsReceiptNote = lazy(() => import('./pages/GoodsReceiptNote'));
const ReceiptsAndPayments = lazy(() => import('./pages/ReceiptsAndPayments'));
const PaymentAdvice = lazy(() => import('./pages/PaymentAdvice'));


import Layout from "./components/Layout";
import { F12Provider } from './hooks/useF12Config';
import F12Panel from './components/F12Panel';
import AuthGateway from "./pages/AuthGateway";
import ShortcutPanel from "./components/ShortcutPanel";
import { Loader2 } from "lucide-react";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-700">
          <h2 className="text-lg font-bold text-red-600 mb-2">Component Error</h2>
          <p className="text-sm">Something went wrong while loading this page. Please try refreshing.</p>
        </div>
      );
    }
    return this.props.children; 
  }
}

const App = () => {
  const { currentPage, currentUser, initializeApp } = useStore();
  const [isDbReady, setIsDbReady] = useState(false);
  
  // NEW: Calculator and language modal state
  const [calcOpen, setCalcOpen] = useState(false);
  const [displayLangOpen, setDisplayLangOpen] = useState(false);
  const [dataEntryLangOpen, setDataEntryLangOpen] = useState(false);

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

  // NEW: Global shortcut handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setCalcOpen(p => !p); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setDisplayLangOpen(p => !p); }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); setDataEntryLangOpen(p => !p); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'voucher-entry': return <VoucherEntryHub />;
      case 'party-master': return <PartyMaster />;
      case 'item-master': return <ItemMaster />;
      case 'unit-conversion': return <UnitConversionMaster />;
      case 'bill-sundry': return <BillSundryMaster />;
      case 'configuration':
      case 'settings':
      case 'company/settings':
      case '/company/settings': return <ConfigurationHub />;
      case 'memorandum-voucher': return <MemorandumVoucher />;
      case 'sales-register': return <SalesRegister />;
      case 'purchase-register': return <PurchaseRegister />;
      case 'journal-register': return <JournalRegister />;
      case 'day-book': return <DayBook />;
      case 'general-ledger': return <GeneralLedger />;
      case 'trial-balance': return <TrialBalance />;
      case 'profit-loss': return <ProfitLoss />;
      case 'balance-sheet': return <BalanceSheet />;
      case 'cash-flow': return <CashFlowStatement />;
      case 'funds-flow': return <FundsFlowStatement />;
      case 'stock-book': return <StockBook />;
      case 'stock-summary': return <StockSummary />;
      case 'sales-order-outstanding': return <SalesOrderOutstanding />;
      case 'purchase-order-outstanding': return <PurchaseOrderOutstanding />;
      case 'debtors-aging': return <DebtorsAging />;
      case 'creditors-aging': return <CreditorsAging />;
      case 'bank-reconciliation': return <BankReconciliation />;
      case 'gst-reports': return <GstReports />;
      case 'tds-reports': return <TdsReports />;
      case 'vat-reports': return <VatReports />;
      case 'payroll': return <Payroll />;
      case 'payroll-reports': return <PayrollReports />;
      case 'budgets': return <Budgets />;
      case 'ratio-analysis': return <RatioAnalysis />;
      case 'statistics-report': return <StatisticsReport />;
      case 'exception-reports': return <ExceptionReports />;
      case 'audit-logs': return <AuditLogs />;
      case 'troubleshooting': return <Troubleshooting />;
      case 'bulk-updations': return <BulkUpdations />;
      case 'chart-of-accounts': return <ChartOfAccounts />;
      case 'backup-restore': return <BackupRestore />;
      case 'tally-vault': return <TallyVault />;
      case 'security-control': return <SecurityControl />;
      case 'roles-management': return <RolesManagement />;
      case 'control-centre': return <ControlCentre />;
      case 'print-configuration': return <PrintConfiguration />;
      case 'f11-features': return <F11CompanyFeatures />;
      case 'data-export-import': return <DataExportImport />;
      case 'cbms-dashboard': return <CbmsDashboard />;
      case 'receipt': return <ReceiptVoucher />;
      case 'payment': return <PaymentVoucher />;
      case 'contra': return <ContraVoucher />;
      case 'journal': return <JournalEntries />;
      case 'sales': return <SalesVoucher />;
      case 'purchase': return <PurchaseVoucher />;
      case 'debit-note': return <DebitNoteVoucher />;
      case 'credit-note': return <CreditNoteVoucher />;
      case 'sales-order': return <SalesOrderVoucher />;
      case 'purchase-order': return <PurchaseOrder />;
      case 'stock-journal': return <StockJournalPage />;
      case 'physical-stock': return <PhysicalStockPage />;
      case 'material-issued': return <MaterialIssuedPage />;
      case 'material-received': return <MaterialReceivedPage />;
      case 'production': return <ProductionPage />;
      case 'unassemble': return <UnassemblePage />;
      case 'delivery-challan': return <DeliveryChallan />;
      case 'receipt-note': return <GoodsReceiptNote />;
      case 'receipts-and-payments': return <ReceiptsAndPayments />;
      case 'payment-advice': return <PaymentAdvice />;

            default:
        return (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-[#EBF5E2] border border-[#000000] rounded-lg p-8 h-full shadow-sm animate-fadeIn">
            <div className="w-16 h-16 bg-[#D4EABD] rounded-full flex items-center justify-center mb-4 border border-[#000000]">
              <svg className="w-8 h-8 text-[#000000]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-[16px] font-bold text-[#000000] tracking-tight mb-2">Module Under Development</h2>
            <p className="text-[12px] text-[#000000] max-w-md mx-auto mb-6">
              The <span className="font-semibold px-1 py-0.5 bg-[#D4EABD] rounded text-[#000000] border border-[#9DC07A]">"{currentPage}"</span> module is currently under active development. This feature will be available in an upcoming update.
            </p>
            <button
              onClick={() => useStore.getState().setCurrentPage("dashboard")}
              className="h-9 px-5 bg-white hover:bg-[#D4EABD] text-[#000000] text-[12px] font-bold rounded cursor-pointer border border-[#000000] transition-colors shadow-[2px_2px_0px_#000000] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]"
            >
              Return to Dashboard
            </button>
          </div>
        );
    }
  };

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
    <F12Provider>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            {renderPage()}
          </Suspense>
        </ErrorBoundary>
      </Layout>
      
      <ShortcutPanel />
      <F12Panel />

      {/* Modals and Overlays */}
      <CalculatorPanel isOpen={calcOpen} onClose={() => setCalcOpen(false)} />
      <DisplayLanguageModal isOpen={displayLangOpen} onClose={() => setDisplayLangOpen(false)} />
      <DataEntryLanguageModal isOpen={dataEntryLangOpen} onClose={() => setDataEntryLangOpen(false)} />
      
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
    </F12Provider>
  );
};

export default App;

