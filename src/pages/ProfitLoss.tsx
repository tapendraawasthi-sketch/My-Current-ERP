// src/pages/ProfitLoss.tsx
// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import * as XLSX from "xlsx";
import { Download, ChevronDown, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PLMode = "standard" | "monthly" | "comparative";

interface PLRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isGroup: boolean;
  depth: number;
  amount: number;           // current period net
  priorAmount: number;      // prior period net
  pctOfSales: number;       // % of net sales
  budgetAmt: number;
  monthlyAmts: number[];    // index 0-11 (Baisakh to Chaitra or Apr-Mar)
  children: PLRow[];
}

const fmt = (n: number) =>
  n === 0
    ? "—"
    : Math.abs(n).toLocaleString("en-NP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const thCls =
  "px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls = "px-2 py-2 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

const MONTHS = [
  "Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProfitLoss() {
  const { accounts, vouchers, budgets, costCenters, currentFiscalYear, companySettings } =
    useStore();

  const [mode, setMode] = useState<PLMode>("standard");
  const [showPct, setShowPct] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [costCentreId, setCostCentreId] = useState("ALL");

  const fyStart = currentFiscalYear?.startDate || (new Date().getFullYear() + "-04-01");
  const fyEnd   = currentFiscalYear?.endDate   || (new Date().getFullYear() + 1 + "-03-31");

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate, setToDate]     = useState(fyEnd);
  const [priorFrom, setPriorFrom] = useState("");
  const [priorTo, setPriorTo]     = useState("");

  // ── Budget map ─────────────────────────────────────────────────────────────
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

  // ── Voucher movement computation ───────────────────────────────────────────
  // Returns net amount per account for a date range
  const computeMovements = (
    start: string,
    end: string,
    ccId = "ALL"
  ): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date || "";
      if (vDate < start || vDate > end) continue;
      for (const line of v.lines || []) {
        if (ccId !== "ALL" && line.costCenterId !== ccId) continue;
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] = (map[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }
    return map;
  };

  // ── Monthly movement (12 months based on fiscal year start) ───────────────
  const monthlyMaps = useMemo((): Record<string, number>[] => {
    if (mode !== "monthly") return [];
    const startYear = parseInt(fyStart.split("-")[0]);
    const startMonth = parseInt(fyStart.split("-")[1]) - 1; // 0-indexed

    return MONTHS.map((_, idx) => {
      const mYear = startMonth + idx >= 12 ? startYear + 1 : startYear;
      const mMonth = ((startMonth + idx) % 12) + 1;
      const mStart = `${mYear}-${String(mMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(mYear, mMonth, 0).getDate();
      const mEnd = `${mYear}-${String(mMonth).padStart(2, "0")}-${lastDay}`;
      return computeMovements(mStart, mEnd, costCentreId);
    });
  }, [vouchers, fyStart, mode, costCentreId]);

  const currentMap = useMemo(
    () => computeMovements(fromDate, toDate, costCentreId),
    [vouchers, fromDate, toDate, costCentreId]
  );

  const priorMap = useMemo(
    () => (priorFrom && priorTo ? computeMovements(priorFrom, priorTo) : {}),
    [vouchers, priorFrom, priorTo]
  );

  // ── Build P&L tree ─────────────────────────────────────────────────────────
  const buildPLTree = (): { incomeRoots: PLRow[]; expenseRoots: PLRow[] } => {
    const nodeMap: Record<string, PLRow> = {};

    const sorted = [...accounts].sort(
      (a, b) =>
        (a.type || "").localeCompare(b.type || "") ||
        (a.code || "").localeCompare(b.code || "")
    );

    for (const acc of sorted) {
      if (acc.type !== "income" && acc.type !== "expense") continue;

      // For income accounts: credit side is positive revenue
      // For expense accounts: debit side is positive expense
      const raw = currentMap[acc.id] || 0;
      const amount = acc.type === "income" ? -raw : raw; // income is Cr-heavy → negative raw

      const priorRaw = priorMap[acc.id] || 0;
      const priorAmount = acc.type === "income" ? -priorRaw : priorRaw;

      const monthlyAmts = monthlyMaps.map((mm) => {
        const r = mm[acc.id] || 0;
        return acc.type === "income" ? -r : r;
      });

      nodeMap[acc.id] = {
        id: acc.id,
        code: acc.code || "",
        name: acc.name || "",
        type: acc.type || "",
        isGroup: !!acc.isGroup,
        depth: 0,
        amount,
        priorAmount,
        pctOfSales: 0,
        budgetAmt: budgetMap[acc.id] || 0,
        monthlyAmts,
        children: [],
      };
    }

    const incomeRoots: PLRow[] = [];
    const expenseRoots: PLRow[] = [];

    for (const acc of sorted) {
      if (!nodeMap[acc.id]) continue;
      const node = nodeMap[acc.id];
      if (acc.parentId && nodeMap[acc.parentId]) {
        nodeMap[acc.parentId].children.push(node);
      } else {
        if (acc.type === "income") incomeRoots.push(node);
        else if (acc.type === "expense") expenseRoots.push(node);
      }
    }

    // Aggregate groups bottom-up
    const aggregate = (node: PLRow) => {
      for (const child of node.children) aggregate(child);
      if (node.isGroup && node.children.length > 0) {
        node.amount = node.children.reduce((s, c) => s + c.amount, 0);
        node.priorAmount = node.children.reduce((s, c) => s + c.priorAmount, 0);
        node.monthlyAmts = MONTHS.map((_, i) =>
          node.children.reduce((s, c) => s + (c.monthlyAmts[i] || 0), 0)
        );
      }
    };
    for (const r of [...incomeRoots, ...expenseRoots]) aggregate(r);

    return { incomeRoots, expenseRoots };
  };

  const { incomeRoots, expenseRoots } = useMemo(
    buildPLTree,
    [accounts, currentMap, priorMap, monthlyMaps, budgetMap]
  );

  const totalIncome  = incomeRoots.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenseRoots.reduce((s, r) => s + r.amount, 0);
  const netProfit    = totalIncome - totalExpense;

  const priorTotalIncome  = incomeRoots.reduce((s, r) => s + r.priorAmount, 0);
  const priorTotalExpense = expenseRoots.reduce((s, r) => s + r.priorAmount, 0);
  const priorNetProfit    = priorTotalIncome - priorTotalExpense;

  // Monthly totals
  const monthlyIncome  = MONTHS.map((_, i) => incomeRoots.reduce((s, r) => s + (r.monthlyAmts[i] || 0), 0));
  const monthlyExpense = MONTHS.map((_, i) => expenseRoots.reduce((s, r) => s + (r.monthlyAmts[i] || 0), 0));
  const monthlyProfit  = MONTHS.map((_, i) => (monthlyIncome[i] || 0) - (monthlyExpense[i] || 0));

  // Identify COGS / Trading expenses for Gross Profit calculation
  const cogsRoots = expenseRoots.filter(
    (r) =>
      (r.name || "").toLowerCase().includes("cost of") ||
      (r.name || "").toLowerCase().includes("purchase") ||
      (r.name || "").toLowerCase().includes("direct")
  );
  const opexRoots = expenseRoots.filter(
    (r) => !cogsRoots.find((c) => c.id === r.id)
  );
  const totalCOGS   = cogsRoots.reduce((s, r) => s + r.amount, 0);
  const grossProfit = totalIncome - totalCOGS;

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () =>
    setExpandedIds(
      new Set(
        accounts
          .filter((a) => a.isGroup && (a.type === "income" || a.type === "expense"))
          .map((a) => a.id)
      )
    );

  const collapseAll = () => setExpandedIds(new Set());

  // ── Flatten nodes ─────────────────────────────────────────────────────────
  const flattenNodes = (nodes: PLRow[], depth = 0): PLRow[] => {
    const result: PLRow[] = [];
    for (const node of nodes) {
      result.push({ ...node, depth });
      if (expandedIds.has(node.id) && node.children.length > 0) {
        result.push(...flattenNodes(node.children, depth + 1));
      }
    }
    return result;
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const makeRows = (nodes: PLRow[], section: string) =>
      flattenNodes(nodes).map((n) => ({
        Section: section,
        Code: n.code,
        Account: "  ".repeat(n.depth) + n.name,
        Amount: n.amount,
        ...(mode === "comparative" ? { "Prior Amount": n.priorAmount } : {}),
        ...(showBudget
          ? { Budget: n.budgetAmt, Variance: n.amount - n.budgetAmt }
          : {}),
        ...(mode === "monthly"
          ? Object.fromEntries(MONTHS.map((m, i) => [m, n.monthlyAmts[i] || 0]))
          : {}),
      }));

    const data = [
      ...makeRows(incomeRoots, "Income"),
      ...makeRows(expenseRoots, "Expenses"),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Profit & Loss"
    );
    XLSX.writeFile(wb, `ProfitLoss_${fromDate}_to_${toDate}.xlsx`);
  };

  // ─── Section renderer (standard mode) ────────────────────────────────────
  const renderSection = (
    nodes: PLRow[],
    sectionTotal: number,
    priorTotal: number,
    label: string,
    totalLabel: string,
    amtColor = "text-gray-800"
  ) => {
    const flat = flattenNodes(nodes);
    const colCount =
      2 +
      (mode === "comparative" ? 1 : 0) +
      (showPct ? 1 : 0) +
      (showBudget ? 2 : 0);

    return (
      <>
        <tr>
          <td
            colSpan={colCount + 1}
            className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200"
          >
            {label}
          </td>
        </tr>
        {flat.map((row) => {
          const indent = row.depth * 16;
          const pct = totalIncome > 0 ? (row.amount / totalIncome) * 100 : 0;
          const variance = row.amount - row.budgetAmt;

          return (
            <tr key={row.id} className={row.isGroup ? "bg-gray-50" : "hover:bg-gray-50"}>
              <td className="px-2 py-1.5 text-[11px] font-mono text-gray-400 border-b border-gray-100" style={{ width: 70 }}>
                {row.code}
              </td>
              <td className="px-2 py-1.5 border-b border-gray-100">
                <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
                  {row.isGroup && row.children.length > 0 ? (
                    <button onClick={() => toggleExpand(row.id)} className="text-gray-400 hover:text-gray-700 shrink-0">
                      {expandedIds.has(row.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className={row.isGroup ? "font-semibold text-gray-800" : "text-gray-700"}>
                    {row.name}
                  </span>
                </div>
              </td>
              <td className={`${amtCls} ${row.isGroup ? "font-semibold" : ""}`}>
                {row.amount !== 0 ? fmt(row.amount) : "—"}
              </td>
              {mode === "comparative" && (
                <td className={`${amtCls} text-gray-500`} style={{ background: "#fffbeb" }}>
                  {row.priorAmount !== 0 ? fmt(row.priorAmount) : "—"}
                </td>
              )}
              {showPct && (
                <td className={`${amtCls} text-gray-500`} style={{ background: "#f0f9ff" }}>
                  {totalIncome > 0 ? pct.toFixed(1) + "%" : "—"}
                </td>
              )}
              {showBudget && (
                <>
                  <td className={`${amtCls}`} style={{ background: "#f0fdf4" }}>
                    {row.budgetAmt !== 0 ? fmt(row.budgetAmt) : "—"}
                  </td>
                  <td className={`${amtCls} font-semibold`} style={{ background: "#f0fdf4" }}>
                    {row.budgetAmt !== 0 ? (
                      <span className={variance >= 0 ? "text-green-700" : "text-red-600"}>
                        {(variance > 0 ? "+" : "") + fmt(variance)}
                      </span>
                    ) : "—"}
                  </td>
                </>
              )}
            </tr>
          );
        })}

        {/* Section total */}
        <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
          <td className={tdCls} />
          <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-b border-gray-100">
            {totalLabel}
          </td>
          <td className={`${amtCls} font-bold ${amtColor}`}>
            {fmt(sectionTotal)}
          </td>
          {mode === "comparative" && (
            <td className={`${amtCls} font-bold text-amber-700`} style={{ background: "#fffbeb" }}>
              {fmt(priorTotal)}
            </td>
          )}
          {showPct && <td style={{ background: "#f0f9ff" }} className={amtCls} />}
          {showBudget && <td colSpan={2} style={{ background: "#f0fdf4" }} />}
        </tr>
        <tr><td colSpan={colCount + 1} className="py-1" /></tr>
      </>
    );
  };

  // ─── Monthly mode renderer ────────────────────────────────────────────────
  const renderMonthly = (nodes: PLRow[], label: string, totals: number[]) => {
    const flat = flattenNodes(nodes);
    return (
      <>
        <tr>
          <td
            colSpan={MONTHS.length + 3}
            className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200"
          >
            {label}
          </td>
        </tr>
        {flat.map((row) => (
          <tr key={row.id} className={row.isGroup ? "bg-gray-50" : "hover:bg-gray-50"}>
            <td className="px-2 py-1.5 text-[11px] font-mono text-gray-400 border-b border-gray-100" style={{ width: 60 }}>
              {row.code}
            </td>
            <td className="px-2 py-1.5 border-b border-gray-100">
              <div className="flex items-center gap-1.5" style={{ paddingLeft: row.depth * 16 }}>
                {row.isGroup && row.children.length > 0 ? (
                  <button onClick={() => toggleExpand(row.id)} className="text-gray-400 hover:text-gray-700 shrink-0">
                    {expandedIds.has(row.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : <span className="w-3.5 shrink-0" />}
                <span className={row.isGroup ? "font-semibold text-gray-800" : "text-gray-700"}>
                  {row.name}
                </span>
              </div>
            </td>
            {MONTHS.map((m, i) => (
              <td key={m} className="px-2 py-1.5 text-[11px] font-mono text-right border-b border-gray-100">
                {(row.monthlyAmts[i] || 0) !== 0 ? fmt(row.monthlyAmts[i]) : "—"}
              </td>
            ))}
            <td className="px-2 py-1.5 text-[11px] font-mono font-semibold text-right border-b border-gray-100 bg-gray-50">
              {row.amount !== 0 ? fmt(row.amount) : "—"}
            </td>
          </tr>
        ))}
        <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
          <td className={tdCls} />
          <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-b border-gray-100">Total</td>
          {totals.map((t, i) => (
            <td key={i} className="px-2 py-2.5 text-[11px] font-bold font-mono text-right border-b border-gray-100">
              {t !== 0 ? fmt(t) : "—"}
            </td>
          ))}
          <td className="px-2 py-2.5 text-[11px] font-bold font-mono text-right border-b border-gray-100 text-[#1557b0] bg-gray-50">
            {fmt(totals.reduce((s, v) => s + v, 0))}
          </td>
        </tr>
        <tr><td colSpan={MONTHS.length + 3} className="py-1" /></tr>
      </>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Profit &amp; Loss</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — {fromDate} to {toDate}
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
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
        </div>

        {/* Mode */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Mode</label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(["standard", "monthly", "comparative"] as PLMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`h-8 px-3 text-[11px] font-medium capitalize transition-colors ${
                  mode === m ? "bg-[#1557b0] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Comparative dates */}
        {mode === "comparative" && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prior From</label>
              <input type="date" value={priorFrom} onChange={(e) => setPriorFrom(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prior To</label>
              <input type="date" value={priorTo} onChange={(e) => setPriorTo(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
          </>
        )}

        {/* Cost Centre */}
        {(costCenters || []).length > 0 && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Cost Centre</label>
            <select value={costCentreId} onChange={(e) => setCostCentreId(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
              <option value="ALL">All Centres</option>
              {(costCenters || []).map((cc: any) => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Toggles */}
        {mode !== "monthly" && (
          <label className="flex items-center gap-1.5 h-8 text-[12px] text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showPct} onChange={(e) => setShowPct(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#1557b0]" />
            % of Sales
          </label>
        )}
        <label className="flex items-center gap-1.5 h-8 text-[12px] text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showBudget} onChange={(e) => setShowBudget(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#1557b0]" />
          Budget Variance
        </label>
        <button onClick={expandAll}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50">
          Expand All
        </button>
        <button onClick={collapseAll}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50">
          Collapse All
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Income", value: totalIncome, color: "text-green-700" },
          { label: "Total Expenses", value: totalExpense, color: "text-red-600" },
          {
            label: "Gross Profit",
            value: grossProfit,
            color: grossProfit >= 0 ? "text-[#1557b0]" : "text-red-600",
          },
          {
            label: "Net Profit / Loss",
            value: netProfit,
            color: netProfit >= 0 ? "text-green-700" : "text-red-600",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              {kpi.label}
            </p>
            <p className={`text-[15px] font-bold font-mono mt-1 ${kpi.color}`}>
              Rs. {fmt(kpi.value)}
            </p>
            {mode === "comparative" && kpi.label === "Net Profit / Loss" && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Prior: Rs. {fmt(priorNetProfit)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Report table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {mode === "monthly" ? (
            <table className="w-full" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th className={thCls} style={{ width: 60 }}>Code</th>
                  <th className={thCls}>Account</th>
                  {MONTHS.map((m) => <th key={m} className={`${thCls} text-right`} style={{ width: 80 }}>{m}</th>)}
                  <th className={`${thCls} text-right`} style={{ width: 100 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {renderMonthly(incomeRoots, "INCOME", monthlyIncome)}
                {renderMonthly(expenseRoots, "EXPENSES", monthlyExpense)}

                {/* Monthly net profit row */}
                <tr className="bg-[#1e2433] text-white">
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-[12px] font-bold">NET PROFIT / (LOSS)</td>
                  {monthlyProfit.map((p, i) => (
                    <td key={i} className={`px-2 py-2.5 text-[11px] font-bold font-mono text-right ${p >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p !== 0 ? fmt(p) : "—"}
                    </td>
                  ))}
                  <td className={`px-2 py-2.5 text-[12px] font-bold font-mono text-right ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmt(netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className={thCls} style={{ width: 70 }}>Code</th>
                  <th className={thCls}>Account</th>
                  <th className={`${thCls} text-right`}>Amount (Rs.)</th>
                  {mode === "comparative" && (
                    <th className={`${thCls} text-right`} style={{ background: "#fffbeb" }}>
                      Prior Period
                    </th>
                  )}
                  {showPct && (
                    <th className={`${thCls} text-right`} style={{ background: "#f0f9ff" }}>
                      % of Sales
                    </th>
                  )}
                  {showBudget && (
                    <>
                      <th className={`${thCls} text-right`} style={{ background: "#f0fdf4" }}>Budget</th>
                      <th className={`${thCls} text-right`} style={{ background: "#f0fdf4" }}>Variance</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {renderSection(
                  incomeRoots, totalIncome, priorTotalIncome,
                  "INCOME / REVENUE", "Total Income", "text-green-700"
                )}
                {renderSection(
                  expenseRoots, totalExpense, priorTotalExpense,
                  "EXPENSES", "Total Expenses", "text-red-600"
                )}

                {/* Net Profit row */}
                <tr className="bg-[#1e2433] text-white">
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-[12px] font-bold">NET PROFIT / (LOSS)</td>
                  <td className={`px-3 py-2.5 text-[12px] font-bold font-mono text-right ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    Rs. {fmt(netProfit)}
                  </td>
                  {mode === "comparative" && (
                    <td className={`px-3 py-2.5 text-[12px] font-bold font-mono text-right ${priorNetProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      Rs. {fmt(priorNetProfit)}
                    </td>
                  )}
                  {showPct && <td />}
                  {showBudget && <td colSpan={2} />}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Based on posted vouchers • {fromDate} to {toDate}
        {costCentreId !== "ALL" ? ` • Cost Centre filtered` : ""}
      </p>
    </div>
  );
}
