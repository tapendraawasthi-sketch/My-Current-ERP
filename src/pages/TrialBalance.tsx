// src/pages/TrialBalance.tsx
// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type DisplayMode = "simple" | "columnar" | "comparative";

interface TrialRow {
  id: string;
  code: string;
  name: string;
  type: string;
  level: string;
  isGroup: boolean;
  depth: number;
  parentId?: string;
  openingDr: number;
  openingCr: number;
  movDr: number;
  movCr: number;
  closingDr: number;
  closingCr: number;
  // comparative (prior period)
  priorClosingDr: number;
  priorClosingCr: number;
  // budget
  budgetAmt: number;
  children: TrialRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n === 0 ? "—" : Number(n).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const thCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls = "px-3 py-2 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function TrialBalance() {
  const { accounts, vouchers, budgets, currentFiscalYear } = useStore();

  const [mode, setMode] = useState<DisplayMode>("columnar");
  const [hideZero, setHideZero] = useState(true);
  const [showBudget, setShowBudget] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState(
    currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01"
  );
  const [toDate, setToDate] = useState(
    currentFiscalYear?.endDate || new Date().getFullYear() + 1 + "-03-31"
  );
  const [priorFrom, setPriorFrom] = useState("");
  const [priorTo, setPriorTo] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // ── Build voucher movement maps ──────────────────────────────────────────
  const { currentMov, priorMov, openingBal } = useMemo(() => {
    const cur: Record<string, { dr: number; cr: number }> = {};
    const prior: Record<string, { dr: number; cr: number }> = {};
    const opening: Record<string, { dr: number; cr: number }> = {};

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date || "";

      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        // Opening: before fromDate
        if (vDate < fromDate) {
          if (!opening[aid]) opening[aid] = { dr: 0, cr: 0 };
          opening[aid].dr += dr;
          opening[aid].cr += cr;
        }

        // Current period
        if (vDate >= fromDate && vDate <= toDate) {
          if (!cur[aid]) cur[aid] = { dr: 0, cr: 0 };
          cur[aid].dr += dr;
          cur[aid].cr += cr;
        }

        // Prior period
        if (priorFrom && priorTo && vDate >= priorFrom && vDate <= priorTo) {
          if (!prior[aid]) prior[aid] = { dr: 0, cr: 0 };
          prior[aid].dr += dr;
          prior[aid].cr += cr;
        }
      }
    }
    return { currentMov: cur, priorMov: prior, openingBal: opening };
  }, [vouchers, fromDate, toDate, priorFrom, priorTo]);

  // ── Build budget map ─────────────────────────────────────────────────────
  const budgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of budgets || []) {
      for (const item of b.items || []) {
        const aid = item.accountId || item.ledgerId;
        if (aid) map[aid] = (map[aid] || 0) + Number(item.amount || 0);
      }
    }
    return map;
  }, [budgets]);

  // ── Build flat trial rows ─────────────────────────────────────────────────
  const allRows = useMemo((): TrialRow[] => {
    const rows: TrialRow[] = [];

    const buildRow = (acc: any, depth: number): TrialRow => {
      const ob = openingBal[acc.id] || { dr: 0, cr: 0 };
      const cm = currentMov[acc.id] || { dr: 0, cr: 0 };
      const pm = priorMov[acc.id] || { dr: 0, cr: 0 };

      const openingNet = ob.dr - ob.cr;
      const openingDr = openingNet >= 0 ? openingNet : 0;
      const openingCr = openingNet < 0 ? -openingNet : 0;

      const closingNet = openingNet + cm.dr - cm.cr;
      const closingDr = closingNet >= 0 ? closingNet : 0;
      const closingCr = closingNet < 0 ? -closingNet : 0;

      const priorNet = pm.dr - pm.cr;
      const priorClosingDr = priorNet >= 0 ? priorNet : 0;
      const priorClosingCr = priorNet < 0 ? -priorNet : 0;

      return {
        id: acc.id,
        code: acc.code || "",
        name: acc.name || "",
        type: acc.type || "",
        level: acc.level || "ledger",
        isGroup: !!acc.isGroup,
        depth,
        parentId: acc.parentId,
        openingDr,
        openingCr,
        movDr: cm.dr,
        movCr: cm.cr,
        closingDr,
        closingCr,
        priorClosingDr,
        priorClosingCr,
        budgetAmt: budgetMap[acc.id] || 0,
        children: [],
      };
    };

    // Build tree
    const map: Record<string, TrialRow> = {};
    const roots: TrialRow[] = [];

    // Sort by type then code
    const sorted = [...accounts].sort((a, b) =>
      (a.type || "").localeCompare(b.type || "") || (a.code || "").localeCompare(b.code || "")
    );

    for (const acc of sorted) {
      const row = buildRow(acc, 0);
      map[acc.id] = row;
    }

    for (const acc of sorted) {
      const row = map[acc.id];
      if (acc.parentId && map[acc.parentId]) {
        map[acc.parentId].children.push(row);
      } else {
        roots.push(row);
      }
    }

    // Aggregate group totals bottom-up
    const aggregate = (row: TrialRow) => {
      for (const child of row.children) aggregate(child);
      if (row.isGroup && row.children.length > 0) {
        row.openingDr = row.children.reduce((s, c) => s + c.openingDr, 0);
        row.openingCr = row.children.reduce((s, c) => s + c.openingCr, 0);
        row.movDr = row.children.reduce((s, c) => s + c.movDr, 0);
        row.movCr = row.children.reduce((s, c) => s + c.movCr, 0);
        row.closingDr = row.children.reduce((s, c) => s + c.closingDr, 0);
        row.closingCr = row.children.reduce((s, c) => s + c.closingCr, 0);
        row.priorClosingDr = row.children.reduce((s, c) => s + c.priorClosingDr, 0);
        row.priorClosingCr = row.children.reduce((s, c) => s + c.priorClosingCr, 0);
      }
    };
    for (const r of roots) aggregate(r);

    // Flatten with depth
    const flatten = (row: TrialRow, depth: number): TrialRow[] => {
      const withDepth = { ...row, depth };
      const result: TrialRow[] = [withDepth];
      if (expandedIds.has(row.id) || !row.isGroup) {
        for (const child of row.children) {
          result.push(...flatten(child, depth + 1));
        }
      }
      return result;
    };

    for (const r of roots) rows.push(...flatten(r, 0));

    return rows;
  }, [accounts, openingBal, currentMov, priorMov, budgetMap, expandedIds]);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (filterType !== "ALL" && r.type !== filterType) return false;
      if (hideZero && r.closingDr === 0 && r.closingCr === 0 && !r.isGroup) return false;
      return true;
    });
  }, [allRows, filterType, hideZero]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const leafRows = filtered.filter((r) => !r.isGroup);
    return {
      openingDr: leafRows.reduce((s, r) => s + r.openingDr, 0),
      openingCr: leafRows.reduce((s, r) => s + r.openingCr, 0),
      movDr: leafRows.reduce((s, r) => s + r.movDr, 0),
      movCr: leafRows.reduce((s, r) => s + r.movCr, 0),
      closingDr: leafRows.reduce((s, r) => s + r.closingDr, 0),
      closingCr: leafRows.reduce((s, r) => s + r.closingCr, 0),
    };
  }, [filtered]);

  const isBalanced =
    Math.abs(totals.closingDr - totals.closingCr) < 0.01;

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(accounts.filter((a) => a.isGroup).map((a) => a.id)));
  };
  const collapseAll = () => setExpandedIds(new Set());

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const rows = filtered.map((r) => ({
      Code: r.code,
      Account: "  ".repeat(r.depth) + r.name,
      Type: r.type,
      "Opening Dr": r.openingDr,
      "Opening Cr": r.openingCr,
      "Movement Dr": r.movDr,
      "Movement Cr": r.movCr,
      "Closing Dr": r.closingDr,
      "Closing Cr": r.closingCr,
      ...(mode === "comparative"
        ? { "Prior Dr": r.priorClosingDr, "Prior Cr": r.priorClosingCr }
        : {}),
      ...(showBudget ? { Budget: r.budgetAmt, Variance: r.closingDr - r.budgetAmt } : {}),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Trial Balance");
    XLSX.writeFile(wb, `TrialBalance_${fromDate}_to_${toDate}.xlsx`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Verify debit = credit across all accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
        {/* Date range */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        {/* Mode selector */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Display Mode</label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(["simple", "columnar", "comparative"] as DisplayMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-8 px-3 text-[11px] font-medium transition-colors capitalize ${
                  mode === m
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Comparative period — only when mode=comparative */}
        {mode === "comparative" && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prior From</label>
              <input
                type="date"
                value={priorFrom}
                onChange={(e) => setPriorFrom(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prior To</label>
              <input
                type="date"
                value={priorTo}
                onChange={(e) => setPriorTo(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>
          </>
        )}

        {/* Type filter */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="ALL">All Types</option>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        {/* Toggles */}
        <label className="flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer h-8">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#1557b0]"
          />
          Hide Zero Accounts
        </label>

        <label className="flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer h-8">
          <input
            type="checkbox"
            checked={showBudget}
            onChange={(e) => setShowBudget(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#1557b0]"
          />
          Budget Variance
        </label>

        {/* Expand / Collapse */}
        <button
          onClick={expandAll}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50"
        >
          Collapse All
        </button>
      </div>

      {/* Balance indicator */}
      <div
        className={`mb-4 px-4 py-2 rounded-md border text-[12px] font-semibold flex items-center gap-2 ${
          isBalanced
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}
      >
        {isBalanced ? "✓ Trial Balance is BALANCED" : `⚠ UNBALANCED — Difference: ${fmt(Math.abs(totals.closingDr - totals.closingCr))}`}
        <span className="ml-auto font-normal text-[11px] text-gray-500">
          Total Dr: {fmt(totals.closingDr)} | Total Cr: {fmt(totals.closingCr)}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className={thCls} style={{ width: 80 }}>Code</th>
                <th className={thCls}>Account Name</th>
                {mode === "columnar" && (
                  <>
                    <th className={`${thCls} text-right`}>Opening Dr</th>
                    <th className={`${thCls} text-right`}>Opening Cr</th>
                    <th className={`${thCls} text-right`}>Movement Dr</th>
                    <th className={`${thCls} text-right`}>Movement Cr</th>
                  </>
                )}
                <th className={`${thCls} text-right`}>Closing Dr</th>
                <th className={`${thCls} text-right`}>Closing Cr</th>
                {mode === "comparative" && (
                  <>
                    <th className={`${thCls} text-right`} style={{ background: "#fff7ed" }}>Prior Dr</th>
                    <th className={`${thCls} text-right`} style={{ background: "#fff7ed" }}>Prior Cr</th>
                    <th className={`${thCls} text-right`} style={{ background: "#fff7ed" }}>Change Dr</th>
                  </>
                )}
                {showBudget && (
                  <>
                    <th className={`${thCls} text-right`} style={{ background: "#f0f9ff" }}>Budget</th>
                    <th className={`${thCls} text-right`} style={{ background: "#f0f9ff" }}>Variance</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                const indent = row.depth * 18;
                const isGroupRow = row.isGroup;
                const variance = row.closingDr - row.budgetAmt;
                const change = row.closingDr - row.priorClosingDr;

                return (
                  <tr
                    key={row.id}
                    className={`${isGroupRow ? "bg-[#f9fafb]" : "hover:bg-gray-50"} cursor-default`}
                  >
                    <td className={`${tdCls} font-mono text-[11px] text-gray-500`}>{row.code}</td>
                    <td className={tdCls}>
                      <div
                        className="flex items-center gap-1.5"
                        style={{ paddingLeft: indent }}
                      >
                        {isGroupRow && row.children.length > 0 ? (
                          <button
                            onClick={() => toggleExpand(row.id)}
                            className="text-gray-400 hover:text-gray-700 shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span className={isGroupRow ? "font-semibold text-gray-800" : "text-gray-700"}>
                          {row.name}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">{row.type}</span>
                      </div>
                    </td>
                    {mode === "columnar" && (
                      <>
                        <td className={amtCls}>{row.openingDr > 0 ? fmt(row.openingDr) : "—"}</td>
                        <td className={amtCls}>{row.openingCr > 0 ? fmt(row.openingCr) : "—"}</td>
                        <td className={amtCls}>{row.movDr > 0 ? fmt(row.movDr) : "—"}</td>
                        <td className={amtCls}>{row.movCr > 0 ? fmt(row.movCr) : "—"}</td>
                      </>
                    )}
                    <td className={`${amtCls} ${isGroupRow ? "font-semibold" : ""}`}>
                      {row.closingDr > 0 ? fmt(row.closingDr) : "—"}
                    </td>
                    <td className={`${amtCls} ${isGroupRow ? "font-semibold" : ""}`}>
                      {row.closingCr > 0 ? fmt(row.closingCr) : "—"}
                    </td>
                    {mode === "comparative" && (
                      <>
                        <td className={amtCls} style={{ background: "#fffbeb" }}>
                          {row.priorClosingDr > 0 ? fmt(row.priorClosingDr) : "—"}
                        </td>
                        <td className={amtCls} style={{ background: "#fffbeb" }}>
                          {row.priorClosingCr > 0 ? fmt(row.priorClosingCr) : "—"}
                        </td>
                        <td
                          className={`${amtCls} font-semibold`}
                          style={{ background: "#fffbeb" }}
                        >
                          <span className={change >= 0 ? "text-green-700" : "text-red-600"}>
                            {change !== 0 ? (change > 0 ? "+" : "") + fmt(change) : "—"}
                          </span>
                        </td>
                      </>
                    )}
                    {showBudget && (
                      <>
                        <td className={amtCls} style={{ background: "#f0f9ff" }}>
                          {row.budgetAmt > 0 ? fmt(row.budgetAmt) : "—"}
                        </td>
                        <td
                          className={`${amtCls} font-semibold`}
                          style={{ background: "#f0f9ff" }}
                        >
                          {row.budgetAmt > 0 ? (
                            <span className={variance >= 0 ? "text-green-700" : "text-red-600"}>
                              {(variance > 0 ? "+" : "") + fmt(variance)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {/* Grand total row */}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                <td className={tdCls} colSpan={2}>
                  <span className="font-bold text-gray-800">GRAND TOTAL</span>
                </td>
                {mode === "columnar" && (
                  <>
                    <td className={amtCls}>{fmt(totals.openingDr)}</td>
                    <td className={amtCls}>{fmt(totals.openingCr)}</td>
                    <td className={amtCls}>{fmt(totals.movDr)}</td>
                    <td className={amtCls}>{fmt(totals.movCr)}</td>
                  </>
                )}
                <td className={`${amtCls} text-[#1557b0]`}>{fmt(totals.closingDr)}</td>
                <td className={`${amtCls} text-[#1557b0]`}>{fmt(totals.closingCr)}</td>
                {mode === "comparative" && <td colSpan={3} />}
                {showBudget && <td colSpan={2} />}
              </tr>
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-[12px] text-gray-500">
            No accounts found for the selected period and filters.
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Showing {filtered.length} accounts • Period: {fromDate} to {toDate}
        {hideZero ? " • Zero-balance accounts hidden" : ""}
      </p>
    </div>
  );
}
