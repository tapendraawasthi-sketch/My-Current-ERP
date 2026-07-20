// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import * as XLSX from "xlsx";
import { formatCurrency } from "../lib/utils";
import { useBranchFilter } from "../hooks/useBranchFilter";
import {
  ReportWorkspace,
  useReportQueryParams,
  applyBranchQueryParam,
} from "@/features/reports";

type ViewMode = "summary" | "ledger" | "monthly";
type BudgetType = "all" | "income" | "expense";

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
    initLifecycle,
  } = useStore();
  const storeLoading = initLifecycle === "loading" || initLifecycle === "initializing";
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const defaultFrom = currentFiscalYear?.startDate || new Date().getFullYear() + "-01-01";
  const defaultTo = currentFiscalYear?.endDate || new Date().getFullYear() + "-12-31";
  const { params, writeParams } = useReportQueryParams({ from: defaultFrom, to: defaultTo });

  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [budgetType, setBudgetType] = useState<BudgetType>("all");
  const [fromDate, setFromDate] = useState(() => params.from || defaultFrom);
  const [toDate, setToDate] = useState(() => params.to || defaultTo);
  const [threshold, setThreshold] = useState(90); // alert at 90% consumed
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (params.from) setFromDate(params.from);
    if (params.to) setToDate(params.to);
    if (params.branch) applyBranchQueryParam(params.branch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncQuery = () => {
    writeParams({
      fy: currentFiscalYear?.id || currentFiscalYear?.name,
      from: fromDate,
      to: toDate,
      branch: branchFilter,
    });
  };

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
    () =>
      vouchers.filter(
        (v: any) =>
          matchBranch(v.branchId) && v.date >= fromDate && v.date <= toDate,
      ),
    [vouchers, fromDate, toDate, matchBranch, branchFilter],
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
    rangeVouchers.forEach((v: any) => {
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
  }, [rangeVouchers]);

  // ── Build budget map ──────────────────────────────────────────────────────
  const budgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    budgets
      .filter((b: any) => matchBranch(b.branchId))
      .forEach((b: any) => {
        const accId = b.accountId || b.ledgerId;
        if (!accId) return;
        const amt = b.amount || b.budgetAmount || 0;
        map[accId] = (map[accId] || 0) + amt;
      });
    return map;
  }, [budgets, matchBranch, branchFilter]);

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
    <ReportWorkspace
      title="Budget vs actual"
      description="Plan vs real figures."
      periodLabel={`${fromDate} to ${toDate}`}
      loading={storeLoading}
      onPrint={() => window.print()}
      onExportExcel={exportExcel}
      onShowReport={syncQuery}
      showReportLabel="Apply filters"
      kpiSlot={
        <>
          {[
            {
              label: "Budget Income",
              value: formatCurrency(totals.totalBudgetIncome),
              color: "text-[var(--ds-action-primary)]",
            },
            {
              label: "Actual Income",
              value: formatCurrency(totals.totalActualIncome),
              color: "text-green-700",
            },
            {
              label: "Budget Expense",
              value: formatCurrency(totals.totalBudgetExpense),
              color: "text-amber-700",
            },
            {
              label: "Actual Expense",
              value: formatCurrency(totals.totalActualExpense),
              color: "text-red-700",
            },
            {
              label: "Net Budget Surplus",
              value: formatCurrency(totals.totalBudgetIncome - totals.totalBudgetExpense),
              color: "text-gray-700",
            },
            {
              label: "Net Actual Surplus",
              value: formatCurrency(totals.totalActualIncome - totals.totalActualExpense),
              color: "text-green-700",
            },
            {
              label: "Alert Items",
              value: String(totals.alertCount),
              color: "text-red-600",
            },
            {
              label: "On Track Items",
              value: String(totals.onTrackCount),
              color: "text-green-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3"
            >
              <div className="text-[11px] text-[var(--ds-text-muted)] font-medium">
                {card.label}
              </div>
              <div className={`text-[16px] font-bold mt-1 font-mono ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </>
      }
      filterSlot={
        <div className="flex flex-wrap items-end gap-3">
          {branchOptions.length > 0 && (
            <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
              Branch
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            To date
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            Type
            <select
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as BudgetType)}
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            Alert threshold %
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(+e.target.value)}
              min={50}
              max={100}
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-24 text-right"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1 min-w-48">
            Search account
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search…"
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["summary", "ledger", "monthly"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium capitalize ${
                  viewMode === m
                    ? "bg-white text-[var(--ds-action-primary)] shadow-sm"
                    : "text-gray-600 hover:text-gray-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
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
                    Budget: {formatCurrency(totalBudget)} | Actual: {formatCurrency(totalActual)}
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
                        <span>Budget: {formatCurrency(r.budget)}</span>
                        <span>Actual: {formatCurrency(r.actual)}</span>
                        <span className={r.isFavourable ? "text-green-600" : "text-red-600"}>
                          Var: {r.variance > 0 ? "+" : ""}
                          {formatCurrency(r.variance)}
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
                  <td className="px-4 py-3 font-medium text-gray-700">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.group}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${r.type === "income" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium font-mono">{formatCurrency(r.budget)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.actual)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium font-mono ${r.isFavourable ? "text-green-600" : "text-red-600"}`}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {formatCurrency(r.variance)}
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
                <th className="px-4 py-3 text-left font-semibold text-gray-400 sticky left-0 bg-gray-50">
                  Account
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Budget (Annual)</th>
                {months.map((m) => (
                  <th key={m} className="px-3 py-3 text-center font-semibold text-gray-400">
                    {new Date(m + "-01").toLocaleDateString("en-IN", {
                      month: "short",
                      year: "2-digit",
                    })}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-400">YTD Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white">
                    {r.name}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--ds-action-primary)] font-medium font-mono">
                    {formatCurrency(r.budget)}
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
                          formatCurrency(monthlyAct)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`px-4 py-2 text-right font-semibold ${r.isFavourable ? "text-green-700" : "text-red-700"}`}
                  >
                    {formatCurrency(r.actual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </ReportWorkspace>
  );
}
