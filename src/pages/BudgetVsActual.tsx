import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { BudgetPeriod, AccountType, VoucherStatus } from "../lib/types";
import { TrendingUp, AlertCircle, CheckCircle, Download, FileText } from "lucide-react";
import { Card, Button, Select, ActionToolbar } from "../components/ui";
import { formatNumber } from "../lib/utils";
import { ReportToolbar } from "../components/reports/ReportToolbar";
import { ReportFooter } from "../components/reports/ReportFooter";
import { ReportEmptyState } from "../components/ReportEmptyState";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

interface BudgetLine {
  accountId: string;
  accountName: string;
  annualAmount: number;
  monthlyBreakdown: Record<string, number>;
}

interface Budget {
  id: string;
  name: string;
  fiscalYearId: string;
  period: BudgetPeriod;
  lines: BudgetLine[];
  createdBy?: string;
  createdAt?: string;
}

const BudgetVsActual: React.FC = () => {
  const { accounts, vouchers, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  // Mock budgets - in real app this would come from store
  const [budgets] = useState<Budget[]>([
    {
      id: "bdg-1",
      name: "FY 2083-84 Operating Budget",
      fiscalYearId: "fy-2083-84",
      period: "monthly" as BudgetPeriod,
      lines: [],
      createdBy: "usr-admin",
      createdAt: new Date().toISOString(),
    },
  ]);

  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [viewMode, setViewMode] = useState<"monthly" | "cumulative">("cumulative");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const budgetOptions = budgets.map((b) => ({ value: b.id, label: b.name }));

  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  // Calculate actuals from vouchers
  const calculateActuals = useMemo(() => {
    const actuals: Record<string, number> = {};

    const postedVouchers = vouchers.filter((v) => v.status === VoucherStatus.POSTED);

    for (const v of postedVouchers) {
      for (const line of v.lines) {
        const account = accounts.find((a) => a.id === line.accountId);
        if (!account || account.isGroup) continue;

        if (account.type === AccountType.INCOME) {
          actuals[line.accountId] = (actuals[line.accountId] || 0) + line.credit - line.debit;
        } else if (account.type === AccountType.EXPENSE) {
          actuals[line.accountId] = (actuals[line.accountId] || 0) + line.debit - line.credit;
        }
      }
    }

    return actuals;
  }, [vouchers, accounts]);

  // Build comparison data
  const comparisonData = useMemo(() => {
    if (!selectedBudget) return [];

    const data: any[] = [];

    for (const line of selectedBudget.lines) {
      const account = accounts.find((a) => a.id === line.accountId);
      if (!account) continue;

      const budgetAmount = line.annualAmount;
      const actualAmount = calculateActuals[line.accountId] || 0;
      const variance = actualAmount - budgetAmount;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      let status: "good" | "warning" | "critical" = "good";
      if (account.type === AccountType.EXPENSE) {
        if (Math.abs(variancePercent) > 20) status = "critical";
        else if (Math.abs(variancePercent) > 10) status = "warning";
      } else {
        // For income, under-performance is bad
        if (variancePercent < -20) status = "critical";
        else if (variancePercent < -10) status = "warning";
      }

      data.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        budgetAmount,
        actualAmount,
        variance,
        variancePercent,
        status,
      });
    }

    return data.sort((a, b) => {
      if (a.accountType !== b.accountType) {
        return a.accountType === AccountType.INCOME ? -1 : 1;
      }
      return a.accountCode.localeCompare(b.accountCode);
    });
  }, [selectedBudget, accounts, calculateActuals]);

  // Group by type
  const incomeData = comparisonData.filter((d) => d.accountType === AccountType.INCOME);
  const expenseData = comparisonData.filter((d) => d.accountType === AccountType.EXPENSE);

  const incomeSummary = {
    budget: incomeData.reduce((sum, d) => sum + d.budgetAmount, 0),
    actual: incomeData.reduce((sum, d) => sum + d.actualAmount, 0),
  };

  const expenseSummary = {
    budget: expenseData.reduce((sum, d) => sum + d.budgetAmount, 0),
    actual: expenseData.reduce((sum, d) => sum + d.actualAmount, 0),
  };

  // Chart data
  const chartData = [
    {
      category: "Income",
      Budget: incomeSummary.budget,
      Actual: incomeSummary.actual,
    },
    {
      category: "Expenses",
      Budget: expenseSummary.budget,
      Actual: expenseSummary.actual,
    },
  ];

  const getStatusIcon = (status: "good" | "warning" | "critical") => {
    switch (status) {
      case "good":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const handleExportExcel = () => {
    const data = comparisonData.map((d) => ({
      "Account Code": d.accountCode,
      "Account Name": d.accountName,
      Type: d.accountType,
      "Budget Amount": d.budgetAmount,
      "Actual Amount": d.actualAmount,
      Variance: d.variance,
      "Variance %": d.variancePercent.toFixed(2) + "%",
      Status: d.status.toUpperCase(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget vs Actual");
    XLSX.writeFile(wb, `Budget_vs_Actual_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <ActionToolbar
        title="Budget vs Actual"
        subtitle="Compare budgeted amounts with actual spending"
      />

      {/* Filters */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Budget"
            options={[{ value: "", label: "Select a budget" }, ...budgetOptions]}
            value={selectedBudgetId}
            onChange={setSelectedBudgetId}
            required
          />

          <Select
            label="View Mode"
            options={[
              { value: "monthly", label: "Monthly View" },
              { value: "cumulative", label: "Cumulative YTD" },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as any)}
          />

          {viewMode === "monthly" && (
            <Select
              label="Month"
              options={[
                { value: "all", label: "All Months" },
                { value: "04", label: "Baisakh" },
                { value: "05", label: "Jestha" },
                { value: "06", label: "Ashadh" },
                { value: "07", label: "Shrawan" },
                { value: "08", label: "Bhadra" },
                { value: "09", label: "Ashwin" },
                { value: "10", label: "Kartik" },
                { value: "11", label: "Mangsir" },
                { value: "12", label: "Poush" },
                { value: "01", label: "Magh" },
                { value: "02", label: "Falgun" },
                { value: "03", label: "Chaitra" },
              ]}
              value={selectedMonth}
              onChange={setSelectedMonth}
            />
          )}
        </div>
      </Card>

      {!selectedBudgetId ? (
        <ReportEmptyState
          message="Select a budget to view comparison"
          icon={<TrendingUp className="w-16 h-16" />}
        />
      ) : (
        <>
          {/* Summary Chart */}
          <Card border padding="md">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
              Budget vs Actual Overview
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${symbol} ${formatNumber(value)}`} />
                <Legend />
                <Bar dataKey="Budget" fill="#3b82f6" />
                <Bar dataKey="Actual" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Toolbar */}
          <ReportToolbar onExportExcel={handleExportExcel} />

          {/* Income Section */}
          {incomeData.length > 0 && (
            <Card border padding="none">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  INCOME ACCOUNTS
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                        Account
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Budget
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Actual
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Variance
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Variance %
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                    {incomeData.map((row) => (
                      <tr key={row.accountId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {row.accountName}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">{row.accountCode}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {symbol} {formatNumber(row.budgetAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {symbol} {formatNumber(row.actualAmount)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            row.variance >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {row.variance >= 0 ? "+" : ""}
                          {symbol} {formatNumber(row.variance)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            row.variance >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {row.variance >= 0 ? "+" : ""}
                          {row.variancePercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusIcon(row.status)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                      <td className="px-4 py-3">TOTAL INCOME</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(incomeSummary.budget)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(incomeSummary.actual)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(incomeSummary.actual - incomeSummary.budget)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {incomeSummary.budget > 0
                          ? (
                              ((incomeSummary.actual - incomeSummary.budget) /
                                incomeSummary.budget) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Expense Section */}
          {expenseData.length > 0 && (
            <Card border padding="none">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-red-900 dark:text-red-100 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  EXPENSE ACCOUNTS
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                        Account
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Budget
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Actual
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Variance
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        Variance %
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                    {expenseData.map((row) => (
                      <tr key={row.accountId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {row.accountName}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">{row.accountCode}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {symbol} {formatNumber(row.budgetAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                          {symbol} {formatNumber(row.actualAmount)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            row.variance <= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {row.variance >= 0 ? "+" : ""}
                          {symbol} {formatNumber(row.variance)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            row.variance <= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {row.variance >= 0 ? "+" : ""}
                          {row.variancePercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusIcon(row.status)}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50 dark:bg-red-900/20 font-bold">
                      <td className="px-4 py-3">TOTAL EXPENSES</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(expenseSummary.budget)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(expenseSummary.actual)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {symbol} {formatNumber(expenseSummary.actual - expenseSummary.budget)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {expenseSummary.budget > 0
                          ? (
                              ((expenseSummary.actual - expenseSummary.budget) /
                                expenseSummary.budget) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <ReportFooter
            generatedAt={new Date().toLocaleString()}
            note="Status: Green = within 10% of budget | Yellow = 10-20% variance | Red = 20%+ variance"
          />
        </>
      )}
    </div>
  );
};

export default BudgetVsActual;
