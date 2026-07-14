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
import { ReportWorkspace } from "@/features/reports";
import { computeProfitLoss, exportPLToExcel, exportPLToCSV } from "../lib/profitLossEngine";
import type { PLReportOptions, PLComputation, PLDrillState } from "../lib/plTypes";
import { RefreshCw, AlertTriangle } from "lucide-react";
import toast from "@/lib/appToast";
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

  const periodLabel = `${options.fromDate} to ${options.toDate}`;

  return (
    <ReportWorkspace
      title="Profit and loss"
      description="Income and expenses for the period."
      companyName={companyName}
      nameNepali={companySettings?.companyNameNe || companySettings?.nameNepali}
      pan={companySettings?.panNumber || companySettings?.vatNumber}
      periodLabel={periodLabel}
      status={
        plData
          ? {
              tone: plData.netProfit >= 0 ? "success" : "danger",
              label: `${plData.netProfitLabel}: Rs. ${fmtMoney(Math.abs(plData.netProfit))}`,
            }
          : undefined
      }
      onRefresh={handleRefresh}
      onPrint={handleExportPDF}
      onExportExcel={handleExportExcel}
      onExportCsv={handleExportCSV}
      onExportPdf={handleExportPDF}
      onOptions={() => setShowOptionsDialog(true)}
      breadcrumb={
        drillState.level > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <button
              type="button"
              onClick={handleDrillBack}
              className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 py-1 text-[13px] font-medium hover:bg-[var(--ds-surface-hover)]"
            >
              Back
            </button>
            <span className="text-[var(--ds-text-muted)]">
              {[
                drillState.selectedGroupLabel,
                drillState.selectedAccountName,
                drillState.level >= 3 ? "Voucher" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ) : null
      }
      filterSlot={
        options.updateClosingStock ? (
          <label className="flex flex-col gap-1 text-[12px] text-[var(--ds-text-muted)]">
            Closing stock (Rs.)
            <input
              type="number"
              className="h-8 w-36 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[13px] text-[var(--ds-text-default)]"
              value={closingStockOverride ?? plData?.closingStock ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) handleClosingStockUpdate(v);
              }}
            />
          </label>
        ) : (
          <span className="text-[12px] text-[var(--ds-text-muted)]">
            {VARIANT_LABELS[options.variant]}
          </span>
        )
      }
      kpiSlot={
        !loading && !error && plData && drillState.level === 0 ? (
          <>
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                Sales
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-[var(--ds-text-default)]">
                {fmtMoney(plData.sales.total)}
              </p>
            </div>
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                Purchases
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-[var(--ds-text-default)]">
                {fmtMoney(plData.purchases.total)}
              </p>
            </div>
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                {plData.grossProfitLabel}
              </p>
              <p
                className={`mt-0.5 font-mono text-[13px] font-semibold ${
                  plData.grossProfit >= 0
                    ? "text-[var(--ds-action-primary)]"
                    : "text-[var(--ds-status-danger)]"
                }`}
              >
                {fmtMoney(Math.abs(plData.grossProfit))}
              </p>
            </div>
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                {plData.netProfitLabel}
              </p>
              <p
                className={`mt-0.5 font-mono text-[13px] font-semibold ${
                  plData.netProfit >= 0
                    ? "text-[var(--ds-status-success)]"
                    : "text-[var(--ds-status-danger)]"
                }`}
              >
                {fmtMoney(Math.abs(plData.netProfit))}
              </p>
            </div>
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex min-h-[200px] flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin text-[var(--ds-action-primary)]" />
            <p className="text-[13px] font-medium text-[var(--ds-text-muted)]">
              Computing profit & loss…
            </p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="m-1 flex items-start gap-3 rounded-md border border-[var(--ds-status-danger)]/30 bg-[var(--ds-status-danger-surface)] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-status-danger)]" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--ds-status-danger)]">
              Computation error
            </p>
            <p className="mt-1 text-[13px] text-[var(--ds-status-danger)]">{error}</p>
            <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">
              Tip: Ensure account groups are correctly classified (Sales, Purchase, Direct/Indirect
              Expenses/Income). Go to Chart of Accounts and verify each account&apos;s group type.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && !plData && (
        <ReportEmptyState
          message="Profit & loss not loaded"
          hint="Open Options and confirm settings, or click Refresh to compute the report."
        />
      )}

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
        <div ref={reportRef}>
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

          <div className="mt-4 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-2 text-[12px] text-[var(--ds-text-muted)] ds-no-print no-print">
            {VARIANT_LABELS[options.variant]} · {plData.fromDate} to {plData.toDate}
            {options.showSecondLevel && " · Detailed view"}
            {options.showPercentage && " · %"}
            {options.showPreviousYear && " · Previous year"}
          </div>
        </div>
      )}
    </ReportWorkspace>
  );
}
