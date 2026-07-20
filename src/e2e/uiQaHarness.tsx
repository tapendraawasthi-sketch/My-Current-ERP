import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { pageIdToPath } from "../routing/pagePaths";
import { ToastProvider } from "@/design-system";
import { ThemeProvider } from "../context/ThemeContext";
import { bootstrapUiQaHarness } from "./bootstrapUiQaHarness";
import AppShell from "../components/shell/AppShell";
import FinancialDashboard from "../pages/FinancialDashboard";
import OrbixWorkspacePage from "../pages/OrbixWorkspacePage";
import Parties from "../pages/Parties";
import JournalEntries from "../pages/JournalEntries";
import BillingInvoice from "../pages/BillingInvoice";
import BalanceSheet from "../pages/BalanceSheet";
import StockBook from "../pages/StockBook";
import DayBook from "../pages/DayBook";
import StockJournalPage from "../pages/StockJournalPage";
import ChartOfAccounts from "../components/ChartOfAccounts";
import PurchaseVoucher from "../pages/PurchaseVoucher";
import ReceiptVoucher from "../pages/ReceiptVoucher";
import PaymentVoucher from "../pages/PaymentVoucher";
import GeneralLedger from "../pages/GeneralLedger";
import TrialBalance from "../pages/TrialBalance";
import ProfitLoss from "../pages/ProfitLoss";
import BankReconciliation from "../pages/BankReconciliation";
import BankStatementImport from "../pages/BankStatementImport";
import StockSummaryReport from "../pages/StockSummaryReport";
import AuditLog from "../pages/AuditLog";
import UsersManagement from "../pages/UsersManagement";
import CompanySettings from "../pages/CompanySettings";
import BackupRestore from "../pages/BackupRestore";
import "../styles.css";

/**
 * UI QA / visual-baseline page router.
 * Extends Phase UI-0 critical-screen coverage; does not change accounting behavior.
 */
function QaPageRouter() {
  const currentPage = useStore((s) => s.currentPage);

  switch (currentPage) {
    case "orbix":
      return <OrbixWorkspacePage />;
    case "parties":
    case "party-master":
      return <Parties />;
    case "journal":
      return <JournalEntries />;
    case "billing":
    case "purchase-invoice":
    case "sales-invoice":
    case "sales-return":
    case "purchase-return":
      return <BillingInvoice />;
    case "purchase":
      return <PurchaseVoucher />;
    case "receipt":
      return <ReceiptVoucher />;
    case "payment":
      return <PaymentVoucher />;
    case "day-book":
      return <DayBook />;
    case "ledger":
    case "ledger-report":
      return <GeneralLedger />;
    case "trial-balance":
      return <TrialBalance />;
    case "profit-loss":
      return <ProfitLoss />;
    case "balance-sheet":
      return <BalanceSheet />;
    case "bank-reconciliation":
      return <BankReconciliation />;
    case "bank-statement-import":
      return <BankStatementImport />;
    case "items":
    case "item-master":
    case "stock-book":
      return <StockBook />;
    case "stock-summary":
    case "inventory-summary":
      return <StockSummaryReport />;
    case "stock-journal":
      return <StockJournalPage />;
    case "accounts":
    case "chart-of-accounts":
      return <ChartOfAccounts />;
    case "audit-log":
      return <AuditLog />;
    case "users":
    case "users-management":
      return <UsersManagement />;
    case "settings":
    case "company-settings":
      return <CompanySettings />;
    case "backup":
    case "backup-restore":
      return <BackupRestore />;
    case "dashboard":
    case "financial-dashboard":
    default:
      return <FinancialDashboard />;
  }
}

/** Keep MemoryRouter path aligned with Zustand currentPage for useAppRoute consumers. */
function UiQaRouteSync() {
  const currentPage = useStore((s) => s.currentPage);
  const navigate = useNavigate();
  useEffect(() => {
    navigate(pageIdToPath(currentPage || "dashboard"), { replace: true });
  }, [currentPage, navigate]);
  return null;
}

function UiQaApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapUiQaHarness()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return (
      <div data-testid="ui-qa-harness-error" className="p-4 text-[13px] text-red-700">
        UI QA harness error: {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div data-testid="ui-qa-harness-loading" className="p-4 text-[13px] text-gray-600">
        Loading UI QA harness…
      </div>
    );
  }

  return (
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <ThemeProvider>
        <ToastProvider>
          <UiQaRouteSync />
          <div data-testid="ui-qa-harness-ready" className="h-screen">
            <AppShell>
              <QaPageRouter />
            </AppShell>
          </div>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("UI QA harness root missing");
ReactDOM.createRoot(root).render(<UiQaApp />);
