// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import { Download, Filter, Target } from "lucide-react";
import * as xlsx from "xlsx";
import { AccountGroup } from "../lib/types";

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

export default function BudgetVsActual() {
  const { budgets, vouchers, accounts, costCenters, currentFiscalYear } = useStore();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const reportData = useMemo(() => {
    if (!currentFiscalYear) return [];

    // Filter budgets
    let relevantBudgets = budgets.filter(b => b.fiscalYearBS === currentFiscalYear.name);
    if (selectedCostCenterId) {
      relevantBudgets = relevantBudgets.filter(b => !b.costCenterId || b.costCenterId === selectedCostCenterId);
    }
    if (selectedMonth) {
      relevantBudgets = relevantBudgets.filter(b => b.month === selectedMonth);
    }

    // Filter vouchers
    let relevantVouchers = vouchers.filter(v => v.status === "POSTED" && v.dateNepali?.startsWith(currentFiscalYear.name));
    if (selectedMonth) {
      relevantVouchers = relevantVouchers.filter(v => v.dateNepali?.substring(5, 7) === selectedMonth);
    }

    // Map account -> { budget, actual, costCenterId }
    const accountTotals: Record<string, { accountId: string, accountName: string, budgeted: number, actual: number }> = {};

    relevantBudgets.forEach(b => {
      if (!accountTotals[b.accountId]) {
        accountTotals[b.accountId] = {
          accountId: b.accountId,
          accountName: accounts.find(a => a.id === b.accountId)?.name || "Unknown",
          budgeted: 0,
          actual: 0
        };
      }
      accountTotals[b.accountId].budgeted += b.budgetedAmount;
    });

    relevantVouchers.forEach(v => {
      v.lines.forEach(l => {
        if (!selectedCostCenterId || l.costCenterId === selectedCostCenterId) {
          const acc = accounts.find(a => a.id === l.accountId);
          if (!acc) return;
          // Determine nature
          const isIncome = ["Direct Incomes", "Indirect Incomes", "Sales Accounts"].includes(acc.group || "");
          const isExpense = ["Direct Expenses", "Indirect Expenses", "Purchase Accounts"].includes(acc.group || "");
          
          let amount = 0;
          if (isIncome) amount = l.credit - l.debit;
          else if (isExpense) amount = l.debit - l.credit;
          else amount = l.debit - l.credit; // Default for others (assets/liabs etc)

          // If an account wasn't budgeted, we still show its actuals if there's an amount
          if (amount !== 0) {
            if (!accountTotals[l.accountId]) {
              accountTotals[l.accountId] = {
                accountId: l.accountId,
                accountName: acc.name,
                budgeted: 0,
                actual: 0
              };
            }
            accountTotals[l.accountId].actual += amount;
          }
        }
      });
    });

    return Object.values(accountTotals).map(row => {
      const varianceRs = row.budgeted - row.actual;
      const variancePct = row.budgeted > 0 ? (varianceRs / row.budgeted) * 100 : (row.actual > 0 ? -100 : 0);
      return { ...row, varianceRs, variancePct };
    }).sort((a, b) => a.accountName.localeCompare(b.accountName));

  }, [budgets, vouchers, accounts, currentFiscalYear, selectedCostCenterId, selectedMonth]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, row) => ({
      budgeted: acc.budgeted + row.budgeted,
      actual: acc.actual + row.actual,
      varianceRs: acc.varianceRs + row.varianceRs
    }), { budgeted: 0, actual: 0, varianceRs: 0 });
  }, [reportData]);

  const exportExcel = () => {
    const data = reportData.map(r => ({
      "Account": r.accountName,
      "Budget (Rs.)": r.budgeted,
      "Actual (Rs.)": r.actual,
      "Variance (Rs.)": r.varianceRs,
      "Variance %": r.variancePct.toFixed(2) + "%"
    }));
    
    data.push({
      "Account": "TOTAL",
      "Budget (Rs.)": totals.budgeted,
      "Actual (Rs.)": totals.actual,
      "Variance (Rs.)": totals.varianceRs,
      "Variance %": totals.budgeted > 0 ? ((totals.varianceRs / totals.budgeted) * 100).toFixed(2) + "%" : "0.00%"
    });

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "BudgetVsActual");
    xlsx.writeFile(wb, `BudgetVsActual_${currentFiscalYear?.name}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Budget vs Actual</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Compare allocated budgets against real-time ledger expenses</p>
        </div>
        <button onClick={exportExcel} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Cost Center Filter</label>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <select value={selectedCostCenterId} onChange={e => setSelectedCostCenterId(e.target.value)} className="w-full h-8 pl-8 pr-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0]">
                <option value="">-- All Cost Centers --</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Month Filter</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0]">
              <option value="">-- All Months (Annual) --</option>
              {BS_MONTHS.map((m, idx) => {
                const mm = String(idx + 1).padStart(2, "0");
                return <option key={mm} value={mm}>{m}</option>;
              })}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Budget (Rs.)</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Actual (Rs.)</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Variance (Rs.)</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[13px] font-medium text-gray-600">No Data Available</p>
                    <p className="text-[11px] text-gray-400 mt-1">Adjust filters or configure budgets to see comparison.</p>
                  </td>
                </tr>
              ) : (
                reportData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-gray-800">{row.accountName}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-right text-gray-600">{row.budgeted.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-right font-medium text-gray-900">{row.actual.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-[12px] font-mono text-right font-bold ${row.varianceRs < 0 ? "text-red-600" : "text-green-600"}`}>
                      {row.varianceRs > 0 ? "+" : ""}{row.varianceRs.toLocaleString()}
                    </td>
                    <td className={`px-4 py-2.5 text-[12px] font-mono text-right font-bold ${row.variancePct < 0 ? "text-red-600" : "text-green-600"}`}>
                      {row.variancePct > 0 ? "+" : ""}{row.variancePct.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {reportData.length > 0 && (
              <tfoot className="sticky bottom-0 bg-blue-50 border-t-2 border-blue-200">
                <tr>
                  <td className="px-4 py-3 text-[12px] font-bold text-gray-800 uppercase tracking-wide">Grand Total</td>
                  <td className="px-4 py-3 text-[13px] font-mono font-bold text-gray-900 text-right">{totals.budgeted.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[13px] font-mono font-bold text-gray-900 text-right">{totals.actual.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-[13px] font-mono font-bold text-right ${totals.varianceRs < 0 ? "text-red-600" : "text-green-600"}`}>
                    {totals.varianceRs > 0 ? "+" : ""}{totals.varianceRs.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-[13px] font-mono font-bold text-right ${totals.varianceRs < 0 ? "text-red-600" : "text-green-600"}`}>
                    {totals.budgeted > 0 ? ((totals.varianceRs / totals.budgeted) * 100).toFixed(1) + "%" : "0.0%"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

