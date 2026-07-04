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
import { ReportEmptyState } from "../components/ReportEmptyState";
import NepalFinancialStatementView from "../components/reports/NepalFinancialStatementView";
import {
  FinancialStatementHeader,
  FinancialStatementFooter,
  formatPeriodRange,
} from "../components/reports/FinancialStatementChrome";
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

const fmtMoney = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const VARIANT_LABELS: Record<PLReportOptions["variant"], string> = {
  horizontal: "Horizontal (T-format)",
  vertical: "Vertical (waterfall)",
  "monthly-summary": "Monthly summary",
  "detailed-monthly": "Detailed monthly",
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
    <div className="erp-report flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-hidden">
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

      {loading && (
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin text-[#1557b0]" />
            <p className="text-[12px] text-gray-600 font-medium">Computing profit & loss…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-red-700">Computation error</p>
            <p className="text-[12px] text-red-600 mt-1">{error}</p>
            <p className="text-[11px] text-red-500 mt-1">
              Tip: Ensure account groups are correctly classified (Sales, Purchase, Direct/Indirect
              Expenses/Income). Go to Chart of Accounts and verify each account's group type.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && !plData && (
        <div className="flex-1 p-4 min-h-0">
          <div className="bg-white border border-gray-200 rounded-md">
            <ReportEmptyState
              message="Profit & loss not loaded"
              hint="Open Options and confirm settings, or click Refresh to compute the report."
            />
          </div>
        </div>
      )}

      {!loading && !error && plData && drillState.level === 0 && (
        <div className="no-print px-4 pt-3 shrink-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Sales
              </p>
              <p className="text-[12px] text-gray-800 mt-0.5 number-cell-bold">
                {fmtMoney(plData.sales.total)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Purchases
              </p>
              <p className="text-[12px] text-gray-800 mt-0.5 number-cell-bold">
                {fmtMoney(plData.purchases.total)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {plData.grossProfitLabel}
              </p>
              <p
                className={`text-[12px] mt-0.5 number-cell-bold ${
                  plData.grossProfit >= 0 ? "text-[#1557b0]" : "text-red-700"
                }`}
              >
                {fmtMoney(Math.abs(plData.grossProfit))}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {plData.netProfitLabel}
              </p>
              <p
                className={`text-[12px] mt-0.5 number-cell-bold ${
                  plData.netProfit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {fmtMoney(Math.abs(plData.netProfit))}
              </p>
            </div>
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

      {!loading && !error && plData && drillState.level === 0 && (
        <div ref={reportRef} className="flex-1 overflow-auto p-4 min-h-0">
          <FinancialStatementHeader
            companyName={companyName}
            companyNameNepali={companySettings?.companyNameNe || companySettings?.nameNepali}
            address={companySettings?.address}
            pan={companySettings?.panNumber || companySettings?.vatNumber}
            reportTitle={
              options.variant === "horizontal"
                ? "Trading and Profit & Loss Account"
                : "Profit & Loss Account"
            }
            period={formatPeriodRange(plData.fromDate, plData.toDate)}
          />

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

          {(options.variant === "horizontal" || options.variant === "vertical") && (
            <FinancialStatementFooter />
          )}

          <div className="mt-4 px-3 py-2 bg-white border border-gray-200 rounded-md text-[11px] text-gray-500 no-print">
            {VARIANT_LABELS[options.variant]} · {plData.fromDate} to {plData.toDate}
            {options.showSecondLevel && " · Detailed view"}
            {options.showPercentage && " · %"}
            {options.showPreviousYear && " · Previous year"}
          </div>
        </div>
      )}
    </div>
  );
}
