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
  const { currentPage } = useStore();
  
  // NEW: Calculator and language modal state
  const [calcOpen, setCalcOpen] = useState(false);
  const [displayLangOpen, setDisplayLangOpen] = useState(false);
  const [dataEntryLangOpen, setDataEntryLangOpen] = useState(false);

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
      case 'configuration': return <ConfigurationHub />;
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
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-700">
            <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
            <p className="text-sm">Select a page from the menu to continue.</p>
          </div>
        );
    }
  };

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          {renderPage()}
        </Suspense>
      </ErrorBoundary>
      
      {/* Modals and Overlays */}
      <CalculatorPanel isOpen={calcOpen} onClose={() => setCalcOpen(false)} />
      <DisplayLanguageModal isOpen={displayLangOpen} onClose={() => setDisplayLangOpen(false)} />
      <DataEntryLanguageModal isOpen={dataEntryLangOpen} onClose={() => setDataEntryLangOpen(false)} />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            fontSize: '12px',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '6px',
          },
        }}
      />
    </>
  );
};

export default App;
