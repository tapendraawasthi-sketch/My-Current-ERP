// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import {
  buildAccountTree,
  computeLedgerTotals,
  computeGroupTotals,
} from "../lib/reportingHierarchy";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const RatioAnalysis: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("ratio-analysis");

  const { vouchers, accounts, stockMovements, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setOptionsOpen(false);
  };

  // Compute ratios data
  const ratiosData = useMemo(() => {
    if (!vouchers || !accounts)
      return {
        liquidity: [],
        profitability: [],
        efficiency: [],
        solvency: [],
      };

    // Filter vouchers for the period
    const periodVouchers = vouchers.filter(
      (v) => v.status === "posted" && v.date >= startDate && v.date <= endDate,
    );

    // Compute ledger totals for the period
    const ledgerTotals = computeLedgerTotals(periodVouchers, startDate, endDate);

    // Calculate totals for different account types
    let totalCurrentAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalStock = 0;
    let totalCash = 0;
    let totalDebt = 0;
    let totalEquity = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalDebtors = 0;
    let totalCreditors = 0;
    let grossProfit = 0;
    let netSales = 0;
    let purchases = 0;
    let interestExpense = 0;

    // Calculate account balances
    accounts.forEach((acc) => {
      const balance =
        (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);

      // Determine if account is current asset
      const isCurrentAsset =
        acc.type === "asset" &&
        (acc.name.toLowerCase().includes("cash") ||
          acc.name.toLowerCase().includes("bank") ||
          acc.name.toLowerCase().includes("debtor") ||
          acc.name.toLowerCase().includes("stock") ||
          acc.name.toLowerCase().includes("sundry debtor") ||
          acc.name.toLowerCase().includes("current asset"));

      // Determine if account is current liability
      const isCurrentLiability =
        acc.type === "liability" &&
        (acc.name.toLowerCase().includes("creditor") ||
          acc.name.toLowerCase().includes("duty") ||
          acc.name.toLowerCase().includes("tax") ||
          acc.name.toLowerCase().includes("provision") ||
          acc.name.toLowerCase().includes("sundry creditor") ||
          acc.name.toLowerCase().includes("current liability"));

      // Determine if account is debt/loan
      const isDebt =
        acc.type === "liability" &&
        (acc.name.toLowerCase().includes("loan") ||
          acc.name.toLowerCase().includes("borrowing") ||
          acc.name.toLowerCase().includes("secured"));

      // Determine if account is equity
      const isEquity = acc.type === "equity";

      if (isCurrentAsset) {
        totalCurrentAssets += balance;
      }

      if (isCurrentLiability) {
        totalCurrentLiabilities += balance;
      }

      if (isDebt) {
        totalDebt += balance;
      }

      if (isEquity) {
        totalEquity += balance;
      }

      if (acc.type === "asset") {
        totalAssets += balance;
      }

      if (acc.type === "liability") {
        totalLiabilities += balance;
      }

      if (acc.name.toLowerCase().includes("cash") || acc.name.toLowerCase().includes("bank")) {
        totalCash += balance;
      }

      if (
        acc.name.toLowerCase().includes("debtor") ||
        acc.name.toLowerCase().includes("sundry debtor")
      ) {
        totalDebtors += balance;
      }

      if (
        acc.name.toLowerCase().includes("creditor") ||
        acc.name.toLowerCase().includes("sundry creditor")
      ) {
        totalCreditors += balance;
      }

      if (acc.name.toLowerCase().includes("interest") && acc.type === "expense") {
        interestExpense += balance;
      }

      if (
        acc.name.toLowerCase().includes("stock") ||
        acc.name.toLowerCase().includes("inventory")
      ) {
        totalStock += balance;
      }
    });

    // Calculate net sales from sales invoices
    periodVouchers.forEach((v) => {
      if (v.type === "sales-invoice") {
        netSales += v.totalDebit || v.grandTotal || 0;
      }
      if (v.type === "purchase-invoice") {
        purchases += v.totalDebit || v.grandTotal || 0;
      }
    });

    // Calculate gross profit (simplified)
    const directExpenses = accounts
      .filter((acc) => acc.type === "expense")
      .reduce((sum, acc) => {
        const balance =
          (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
        return sum + balance;
      }, 0);
    grossProfit = netSales - directExpenses;

    // Calculate net profit (simplified)
    const expenses = accounts
      .filter((acc) => acc.type === "expense")
      .reduce((sum, acc) => {
        const balance =
          (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
        return sum + balance;
      }, 0);
    const incomes = accounts
      .filter((acc) => acc.type === "income")
      .reduce((sum, acc) => {
        const balance =
          (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
        return sum + balance;
      }, 0);
    const netProfit = incomes - expenses;

    // Calculate ratios
    const currentRatio =
      totalCurrentLiabilities !== 0 ? totalCurrentAssets / totalCurrentLiabilities : NaN;
    const quickRatio =
      totalCurrentLiabilities !== 0
        ? (totalCurrentAssets - totalStock) / totalCurrentLiabilities
        : NaN;
    const cashRatio = totalCurrentLiabilities !== 0 ? totalCash / totalCurrentLiabilities : NaN;

    const grossProfitPercent = netSales !== 0 ? (grossProfit / netSales) * 100 : NaN;
    const netProfitPercent = netSales !== 0 ? (netProfit / netSales) * 100 : NaN;
    const returnOnAssets = totalAssets !== 0 ? (netProfit / totalAssets) * 100 : NaN;
    const returnOnEquity = totalEquity !== 0 ? (netProfit / totalEquity) * 100 : NaN;

    const debtorsTurnover = totalDebtors !== 0 ? netSales / totalDebtors : NaN;
    const debtorsDays = debtorsTurnover !== 0 ? 365 / debtorsTurnover : NaN;
    const creditorsTurnover = totalCreditors !== 0 ? purchases / totalCreditors : NaN;
    const creditorsDays = creditorsTurnover !== 0 ? 365 / creditorsTurnover : NaN;
    const inventoryTurnover = totalStock !== 0 ? netSales / totalStock : NaN;
    const inventoryDays = inventoryTurnover !== 0 ? 365 / inventoryTurnover : NaN;

    const debtToEquity = totalEquity !== 0 ? totalDebt / totalEquity : NaN;
    const debtToAssets = totalAssets !== 0 ? totalDebt / totalAssets : NaN;
    const interestCoverage = interestExpense !== 0 ? grossProfit / interestExpense : NaN;

    // Helper function to determine status
    const getStatus = (
      value: number,
      good: number,
      caution: number,
      poor: number,
      isHigherBetter: boolean,
    ) => {
      if (isNaN(value)) return { label: "N/A", className: "bg-gray-100 text-gray-700" };

      if (isHigherBetter) {
        if (value >= good) return { label: "Good", className: "bg-green-100 text-green-700" };
        if (value >= caution) return { label: "Caution", className: "bg-amber-100 text-amber-700" };
        return { label: "Poor", className: "bg-red-100 text-red-700" };
      } else {
        if (value <= poor) return { label: "Good", className: "bg-green-100 text-green-700" };
        if (value <= caution) return { label: "Caution", className: "bg-amber-100 text-amber-700" };
        return { label: "Poor", className: "bg-red-100 text-red-700" };
      }
    };

    // Liquidity Ratios
    const liquidity = [
      {
        id: "liquidity-1",
        name: "Current Ratio",
        formula: "Current Assets / Current Liabilities",
        value: isNaN(currentRatio) ? "N/A" : currentRatio.toFixed(2),
        benchmark: "> 2:1 (Good)",
        status: getStatus(currentRatio, 2, 1, 1, true),
      },
      {
        id: "liquidity-2",
        name: "Quick Ratio",
        formula: "(Current Assets - Stock) / Current Liabilities",
        value: isNaN(quickRatio) ? "N/A" : quickRatio.toFixed(2),
        benchmark: "> 1:1 (Good)",
        status: getStatus(quickRatio, 1, 0.5, 0.5, true),
      },
      {
        id: "liquidity-3",
        name: "Cash Ratio",
        formula: "Cash / Current Liabilities",
        value: isNaN(cashRatio) ? "N/A" : cashRatio.toFixed(2),
        benchmark: "> 0.5:1 (Good)",
        status: getStatus(cashRatio, 0.5, 0.25, 0.25, true),
      },
    ];

    // Profitability Ratios
    const profitability = [
      {
        id: "profit-1",
        name: "Gross Profit %",
        formula: "(Gross Profit / Net Sales) * 100",
        value: isNaN(grossProfitPercent) ? "N/A" : `${grossProfitPercent.toFixed(2)}%`,
        benchmark: "> 20% (Good)",
        status: getStatus(grossProfitPercent, 20, 10, 10, true),
      },
      {
        id: "profit-2",
        name: "Net Profit %",
        formula: "(Net Profit / Net Sales) * 100",
        value: isNaN(netProfitPercent) ? "N/A" : `${netProfitPercent.toFixed(2)}%`,
        benchmark: "> 15% (Good)",
        status: getStatus(netProfitPercent, 15, 5, 5, true),
      },
      {
        id: "profit-3",
        name: "Return on Assets",
        formula: "(Net Profit / Total Assets) * 100",
        value: isNaN(returnOnAssets) ? "N/A" : `${returnOnAssets.toFixed(2)}%`,
        benchmark: "> 5% (Good)",
        status: getStatus(returnOnAssets, 5, 2, 2, true),
      },
      {
        id: "profit-4",
        name: "Return on Equity",
        formula: "(Net Profit / Total Equity) * 100",
        value: isNaN(returnOnEquity) ? "N/A" : `${returnOnEquity.toFixed(2)}%`,
        benchmark: "> 15% (Good)",
        status: getStatus(returnOnEquity, 15, 8, 8, true),
      },
    ];

    // Efficiency Ratios
    const efficiency = [
      {
        id: "effic-1",
        name: "Debtors Turnover",
        formula: "Net Sales / Avg Debtors",
        value: isNaN(debtorsTurnover) ? "N/A" : debtorsTurnover.toFixed(2),
        benchmark: "> 6x (Good)",
        status: getStatus(debtorsTurnover, 6, 3, 3, true),
      },
      {
        id: "effic-2",
        name: "Debtors Days",
        formula: "365 / Debtors Turnover",
        value: isNaN(debtorsDays) ? "N/A" : `${debtorsDays.toFixed(0)} days`,
        benchmark: "< 60 days (Good)",
        status: getStatus(debtorsDays, 30, 60, 60, false),
      },
      {
        id: "effic-3",
        name: "Creditors Turnover",
        formula: "Purchases / Avg Creditors",
        value: isNaN(creditorsTurnover) ? "N/A" : creditorsTurnover.toFixed(2),
        benchmark: "> 4x (Good)",
        status: getStatus(creditorsTurnover, 4, 2, 2, true),
      },
      {
        id: "effic-4",
        name: "Creditors Days",
        formula: "365 / Creditors Turnover",
        value: isNaN(creditorsDays) ? "N/A" : `${creditorsDays.toFixed(0)} days`,
        benchmark: "< 90 days (Good)",
        status: getStatus(creditorsDays, 30, 90, 90, false),
      },
      {
        id: "effic-5",
        name: "Inventory Turnover",
        formula: "Net Sales / Avg Inventory",
        value: isNaN(inventoryTurnover) ? "N/A" : inventoryTurnover.toFixed(2),
        benchmark: "> 4x (Good)",
        status: getStatus(inventoryTurnover, 4, 2, 2, true),
      },
      {
        id: "effic-6",
        name: "Inventory Days",
        formula: "365 / Inventory Turnover",
        value: isNaN(inventoryDays) ? "N/A" : `${inventoryDays.toFixed(0)} days`,
        benchmark: "< 90 days (Good)",
        status: getStatus(inventoryDays, 30, 90, 90, false),
      },
    ];

    // Solvency Ratios
    const solvency = [
      {
        id: "solv-1",
        name: "Debt to Equity",
        formula: "Total Debt / Total Equity",
        value: isNaN(debtToEquity) ? "N/A" : debtToEquity.toFixed(2),
        benchmark: "< 0.5 (Good)",
        status: getStatus(debtToEquity, 0.5, 1, 1, false),
      },
      {
        id: "solv-2",
        name: "Debt to Assets",
        formula: "Total Debt / Total Assets",
        value: isNaN(debtToAssets) ? "N/A" : debtToAssets.toFixed(2),
        benchmark: "< 0.4 (Good)",
        status: getStatus(debtToAssets, 0.4, 0.6, 0.6, false),
      },
      {
        id: "solv-3",
        name: "Interest Coverage",
        formula: "Gross Profit / Interest Expense",
        value: isNaN(interestCoverage) ? "N/A" : interestCoverage.toFixed(2),
        benchmark: "> 3x (Good)",
        status: getStatus(interestCoverage, 3, 1.5, 1.5, true),
      },
    ];

    return {
      liquidity,
      profitability,
      efficiency,
      solvency,
    };
  }, [vouchers, accounts, stockMovements, startDate, endDate]);

  const columns = [
    { key: "name", label: "Ratio" },
    { key: "formula", label: "Formula" },
    { key: "value", label: "Value", align: "right" },
    { key: "benchmark", label: "Benchmark" },
    { key: "status", label: "Status", align: "center" },
  ];

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (columnKey === "name") {
      return <span className="font-semibold text-gray-800">{value}</span>;
    }
    if (columnKey === "formula") {
      return <span className="text-[11px] text-gray-500 italic">{value}</span>;
    }
    if (columnKey === "value") {
      return <span className="font-mono text-[#1557b0] font-semibold">{value}</span>;
    }
    if (columnKey === "benchmark") {
      return <span className="text-[11px] text-gray-600">{value}</span>;
    }
    if (columnKey === "status") {
      return (
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${value.className}`}
        >
          {value.label}
        </span>
      );
    }
    return value;
  };

  return (
    <ReportShell
      title="Ratio Analysis"
      subtitle="Financial health and performance metrics"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>
        </div>
      }
    >
      <div className="grid gap-8 grid-cols-1 xl:grid-cols-2 mb-8">
        {/* Liquidity Ratios */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Liquidity Ratios
          </h3>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <ReportGrid columns={columns} data={ratiosData.liquidity} renderCell={renderCell} />
          </div>
        </section>

        {/* Profitability Ratios */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Profitability Ratios
          </h3>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <ReportGrid columns={columns} data={ratiosData.profitability} renderCell={renderCell} />
          </div>
        </section>

        {/* Efficiency Ratios */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Efficiency Ratios
          </h3>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <ReportGrid columns={columns} data={ratiosData.efficiency} renderCell={renderCell} />
          </div>
        </section>

        {/* Solvency Ratios */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Solvency Ratios
          </h3>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <ReportGrid columns={columns} data={ratiosData.solvency} renderCell={renderCell} />
          </div>
        </section>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Ratio Analysis Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default RatioAnalysis;
