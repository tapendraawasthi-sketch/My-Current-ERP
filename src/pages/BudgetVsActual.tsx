// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

type ViewMode = "summary" | "ledger" | "monthly";
type BudgetType = "all" | "income" | "expense";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(actual: number, budget: number) {
  if (!budget) return 0;
  return Math.round((actual / budget) * 100);
}

export default function BudgetVsActual() {
  const {
    accounts = [],
    vouchers = [],
    budgets = [],
    currentFiscalYear,
    companySettings,
  } = useStore();

  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [budgetType, setBudgetType] = useState<BudgetType>("all");
  const [fromDate, setFromDate] = useState(
    currentFiscalYear?.startDate || new Date().getFullYear() + "-01-01",
  );
  const [toDate, setToDate] = useState(
    currentFiscalYear?.endDate || new Date().getFullYear() + "-12-31",
  );
  const [threshold, setThreshold] = useState(90); // alert at 90% consumed
  const [searchTerm, setSearchTerm] = useState("");

  // ── Classify accounts ─────────────────────────────────────────────────────
  const incomeKeywords = [
    "sales",
    "revenue",
    "income",
    "interest received",
    "discount received",
    "other income",
  ];
  const expenseKeywords = [
    "purchase",
    "expense",
    "cost",
    "salary",
    "rent",
    "utilities",
    "depreciation",
    "interest paid",
    "advertising",
    "transport",
    "insurance",
    "maintenance",
    "wages",
    "commission",
    "tax",
    "duty",
    "freight",
  ];

  function classifyAccount(acc: any): "income" | "expense" | "other" {
    const name = (acc.name || "").toLowerCase();
    const grp = (acc.group || acc.accountGroup || "").toLowerCase();
    if (incomeKeywords.some((k) => name.includes(k) || grp.includes(k))) return "income";
    if (expenseKeywords.some((k) => name.includes(k) || grp.includes(k))) return "expense";
    return "other";
  }

  // ── Filter vouchers in range ──────────────────────────────────────────────
  const rangeVouchers = useMemo(
    () => vouchers.filter((v: any) => v.date >= fromDate && v.date <= toDate),
    [vouchers, fromDate, toDate],
  );

  // ── Compute actual amounts per account ────────────────────────────────────
  const actualMap = useMemo(() => {
    const map: Record<string, number> = {};
    rangeVouchers.forEach((v: any) => {
      (v.entries || v.lineItems || []).forEach((entry: any) => {
        const accId = entry.accountId || entry.ledgerId;
        if (!accId) return;
        const amt = Math.abs(entry.amount || entry.debit || entry.credit || 0);
        map[accId] = (map[accId] || 0) + amt;
      });
    });
    return map;
  }, [rangeVouchers]);

  // ── Compute actual amounts per account per month ──────────────────────────
  const monthlyActualMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    vouchers
      .filter((v: any) => v.date >= fromDate && v.date <= toDate)
      .forEach((v: any) => {
        const month = v.date?.slice(0, 7); // "YYYY-MM"
        (v.entries || v.lineItems || []).forEach((entry: any) => {
          const accId = entry.accountId || entry.ledgerId;
          if (!accId || !month) return;
          if (!map[accId]) map[accId] = {};
          const amt = Math.abs(entry.amount || entry.debit || entry.credit || 0);
          map[accId][month] = (map[accId][month] || 0) + amt;
        });
      });
    return map;
  }, [vouchers, fromDate, toDate]);

  // ── Build budget map ──────────────────────────────────────────────────────
  const budgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.forEach((b: any) => {
      const accId = b.accountId || b.ledgerId;
      if (!accId) return;
      const amt = b.amount || b.budgetAmount || 0;
      map[accId] = (map[accId] || 0) + amt;
    });
    return map;
  }, [budgets]);

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    // Merge accounts that have either a budget or actual
    const relevantIds = new Set([...Object.keys(actualMap), ...Object.keys(budgetMap)]);

    return Array.from(relevantIds)
      .map((id) => {
        const acc = accounts.find((a: any) => String(a.id) === id || a.id === id);
        if (!acc) return null;
        const type = classifyAccount(acc);
        const actual = actualMap[id] || 0;
        const budget = budgetMap[id] || 0;
        const variance = actual - budget;
        const utilization = pct(actual, budget);
        const isFavourable = type === "income" ? actual >= budget : actual <= budget;
        return {
          id,
          name: acc.name,
          group: acc.group || acc.accountGroup || "",
          type,
          actual,
          budget,
          variance,
          utilization,
          isFavourable,
        };
      })
      .filter(Boolean)
      .filter((r: any) => budgetType === "all" || r.type === budgetType)
      .filter((r: any) => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => b.budget - a.budget);
  }, [actualMap, budgetMap, accounts, budgetType, searchTerm]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const income = rows.filter((r: any) => r.type === "income");
    const expense = rows.filter((r: any) => r.type === "expense");
    return {
      totalBudgetIncome: income.reduce((s: number, r: any) => s + r.budget, 0),
      totalActualIncome: income.reduce((s: number, r: any) => s + r.actual, 0),
      totalBudgetExpense: expense.reduce((s: number, r: any) => s + r.budget, 0),
      totalActualExpense: expense.reduce((s: number, r: any) => s + r.actual, 0),
      alertCount: rows.filter((r: any) => r.utilization >= threshold && !r.isFavourable).length,
      onTrackCount: rows.filter((r: any) => r.isFavourable).length,
    };
  }, [rows, threshold]);

  // ── Monthly columns ───────────────────────────────────────────────────────
  const months = useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const result: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      result.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [fromDate, toDate]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const data = rows.map((r: any) => ({
      Account: r.name,
      Group: r.group,
      Type: r.type,
      Budget: r.budget,
      Actual: r.actual,
      Variance: r.variance,
      "Utilization %": r.utilization,
      Status: r.isFavourable ? "Favourable" : "Unfavourable",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget vs actual");
    XLSX.writeFile(wb, `BudgetVsActual_${fromDate}_to_${toDate}.xlsx`);
  };

  // ── Status badge ─────────────────────────────────────────────────────────
  function StatusBadge({ row }: { row: any }) {
    if (row.budget === 0) return <span className="text-xs text-gray-400">No Budget</span>;
    const color = row.isFavourable
      ? "bg-green-100 text-green-700"
      : row.utilization >= 100
        ? "bg-red-100 text-red-700"
        : row.utilization >= threshold
          ? "bg-yellow-100 text-yellow-700"
          : "bg-green-100 text-green-700";
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {row.isFavourable
          ? "On Track"
          : row.utilization >= 100
            ? "Exceeded"
            : `${row.utilization}%`}
      </span>
    );
  }

  // ── Progress bar ─────────────────────────────────────────────────────────
  function ProgressBar({ pct, favourable }: { pct: number; favourable: boolean }) {
    const capped = Math.min(pct, 100);
    const color = favourable
      ? "bg-green-500"
      : pct >= 100
        ? "bg-red-500"
        : pct >= 80
          ? "bg-yellow-500"
          : "bg-green-500";
    return (
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${capped}%` }}
        />
      </div>
    );
  }

  return (
    <div className="erp-report p-4 md:p-6 bg-[var(--ds-canvas)] min-h-screen space-y-4">
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Budget vs actual</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Plan vs real figures.
          </p>
        </div>
        <button
          onClick={exportExcel}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as BudgetType)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Alert Threshold %
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(+e.target.value)}
              min={50}
              max={100}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Account</label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {/* View mode */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["summary", "ledger", "monthly"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                  viewMode === m
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Budget Income",
            value: fmt(totals.totalBudgetIncome),
            color: "blue",
            icon: Target,
          },
          {
            label: "Actual Income",
            value: fmt(totals.totalActualIncome),
            color: "green",
            icon: TrendingUp,
          },
          {
            label: "Budget Expense",
            value: fmt(totals.totalBudgetExpense),
            color: "orange",
            icon: Target,
          },
          {
            label: "Actual Expense",
            value: fmt(totals.totalActualExpense),
            color: "red",
            icon: TrendingDown,
          },
          {
            label: "Net Budget Surplus",
            value: fmt(totals.totalBudgetIncome - totals.totalBudgetExpense),
            color: "indigo",
            icon: Target,
          },
          {
            label: "Net Actual Surplus",
            value: fmt(totals.totalActualIncome - totals.totalActualExpense),
            color: "teal",
            icon: TrendingUp,
          },
          { label: "Alert Items", value: totals.alertCount, color: "red", icon: AlertTriangle },
          {
            label: "On Track Items",
            value: totals.onTrackCount,
            color: "green",
            icon: CheckCircle,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{card.label}</span>
              <card.icon className={`w-4 h-4 text-${card.color}-500`} />
            </div>
            <div className={`text-lg font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── SUMMARY VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(["income", "expense"] as const).map((type) => {
            const typeRows = rows.filter((r: any) => r.type === type);
            const totalBudget = typeRows.reduce((s: number, r: any) => s + r.budget, 0);
            const totalActual = typeRows.reduce((s: number, r: any) => s + r.actual, 0);
            return (
              <div
                key={type}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div
                  className={`px-5 py-3 border-b flex items-center justify-between ${type === "income" ? "bg-green-50" : "bg-red-50"}`}
                >
                  <h3
                    className={`font-semibold ${type === "income" ? "text-green-800" : "text-red-800"} capitalize`}
                  >
                    {type}
                  </h3>
                  <div className="text-xs text-gray-600">
                    Budget: {fmt(totalBudget)} | Actual: {fmt(totalActual)}
                  </div>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {typeRows.map((r: any) => (
                    <div key={r.id} className="px-5 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{r.name}</span>
                        <StatusBadge row={r} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Budget: {fmt(r.budget)}</span>
                        <span>Actual: {fmt(r.actual)}</span>
                        <span className={r.isFavourable ? "text-green-600" : "text-red-600"}>
                          Var: {r.variance > 0 ? "+" : ""}
                          {fmt(r.variance)}
                        </span>
                      </div>
                      <ProgressBar pct={r.utilization} favourable={r.isFavourable} />
                    </div>
                  ))}
                  {typeRows.length === 0 && (
                    <div className="px-5 py-8 text-center text-gray-400 text-sm">
                      No {type} budgets set. Configure budgets in the Budget master.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LEDGER VIEW ───────────────────────────────────────────────────── */}
      {viewMode === "ledger" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  "Account",
                  "Group",
                  "Type",
                  "Budget",
                  "Actual",
                  "Variance",
                  "Utilization",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 ${r.utilization >= 100 && !r.isFavourable ? "bg-red-50" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.group}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${r.type === "income" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.budget)}</td>
                  <td className="px-4 py-3 text-right">{fmt(r.actual)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${r.isFavourable ? "text-green-600" : "text-red-600"}`}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {fmt(r.variance)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-16">
                        <div
                          className={`h-2 rounded-full ${r.isFavourable ? "bg-green-500" : r.utilization >= 100 ? "bg-red-500" : "bg-yellow-400"}`}
                          style={{ width: `${Math.min(r.utilization, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-600 w-10 text-right">
                        {r.utilization}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge row={r} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No budget data found. Add budgets via the Budget master or set date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MONTHLY VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "monthly" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50">
                  Account
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Budget (Annual)</th>
                {months.map((m) => (
                  <th key={m} className="px-3 py-3 text-center font-semibold text-gray-500">
                    {new Date(m + "-01").toLocaleDateString("en-IN", {
                      month: "short",
                      year: "2-digit",
                    })}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-500">YTD Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white">
                    {r.name}
                  </td>
                  <td className="px-4 py-2 text-right text-blue-700 font-medium">
                    {fmt(r.budget)}
                  </td>
                  {months.map((m) => {
                    const monthlyAct = (monthlyActualMap[r.id] || {})[m] || 0;
                    const monthlyBudget = r.budget / (months.length || 1);
                    const over = monthlyAct > monthlyBudget && r.type === "expense";
                    return (
                      <td
                        key={m}
                        className={`px-3 py-2 text-right ${over ? "text-red-600 font-medium" : "text-gray-700"}`}
                      >
                        {monthlyAct > 0 ? (
                          fmt(monthlyAct)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`px-4 py-2 text-right font-semibold ${r.isFavourable ? "text-green-700" : "text-red-700"}`}
                  >
                    {fmt(r.actual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
