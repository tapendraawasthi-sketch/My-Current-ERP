import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "../context/ThemeContext";
import { bootstrapUiQaHarness } from "./bootstrapUiQaHarness";
import AppShell from "../components/shell/AppShell";
import { useStore } from "../store/useStore";
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
import "../styles.css";

function QaPageRouter() {
  const currentPage = useStore((s) => s.currentPage);

  switch (currentPage) {
    case "orbix":
      return <OrbixWorkspacePage />;
    case "parties":
      return <Parties />;
    case "journal":
      return <JournalEntries />;
    case "billing":
    case "purchase-invoice":
    case "sales-invoice":
    case "sales-return":
    case "purchase-return":
      return <BillingInvoice />;
    case "day-book":
      return <DayBook />;
    case "balance-sheet":
      return <BalanceSheet />;
    case "items":
    case "item-master":
    case "stock-book":
      return <StockBook />;
    case "stock-journal":
      return <StockJournalPage />;
    case "accounts":
    case "chart-of-accounts":
      return <ChartOfAccounts />;
    case "dashboard":
    case "financial-dashboard":
    default:
      return <FinancialDashboard />;
  }
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
    <ThemeProvider>
      <div data-testid="ui-qa-harness-ready" className="h-screen">
        <AppShell>
          <QaPageRouter />
        </AppShell>
        <Toaster position="top-right" />
      </div>
    </ThemeProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("UI QA harness root missing");
ReactDOM.createRoot(root).render(<UiQaApp />);
