/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Profit & Loss / Income Statement report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Select, Table, NepaliDatePicker } from "../components/ui";
import { FileSpreadsheet, Printer, Activity, ChevronRight, ChevronDown } from "lucide-react";
import { computeProfitLoss } from "../lib/accounting";
import { exportPLStatementToExcel } from "../lib/exportUtils";
import { generatePLPDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { ReportPeriodPreset } from "../lib/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  differenceInCalendarDays,
  subDays,
} from "date-fns";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";

const presetOptions = [
  { value: "current-month", label: "Current Month" },
  { value: "quarter", label: "Quarter" },
  { value: "fy", label: "Fiscal Year" },
  { value: "custom", label: "Custom" },
];

const expenseCategoryLabels: Record<string, string> = {
  personnel: "Personnel Expenses",
  rentUtilities: "Rent & Utilities",
  communication: "Communication",
  travel: "Travel & Conveyance",
  office: "Office Expenses",
  marketing: "Marketing",
  financial: "Financial Expenses",
  depreciation: "Depreciation",
  other: "Other Operating Expenses",
};

interface PLRow {
  id: string;
  name: string;
  amount: number;
  prevAmount?: number;
  pctOfSales?: number;
  changePct?: number;
  level: number;
  isGroup: boolean;
  parentId?: string;
  children?: PLRow[];
  isSummary?: boolean;
}

const initialData = {
  startDate: "2026-07-16",
  endDate: "2027-07-15",
};

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, setCurrentPage } = useStore();
  const [preset, setPreset] = useState<string>("fy");
  const [startDate, setStartDate] = useState<string>(
    currentFiscalYear?.startDate || initialData.startDate,
  );
  const [endDate, setEndDate] = useState<string>(currentFiscalYear?.endDate || initialData.endDate);
  const [showComparison, setShowComparison] = useState<boolean>(true);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
    new Set([
      "operating-expenses",
      "financial-expenses",
      "other-income",
      "category-personnel",
      "category-rentUtilities",
      "category-communication",
      "category-travel",
      "category-office",
      "category-marketing",
    ]),
  );

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  useEffect(() => {
    if (preset !== "custom") {
      const range = computePresetRange(preset, currentFiscalYear);
      if (range) {
        setStartDate(range.startDate);
        setEndDate(range.endDate);
      }
    }
  }, [preset, currentFiscalYear]);

  const profitLoss = useMemo(() => {
    return computeProfitLoss(accounts, vouchers, startDate, endDate);
  }, [accounts, vouchers, startDate, endDate]);

  const previousPeriod = useMemo(() => {
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const days = differenceInCalendarDays(currentEnd, currentStart) + 1;
    const prevEnd = subDays(currentStart, 1);
    const prevStart = subDays(prevEnd, days - 1);
    return {
      startDate: dateToAD(prevStart),
      endDate: dateToAD(prevEnd),
    };
  }, [startDate, endDate]);

  const previousProfitLoss = useMemo(() => {
    return computeProfitLoss(accounts, vouchers, previousPeriod.startDate, previousPeriod.endDate);
  }, [accounts, vouchers, previousPeriod.startDate, previousPeriod.endDate]);

  const operatingExpensesChildren = profitLoss.expenses[2]?.children || [];
  const allExpenseChildren = operatingExpensesChildren;
  const otherIncomeChildren = profitLoss.income[1]?.children || [];

  const salesRow = profitLoss.income[0] || {
    accountId: "sales",
    accountName: "Sales / Turnover",
    amount: 0,
    isGroup: true,
    level: 1,
    children: [],
  };
  const salesReturnAmount = sumChildrenMatching(salesRow.children || [], ["return"]);
  const netSalesAmount = round2(salesRow.amount - salesReturnAmount);
  const purchaseRow = profitLoss.expenses[0] || {
    accountId: "purchases",
    accountName: "Purchases",
    amount: 0,
    isGroup: true,
    level: 1,
    children: [],
  };
  const purchaseReturnAmount = sumChildrenMatching(purchaseRow.children || [], ["return"]);
  const directExpenseRow = profitLoss.expenses[1] || {
    accountId: "direct",
    accountName: "Direct Expenses",
    amount: 0,
    isGroup: true,
    level: 1,
    children: [],
  };
  const openingStockAmount = 0;
  const closingStockAmount = 0;
  const cogsAmount = round2(
    purchaseRow.amount + directExpenseRow.amount - purchaseReturnAmount - closingStockAmount,
  );
  const grossProfitAmount = round2(netSalesAmount - cogsAmount);
  const financialExpensesChildren = allExpenseChildren.filter((row) =>
    matchesAnyKeyword(row.accountName, ["bank", "interest", "finance"]),
  );
  const depreciationChildren = allExpenseChildren.filter((row) =>
    matchesAnyKeyword(row.accountName, ["depreciation", "depreciate"]),
  );
  const financialExpensesAmount = round2(
    financialExpensesChildren.reduce((sum, item) => sum + item.amount, 0),
  );
  const depreciationAmount = round2(
    depreciationChildren.reduce((sum, item) => sum + item.amount, 0),
  );
  const otherIncomeAmount = profitLoss.income[1]?.amount || 0;
  const operatingCategoryRows = buildOperatingCategories(allExpenseChildren);
  const operatingExpensesAmount = round2(
    operatingCategoryRows.reduce((sum, row) => sum + row.amount, 0),
  );
  const operatingProfitAmount = round2(
    grossProfitAmount +
      otherIncomeAmount -
      operatingExpensesAmount -
      financialExpensesAmount -
      depreciationAmount,
  );

  const dataRows: PLRow[] = useMemo(() => {
    const previousMap = buildPreviousMap(previousProfitLoss);
    const baseRows: PLRow[] = [
      {
        id: "trading-header",
        name: "TRADING ACCOUNT",
        amount: 0,
        level: 0,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "sales",
        name: "Sales / Turnover",
        amount: salesRow.amount,
        prevAmount: previousMap.salesAmount,
        pctOfSales: netSalesAmount ? round2((salesRow.amount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "sales-return",
        name: "Less: Sales Return",
        amount: -salesReturnAmount,
        prevAmount: -previousMap.salesReturnAmount,
        pctOfSales: netSalesAmount ? round2((-salesReturnAmount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "net-sales",
        name: "Net Sales",
        amount: netSalesAmount,
        prevAmount: previousMap.netSalesAmount,
        pctOfSales: 100,
        level: 1,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "cogs-header",
        name: "COST OF GOODS SOLD",
        amount: 0,
        level: 0,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "opening-stock",
        name: "Opening Stock",
        amount: openingStockAmount,
        prevAmount: previousMap.openingStockAmount,
        pctOfSales: netSalesAmount ? round2((openingStockAmount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "purchases",
        name: "Add: Purchases",
        amount: purchaseRow.amount,
        prevAmount: previousMap.purchaseAmount,
        pctOfSales: netSalesAmount ? round2((purchaseRow.amount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "purchase-return",
        name: "Less: Purchase Return",
        amount: -purchaseReturnAmount,
        prevAmount: -previousMap.purchaseReturnAmount,
        pctOfSales: netSalesAmount ? round2((-purchaseReturnAmount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "direct-expenses",
        name: "Add: Direct Expenses",
        amount: directExpenseRow.amount,
        prevAmount: previousMap.directExpenseAmount,
        pctOfSales: netSalesAmount ? round2((directExpenseRow.amount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "closing-stock",
        name: "Less: Closing Stock",
        amount: -closingStockAmount,
        prevAmount: -previousMap.closingStockAmount,
        pctOfSales: netSalesAmount ? round2((-closingStockAmount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
      },
      {
        id: "cogs",
        name: "Cost of Goods Sold",
        amount: cogsAmount,
        prevAmount: previousMap.cogsAmount,
        pctOfSales: netSalesAmount ? round2((cogsAmount / netSalesAmount) * 100) : 0,
        level: 1,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "gross-profit",
        name: "GROSS PROFIT / (LOSS)",
        amount: grossProfitAmount,
        prevAmount: previousMap.grossProfitAmount,
        pctOfSales: netSalesAmount ? round2((grossProfitAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "operating-expenses",
        name: "OPERATING EXPENSES",
        amount: operatingExpensesAmount,
        prevAmount: previousMap.operatingExpensesAmount,
        pctOfSales: netSalesAmount ? round2((operatingExpensesAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: true,
        children: operatingCategoryRows.map((category) => ({
          ...category,
          parentId: "operating-expenses",
          children: category.children?.map((child) => ({
            ...child,
            parentId: category.id,
          })),
        })),
      },
      {
        id: "operating-profit",
        name: "OPERATING PROFIT / (LOSS)",
        amount: operatingProfitAmount,
        prevAmount: previousMap.operatingProfitAmount,
        pctOfSales: netSalesAmount ? round2((operatingProfitAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: false,
        isSummary: true,
      },
      {
        id: "financial-expenses",
        name: "FINANCIAL EXPENSES",
        amount: financialExpensesAmount,
        prevAmount: previousMap.financialExpensesAmount,
        pctOfSales: netSalesAmount ? round2((financialExpensesAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: true,
        children: buildCategoryChildren(financialExpensesChildren, "financial-expenses"),
      },
      {
        id: "other-income",
        name: "OTHER INCOME",
        amount: otherIncomeAmount,
        prevAmount: previousMap.otherIncomeAmount,
        pctOfSales: netSalesAmount ? round2((otherIncomeAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: true,
        children: buildCategoryChildren(otherIncomeChildren, "other-income"),
      },
      {
        id: "depreciation",
        name: "Depreciation",
        amount: depreciationAmount,
        prevAmount: previousMap.depreciationAmount,
        pctOfSales: netSalesAmount ? round2((depreciationAmount / netSalesAmount) * 100) : 0,
        level: 0,
        isGroup: false,
      },
      {
        id: "net-profit",
        name: "NET PROFIT / (NET LOSS)",
        amount:
          operatingProfitAmount + otherIncomeAmount - financialExpensesAmount - depreciationAmount,
        prevAmount: previousMap.netProfitAmount,
        pctOfSales: netSalesAmount
          ? round2(
              ((operatingProfitAmount +
                otherIncomeAmount -
                financialExpensesAmount -
                depreciationAmount) /
                netSalesAmount) *
                100,
            )
          : 0,
        level: 0,
        isGroup: false,
        isSummary: true,
      },
    ];

    const flatten = (rows: PLRow[]): PLRow[] => {
      const result: PLRow[] = [];

      rows.forEach((row) => {
        result.push(row);
        if (row.children && row.children.length > 0 && expandedRowIds.has(row.id)) {
          result.push(...flatten(row.children));
        }
      });

      return result;
    };

    return flatten(baseRows);
  }, [
    profitLoss,
    previousProfitLoss,
    netSalesAmount,
    salesRow.amount,
    salesReturnAmount,
    purchaseRow.amount,
    purchaseReturnAmount,
    directExpenseRow.amount,
    openingStockAmount,
    closingStockAmount,
    cogsAmount,
    grossProfitAmount,
    operatingCategoryRows,
    operatingExpensesAmount,
    operatingProfitAmount,
    financialExpensesAmount,
    otherIncomeAmount,
    depreciationAmount,
    expandedRowIds,
  ]);

  const comparisonLabel = `${previousPeriod.startDate} to ${previousPeriod.endDate}`;

  const handleExportExcel = () => {
    try {
      exportPLStatementToExcel({
        income: [
          { accountCode: "", accountName: salesRow.accountName, amount: salesRow.amount },
          ...(salesRow.children?.map((c: any) => ({
            accountCode: "",
            accountName: c.accountName,
            amount: c.amount,
          })) || []),
          {
            accountCode: "",
            accountName: otherIncomeChildren.length ? "Other Income" : "",
            amount: otherIncomeAmount,
          },
        ],
        expenses: [
          { accountCode: "", accountName: "Cost of Goods Sold", amount: cogsAmount },
          ...operatingCategoryRows.map((r) => ({
            accountCode: "",
            accountName: r.name,
            amount: r.amount,
          })),
          { accountCode: "", accountName: "Financial Expenses", amount: financialExpensesAmount },
          { accountCode: "", accountName: "Depreciation", amount: depreciationAmount },
        ],
        grossProfit: grossProfitAmount,
        netProfit:
          operatingProfitAmount + otherIncomeAmount - financialExpensesAmount - depreciationAmount,
        totalIncome: salesRow.amount + otherIncomeAmount,
        totalExpenses:
          cogsAmount + operatingExpensesAmount + financialExpensesAmount + depreciationAmount,
      });
      toast.success("Profit & Loss exported to Excel.");
    } catch (err: any) {
      toast.error(err?.message || "Unable to export Excel.");
    }
  };

  const handlePrint = () => {
    try {
      const pdfData = {
        income: [
          { accountName: salesRow.accountName, amount: salesRow.amount },
          ...(salesRow.children?.map((c: any) => ({
            accountName: c.accountName,
            amount: c.amount,
          })) || []),
          ...otherIncomeChildren.map((c: any) => ({
            accountName: c.accountName,
            amount: c.amount,
          })),
        ],
        expenses: [
          { accountName: "Cost of Goods Sold", amount: cogsAmount },
          ...buildFlattenChildren(operatingCategoryRows),
          ...financialExpensesChildren.map((c) => ({
            accountName: c.accountName,
            amount: c.amount,
          })),
          { accountName: "Depreciation", amount: depreciationAmount },
        ],
        grossProfit: grossProfitAmount,
        netProfit:
          operatingProfitAmount + otherIncomeAmount - financialExpensesAmount - depreciationAmount,
        totalIncome: salesRow.amount + otherIncomeAmount,
        totalExpenses:
          cogsAmount + operatingExpensesAmount + financialExpensesAmount + depreciationAmount,
      };

      const blob = generatePLPDF(pdfData, companySettings, {
        startDate,
        endDate,
        preset: ReportPeriodPreset.CUSTOM,
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (err: any) {
      toast.error(err?.message || "Unable to generate PDF.");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== "custom") {
      const range = computePresetRange(value, currentFiscalYear);
      if (range) {
        setStartDate(range.startDate);
        setEndDate(range.endDate);
      }
    }
  };

  const columns = [
    {
      key: "name",
      header: "Particulars",
      width: "40%",
      render: (_: any, row: PLRow) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex w-4 justify-center">
            {row.children && row.children.length > 0 ? (
              expandedRowIds.has(row.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : null}
          </span>
          <span
            className={`${row.level === 0 ? "font-bold text-slate-900" : row.level === 1 ? "font-semibold text-slate-800" : "text-slate-600"} ${row.isSummary ? "text-slate-900" : ""}`}
            style={{ paddingLeft: `${row.level * 12}px` }}
          >
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Current Period",
      align: "right",
      render: (val: number) => <span className="font-mono">Rs. {formatNumber(val)}</span>,
    },
    {
      key: "prevAmount",
      header: "Previous Period",
      align: "right",
      render: (val: number) => <span className="font-mono">Rs. {formatNumber(val || 0)}</span>,
    },
    {
      key: "pctOfSales",
      header: "% of Net Sales",
      align: "right",
      render: (val: number) => <span>{val ? `${formatNumber(val)}%` : "-"}</span>,
    },
    {
      key: "changePct",
      header: "Change",
      align: "right",
      render: (_: any, row: PLRow) => {
        if (!showComparison || row.prevAmount === undefined) return "-";
        const change = computeChangePercent(row.prevAmount, row.amount);
        const label = change === null ? "-" : `${change > 0 ? "+" : ""}${formatNumber(change)}%`;
        return (
          <span
            className={change === null ? "" : change >= 0 ? "text-[#059669]" : "text-[#dc2626]"}
          >
            {label}
          </span>
        );
      },
    },
  ];

  const summaryProfit =
    operatingProfitAmount + otherIncomeAmount - financialExpensesAmount - depreciationAmount;

  return (


    <div style={{ background: "#e8e4f0", padding: 12 }}>


      <PillTitle title="Profit & Loss Account" />


      <FormPanel>


        <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Profit & Loss Statement</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Income and expenditure for the selected period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={handleExportExcel}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
          >
            Print PDF
          </Button>
        </div>
      </div>

      {/* Report Header (Similar to TrialBalance) */}
      <div className="bg-white border rounded-lg mb-3 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="text-center py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">{companySettings?.name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{companySettings?.address}</div>
          <div className="text-[14px] font-bold text-[#1557b0] mt-1 uppercase">Profit & Loss Statement</div>
          <div className="text-[11px] text-gray-500">As on {endDate} · FY: {currentFiscalYear?.name}</div>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-4">
          <Select
            label="Preset"
            value={preset}
            onChange={handlePresetChange}
            options={presetOptions}
          />
          <NepaliDatePicker
            label="From Date"
            value={startDate}
            onChange={(value) => {
              setPreset("custom");
              setStartDate(value);
            }}
          />
          <NepaliDatePicker
            label="To Date"
            value={endDate}
            onChange={(value) => {
              setPreset("custom");
              setEndDate(value);
            }}
          />
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(event) => setShowComparison(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Comparison Period
          </label>
        </div>
        {showComparison && (
          <div className="mt-3 text-[11px] text-slate-500">
            Comparing to previous period:{" "}
            <span className="font-semibold text-slate-700">{comparisonLabel}</span>
          </div>
        )}
      </Card>

      <Card border padding="md" className="bg-slate-50">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card border padding="sm" className="bg-white">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Net Sales</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              Rs. {formatNumber(netSalesAmount)}
            </div>
          </Card>
          <Card border padding="sm" className="bg-white">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">COGS</div>
            <div className="mt-2 text-lg font-bold text-amber-700">
              Rs. {formatNumber(cogsAmount)}
            </div>
          </Card>
          <Card border padding="sm" className="bg-white">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Gross Profit
            </div>
            <div className="mt-2 text-lg font-bold text-blue-700">
              Rs. {formatNumber(grossProfitAmount)}
            </div>
          </Card>
          <Card border padding="sm" className="bg-white">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Net Profit / Loss
            </div>
            <div
              className={`mt-2 text-xl font-bold ${summaryProfit >= 0 ? "text-[#059669]" : "text-[#dc2626]"}`}
            >
              Rs. {formatNumber(summaryProfit)}
            </div>
          </Card>
        </div>
      </Card>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="data-table">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Particulars</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Current Period</th>
              {showComparison && <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Previous Period</th>}
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">% of Net Sales</th>
              {showComparison && <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Change</th>}
            </tr>
          </thead>
          <tbody>
            {dataRows.length === 0 ? (
              <tr>
                <td colSpan={showComparison ? 5 : 3} className="text-center py-8 text-gray-500">
                  No Profit & Loss detail available for the selected range.
                </td>
              </tr>
            ) : (
              dataRows.map((row) => {
                if (row.id === "net-profit") {
                  const netProfitVal = row.amount;
                  return (
                    <tr key={row.id} style={{ background: netProfitVal >= 0 ? "#f0fdf4" : "#fef2f2" }}>
                      <td className="px-3 py-3 font-bold text-[13px]" style={{ color: netProfitVal >= 0 ? "#15803d" : "#dc2626" }}>
                        {netProfitVal >= 0 ? "NET PROFIT" : "NET LOSS"}
                      </td>
                      <td className="text-right px-3 font-mono font-bold text-[14px] amt-positive" style={{ color: netProfitVal >= 0 ? "#15803d" : "#dc2626" }}>
                        Rs. {formatNumber(Math.abs(netProfitVal))}
                      </td>
                      {showComparison && (
                        <td className="text-right px-3 font-mono text-[12px] text-gray-500">
                          Rs. {formatNumber(Math.abs(row.prevAmount || 0))}
                        </td>
                      )}
                      <td className="text-right px-3 font-mono text-[12px] text-gray-500">
                        {row.pctOfSales ? `${formatNumber(row.pctOfSales)}%` : "-"}
                      </td>
                      {showComparison && (
                        <td className="text-right px-3 font-mono text-[12px]">
                          {(() => {
                            if (row.prevAmount === undefined) return "-";
                            const change = computeChangePercent(row.prevAmount, row.amount);
                            const label = change === null ? "-" : `${change > 0 ? "+" : ""}${formatNumber(change)}%`;
                            return (
                              <span className={change === null ? "" : change >= 0 ? "text-[#059669]" : "text-[#dc2626]"}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                      )}
                    </tr>
                  );
                }

                const isSectionHeader = ["cogs-header", "gross-profit", "operating-expenses", "financial-expenses", "other-income"].includes(row.id);
                if (isSectionHeader) {
                  return (
                    <tr key={row.id} style={{ background: "#eef1f8" }}>
                      <td colSpan={showComparison ? 5 : 3} className="px-3 py-2 font-bold text-[11px] uppercase tracking-widest text-gray-600 border-b-2" style={{ borderColor: "var(--border-strong)" }}>
                        {row.name}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[#e8eeff] cursor-pointer"
                    onClick={() => row.children && row.children.length > 0 && toggleExpand(row.id)}
                  >
                    <td className="px-3 py-[7px] text-[12px] text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex w-4 justify-center">
                          {row.children && row.children.length > 0 ? (
                            expandedRowIds.has(row.id) ? (
                              <ChevronDown className="h-3 w-3 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-gray-500" />
                            )
                          ) : null}
                        </span>
                        <span
                          className={`${row.level === 0 ? "font-bold text-slate-900" : row.level === 1 ? "font-semibold text-slate-800" : "text-slate-600"} ${row.isSummary ? "text-slate-900 font-bold" : ""}`}
                          style={{ paddingLeft: `${row.level * 12}px` }}
                        >
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                      Rs. {formatNumber(row.amount)}
                    </td>
                    {showComparison && (
                      <td className="px-3 py-[7px] text-[12px] text-right font-mono text-gray-500 amt">
                        Rs. {formatNumber(row.prevAmount || 0)}
                      </td>
                    )}
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono">
                      {row.pctOfSales ? `${formatNumber(row.pctOfSales)}%` : "-"}
                    </td>
                    {showComparison && (
                      <td className="px-3 py-[7px] text-[12px] text-right font-mono">
                        {(() => {
                          if (row.prevAmount === undefined) return "-";
                          const change = computeChangePercent(row.prevAmount, row.amount);
                          const label = change === null ? "-" : `${change > 0 ? "+" : ""}${formatNumber(change)}%`;
                          return (
                            <span className={change === null ? "" : change >= 0 ? "text-[#059669]" : "text-[#dc2626]"}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

      </FormPanel>

    </div>
  );
};

function computePresetRange(preset: string, currentFiscalYear: any) {
  const now = new Date();
  switch (preset) {
    case "current-month":
      return {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "quarter":
      return {
        startDate: format(startOfQuarter(now), "yyyy-MM-dd"),
        endDate: format(endOfQuarter(now), "yyyy-MM-dd"),
      };
    case "fy":
      if (currentFiscalYear?.startDate && currentFiscalYear?.endDate) {
        return {
          startDate: currentFiscalYear.startDate,
          endDate: currentFiscalYear.endDate,
        };
      }
      return {
        startDate: format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"),
        endDate: format(new Date(now.getFullYear(), 11, 31), "yyyy-MM-dd"),
      };
    case "custom":
    default:
      return null;
  }
}

function sumChildrenMatching(children: any[], keywords: string[]) {
  return round2(
    children.reduce((sum, child) => {
      if (matchesAnyKeyword(child.accountName, keywords)) {
        return sum + child.amount;
      }
      return sum;
    }, 0),
  );
}

function matchesAnyKeyword(value: string, keywords: string[]) {
  const lower = (value || "").toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function buildOperatingCategories(rows: any[]): PLRow[] {
  const categories: Record<string, PLRow> = {
    personnel: {
      id: "category-personnel",
      name: expenseCategoryLabels.personnel,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    rentUtilities: {
      id: "category-rentUtilities",
      name: expenseCategoryLabels.rentUtilities,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    communication: {
      id: "category-communication",
      name: expenseCategoryLabels.communication,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    travel: {
      id: "category-travel",
      name: expenseCategoryLabels.travel,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    office: {
      id: "category-office",
      name: expenseCategoryLabels.office,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    marketing: {
      id: "category-marketing",
      name: expenseCategoryLabels.marketing,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
    other: {
      id: "category-other",
      name: expenseCategoryLabels.other,
      amount: 0,
      level: 1,
      isGroup: true,
      children: [],
    },
  };

  rows.forEach((row) => {
    const key = classifyExpenseCategory(row.accountName);
    categories[key].children!.push({
      id: `${categories[key].id}-${row.accountId}`,
      name: row.accountName,
      amount: row.amount,
      level: 2,
      isGroup: false,
    });
    categories[key].amount += row.amount;
  });

  return Object.values(categories).filter(
    (category) => category.amount !== 0 || category.children?.length > 0,
  );
}

function classifyExpenseCategory(name: string) {
  const lower = name.toLowerCase();
  if (
    matchesAnyKeyword(lower, [
      "salary",
      "personnel",
      "wages",
      "staff",
      "payroll",
      "human resource",
      "hr",
    ])
  ) {
    return "personnel";
  }
  if (
    matchesAnyKeyword(lower, [
      "rent",
      "utility",
      "electricity",
      "water",
      "gas",
      "internet",
      "power",
    ])
  ) {
    return "rentUtilities";
  }
  if (
    matchesAnyKeyword(lower, [
      "communication",
      "telephone",
      "telecom",
      "mobile",
      "phone",
      "postage",
    ])
  ) {
    return "communication";
  }
  if (
    matchesAnyKeyword(lower, ["travel", "conveyance", "transport", "vehicle", "lodging", "fare"])
  ) {
    return "travel";
  }
  if (
    matchesAnyKeyword(lower, ["office", "stationery", "supplies", "printing", "postage", "rent"])
  ) {
    return "office";
  }
  if (
    matchesAnyKeyword(lower, [
      "marketing",
      "advertisement",
      "promo",
      "promotion",
      "sales",
      "branding",
    ])
  ) {
    return "marketing";
  }
  return "other";
}

function buildCategoryChildren(rows: any[], parentId: string): PLRow[] {
  return rows.map((row) => ({
    id: `${parentId}-${row.accountId}`,
    name: row.accountName,
    amount: row.amount,
    prevAmount: undefined,
    pctOfSales: undefined,
    changePct: undefined,
    level: 1,
    isGroup: false,
    parentId,
  }));
}

function buildPreviousMap(previousProfitLoss: ReturnType<typeof computeProfitLoss>) {
  const sales = previousProfitLoss.income[0] || { amount: 0, children: [] };
  const purchases = previousProfitLoss.expenses[0] || { amount: 0, children: [] };
  const direct = previousProfitLoss.expenses[1] || { amount: 0 };
  const opening = 0;
  const closing = 0;
  const salesReturn = sumChildrenMatching(sales.children || [], ["return"]);
  const otherIncome = previousProfitLoss.income[1]?.amount || 0;
  const operatingChildren = previousProfitLoss.expenses[2]?.children || [];
  const financial = operatingChildren.filter((row) =>
    matchesAnyKeyword(row.accountName, ["bank", "interest", "finance"]),
  );
  const depreciation = operatingChildren.filter((row) =>
    matchesAnyKeyword(row.accountName, ["depreciation", "depreciate"]),
  );
  const operatingCategories = buildOperatingCategories(operatingChildren);
  const operatingTotal = operatingCategories.reduce((sum, row) => sum + row.amount, 0);
  const cogs = round2(purchases.amount + direct.amount - salesReturn - closing);
  const grossProfit = round2(sales.amount - salesReturn - cogs);
  const operatingProfit = round2(
    grossProfit +
      otherIncome -
      operatingTotal -
      round2(financial.reduce((sum, row) => sum + row.amount, 0)) -
      round2(depreciation.reduce((sum, row) => sum + row.amount, 0)),
  );
  const netProfit = round2(
    operatingProfit +
      otherIncome -
      round2(financial.reduce((sum, row) => sum + row.amount, 0)) -
      round2(depreciation.reduce((sum, row) => sum + row.amount, 0)),
  );

  return {
    salesAmount: sales.amount,
    salesReturnAmount: salesReturn,
    netSalesAmount: round2(sales.amount - salesReturn),
    openingStockAmount: opening,
    purchaseAmount: purchases.amount,
    purchaseReturnAmount: sumChildrenMatching(purchases.children || [], ["return"]),
    directExpenseAmount: direct.amount,
    closingStockAmount: closing,
    cogsAmount: cogs,
    grossProfitAmount: grossProfit,
    operatingExpensesAmount: operatingTotal,
    operatingProfitAmount: operatingProfit,
    financialExpensesAmount: round2(financial.reduce((sum, row) => sum + row.amount, 0)),
    otherIncomeAmount: otherIncome,
    depreciationAmount: round2(depreciation.reduce((sum, row) => sum + row.amount, 0)),
    netProfitAmount: netProfit,
  };
}

function buildFlattenChildren(rows: PLRow[]) {
  return rows.flatMap((row) => [
    { accountName: row.name, amount: row.amount },
    ...(row.children?.map((child) => ({ accountName: child.name, amount: child.amount })) || []),
  ]);
}

function computeChangePercent(previous: number, current: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default ProfitLoss;
