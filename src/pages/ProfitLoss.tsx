// src/pages/ProfitLoss.tsx
// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStore } from "../store/useStore";
import PLOptionsDialog from "../components/pl/PLOptionsDialog";
import PLHorizontal from "../components/pl/PLHorizontal";
import PLVertical from "../components/pl/PLVertical";
import PLMonthlySummary from "../components/pl/PLMonthlySummary";
import PLDetailedMonthly from "../components/pl/PLDetailedMonthly";
import PLDrillDown from "../components/pl/PLDrillDown";
import PLToolbar from "../components/pl/PLToolbar";
import { computeProfitLoss, exportPLToExcel, exportPLToCSV } from "../lib/profitLossEngine";
import type { PLReportOptions, PLComputation, PLDrillState } from "../lib/plTypes";
import { RefreshCw, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import NepalFinancialStatementView from "../components/reports/NepalFinancialStatementView";
import {
  buildProfitLossData,
  profitLossDataToRows,
  shiftDateByYears,
} from "../lib/nepalFinancialStatements";

const DEFAULT_OPTIONS: PLReportOptions = {
  fromDate: new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0], // April 1
  toDate: new Date().toISOString().split("T")[0],
  showSecondLevel: false,
  updateClosingStock: false,
  showPercentage: false,
  showPreviousYear: false,
  variant: "horizontal",
};

const PL_STORAGE_KEY = "sutra_pl_options";

const loadPLOptions = (): PLReportOptions | null => {
  try {
    const raw = localStorage.getItem(PL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const savePLOptions = (opts: PLReportOptions) => {
  try {
    localStorage.setItem(
      PL_STORAGE_KEY,
      JSON.stringify({ ...opts, _savedAt: new Date().toISOString() }),
    );
  } catch {}
};

export default function ProfitLoss() {
  const { companySettings, currentFiscalYear, accounts, vouchers } = useStore();

  // ── State ─────────────────────────────────────────────────────────────────
  const storedPLOpts = loadPLOptions();
  const [showOptionsDialog, setShowOptionsDialog] = useState(!storedPLOpts);
  const [options, setOptions] = useState<PLReportOptions>(() => {
    if (storedPLOpts) return storedPLOpts;
    const opts = { ...DEFAULT_OPTIONS };
    if (currentFiscalYear?.startDate) opts.fromDate = currentFiscalYear.startDate;
    if (currentFiscalYear?.endDate) opts.toDate = currentFiscalYear.endDate;
    return opts;
  });
  const [plData, setPlData] = useState<PLComputation | null>(null);
  const [nasPlRows, setNasPlRows] = useState<ReturnType<typeof profitLossDataToRows> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillState, setDrillState] = useState<PLDrillState>({ level: 0 });
  const [closingStockOverride, setClosingStockOverride] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Compute P&L ───────────────────────────────────────────────────────────
  const runCompute = useCallback(
    async (opts: PLReportOptions, stockOverride?: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const result = await computeProfitLoss(opts);
        if (stockOverride !== null && stockOverride !== undefined) {
          result.closingStock = stockOverride;
          // Recompute derived figures
          const tradingDebit =
            result.purchases.total + result.directExpenses.total + result.openingStock;
          const tradingCredit = result.sales.total + result.directIncome.total + stockOverride;
          result.grossProfit = tradingCredit - tradingDebit;
          result.grossProfitLabel = result.grossProfit >= 0 ? "Gross Profit" : "Gross Loss";
          const plDebitBase = result.grossProfit < 0 ? Math.abs(result.grossProfit) : 0;
          const plCreditBase = result.grossProfit > 0 ? result.grossProfit : 0;
          result.plDebitTotal = plDebitBase + result.indirectExpenses.total;
          result.plCreditTotal = plCreditBase + result.indirectIncome.total;
          result.netProfit = result.plCreditTotal - result.plDebitTotal;
          result.netProfitLabel = result.netProfit >= 0 ? "Net Profit" : "Net Loss";
        }
        setPlData(result);

        if (opts.variant === "vertical") {
          const prevFrom = shiftDateByYears(opts.fromDate, -1);
          const prevTo = shiftDateByYears(opts.toDate, -1);
          const nas = buildProfitLossData({
            accounts: (accounts || []) as any[],
            currentVouchers: (vouchers || []) as any[],
            previousVouchers: (vouchers || []) as any[],
            fromDate: opts.fromDate,
            toDate: opts.toDate,
            previousFromDate: prevFrom,
            previousToDate: prevTo,
            closingStockCurrent: result.closingStock,
          });
          setNasPlRows(profitLossDataToRows(nas));
        } else {
          setNasPlRows(null);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to compute P&L. Check account groupings.");
        toast.error("P&L computation failed.");
      } finally {
        setLoading(false);
      }
    },
    [accounts, vouchers],
  );

  const handleOptionsConfirm = useCallback(
    (newOptions: PLReportOptions) => {
      setOptions(newOptions);
      savePLOptions(newOptions);
      setShowOptionsDialog(false);
      setDrillState({ level: 0 });
      runCompute(newOptions, closingStockOverride);
    },
    [runCompute, closingStockOverride],
  );

  useEffect(() => {
    if (storedPLOpts) {
      runCompute(storedPLOpts);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (plData) runCompute(options, closingStockOverride);
  }, [options, plData, runCompute, closingStockOverride]);

  const handleClosingStockUpdate = useCallback(
    (value: number) => {
      setClosingStockOverride(value);
      runCompute(options, value);
      toast.success("Closing stock updated.");
    },
    [options, runCompute],
  );

  const handleDrillDown = useCallback((newState: PLDrillState) => {
    setDrillState(newState);
  }, []);

  const handleDrillBack = useCallback(() => {
    setDrillState((prev) => ({
      ...prev,
      level: Math.max(0, prev.level - 1) as PLDrillState["level"],
    }));
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!plData) return;
    exportPLToExcel(plData, companySettings?.name || "Company");
    toast.success("Exported to Excel.");
  }, [plData, companySettings]);

  const handleExportCSV = useCallback(() => {
    if (!plData) return;
    exportPLToCSV(plData);
    toast.success("Exported to CSV.");
  }, [plData]);

  const handleExportPDF = useCallback(() => {
    if (!reportRef.current) return;
    window.print();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drillState.level > 0) {
        handleDrillBack();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        handleRefresh();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleExportPDF();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExportExcel();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drillState, handleDrillBack, handleRefresh, handleExportPDF, handleExportExcel]);

  const companyName = companySettings?.name || companySettings?.companyNameEn || "Company";

  // ── Render ────────────────────────────────────────────────────────────────
  if (showOptionsDialog) {
    return (
      <PLOptionsDialog
        defaultOptions={options}
        onConfirm={handleOptionsConfirm}
        onCancel={() => setShowOptionsDialog(false)}
        companyName={companyName}
        fiscalYear={currentFiscalYear}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Toolbar */}
      <PLToolbar
        options={options}
        onOpenOptions={() => setShowOptionsDialog(true)}
        onRefresh={handleRefresh}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        loading={loading}
        hasDrill={drillState.level > 0}
        onBack={handleDrillBack}
        drillState={drillState}
        companyName={companyName}
        plData={plData}
        closingStock={closingStockOverride ?? plData?.closingStock}
        onClosingStockChange={handleClosingStockUpdate}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#1557b0]" />
            <p className="text-[13px] text-gray-600 font-medium">Computing Profit & Loss…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-700">Computation Error</p>
            <p className="text-[12px] text-red-600 mt-1">{error}</p>
            <p className="text-[11px] text-red-500 mt-1">
              Tip: Ensure account groups are correctly classified (Sales, Purchase, Direct/Indirect
              Expenses/Income). Go to Chart of Accounts and verify each account's group type.
            </p>
          </div>
        </div>
      )}

      {/* Drill-down overlay */}
      {drillState.level > 0 && !loading && (
        <PLDrillDown
          drillState={drillState}
          options={options}
          plData={plData}
          onDrillDown={handleDrillDown}
          onBack={handleDrillBack}
          companyName={companyName}
        />
      )}

      {/* Main report */}
      {!loading && !error && plData && drillState.level === 0 && (
        <div ref={reportRef} className="flex-1 overflow-auto p-4">
          {/* Company + Report Header */}
          <div className="text-center mb-4 print-only" style={{ display: "none" }}>
            <div className="text-[16px] font-bold">{companyName}</div>
            <div className="text-[13px] font-semibold mt-1">Trading and Profit & Loss Account</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              For the period: {plData.fromDate} to {plData.toDate}
            </div>
          </div>

          {/* Variant renderer */}
          {options.variant === "horizontal" && (
            <PLHorizontal
              pl={plData}
              options={options}
              onDrillDown={handleDrillDown}
              onClosingStockUpdate={
                options.updateClosingStock ? handleClosingStockUpdate : undefined
              }
            />
          )}
          {options.variant === "vertical" && nasPlRows ? (
            <NepalFinancialStatementView
              title="Profit & Loss — NAS / Schedule III"
              subtitle={`For the period ${plData.fromDate} to ${plData.toDate}`}
              rows={nasPlRows}
              currentYearLabel={currentFiscalYear?.name || plData.toDate.slice(0, 4)}
              previousYearLabel={String(
                Number((currentFiscalYear?.name || plData.toDate.slice(0, 4)) - 1) || "Previous",
              )}
            />
          ) : options.variant === "vertical" ? (
            <PLVertical pl={plData} options={options} onDrillDown={handleDrillDown} />
          ) : null}
          {options.variant === "monthly-summary" && (
            <PLMonthlySummary pl={plData} options={options} onDrillDown={handleDrillDown} />
          )}
          {options.variant === "detailed-monthly" && (
            <PLDetailedMonthly pl={plData} options={options} onDrillDown={handleDrillDown} />
          )}
        </div>
      )}
    </div>
  );
}
