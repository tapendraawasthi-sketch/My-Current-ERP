// src/pages/BalanceSheet.tsx
// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import * as XLSX from "xlsx";
import { Download, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type BSFormat = "vertical" | "horizontal";

interface BSNode {
  id: string;
  code: string;
  name: string;
  type: string;
  level: string;
  isGroup: boolean;
  depth: number;
  balance: number;        // current period closing balance (signed: positive = normal side)
  priorBalance: number;   // prior period closing balance
  pct: number;            // % of total assets
  children: BSNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, abs = true) => {
  const v = abs ? Math.abs(n) : n;
  return Number(v).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const pctFmt = (n: number) =>
  n === 0 ? "—" : (n > 0 ? "" : "-") + Math.abs(n).toFixed(1) + "%";

const thCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls = "px-3 py-2 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

// ─── Determine if an account type is debit-nature ─────────────────────────────
const isDebitNature = (type: string) =>
  type === "asset" || type === "expense";

// ─── Component ────────────────────────────────────────────────────────────────
export default function BalanceSheet() {
  const { accounts, vouchers, invoices, stockMovements, currentFiscalYear, companySettings } =
    useStore();

  const [format, setFormat] = useState<BSFormat>("vertical");
  const [showPct, setShowPct] = useState(false);
  const [showComparative, setShowComparative] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [asOfDate, setAsOfDate] = useState(
    currentFiscalYear?.endDate || new Date().toISOString().split("T")[0]
  );
  const [priorDate, setPriorDate] = useState(
    currentFiscalYear?.startDate || ""
  );

  // ── Compute account balances from vouchers ────────────────────────────────
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date || "";
      if (vDate > asOfDate) continue;

      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] = (map[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }

    // Also factor in opening balances from account master
    for (const acc of accounts) {
      if (acc.openingBalance && acc.openingBalanceDate) {
        if (acc.openingBalanceDate <= asOfDate) {
          const ob = Number(acc.openingBalance || 0);
          const sign = acc.openingBalanceDr > 0 ? 1 : -1;
          map[acc.id] = (map[acc.id] || 0) + ob * sign;
        }
      }
    }

    return map;
  }, [vouchers, accounts, asOfDate]);

  // Prior period balance map
  const priorBalanceMap = useMemo(() => {
    if (!showComparative || !priorDate) return {};
    const map: Record<string, number> = {};

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date || "";
      if (vDate > priorDate) continue;

      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] = (map[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }

    for (const acc of accounts) {
      if (acc.openingBalance && acc.openingBalanceDate) {
        if (acc.openingBalanceDate <= priorDate) {
          const ob = Number(acc.openingBalance || 0);
          const sign = acc.openingBalanceDr > 0 ? 1 : -1;
          map[acc.id] = (map[acc.id] || 0) + ob * sign;
        }
      }
    }

    return map;
  }, [vouchers, accounts, priorDate, showComparative]);

  // ── Compute closing stock from inventory ───────────────────────────────────
  const closingStockValue = useMemo(() => {
    const inflow = stockMovements
      .filter((m) => {
        const t = (m.type || "").toLowerCase();
        return (
          (t.includes("purchase") || t.includes("in") || t.includes("opening")) &&
          (m.date || "") <= asOfDate
        );
      })
      .reduce((s, m) => s + Number(m.qty || 0) * Number(m.rate || 0), 0);

    const outflow = stockMovements
      .filter((m) => {
        const t = (m.type || "").toLowerCase();
        return (
          (t.includes("sales") || t.includes("out")) &&
          (m.date || "") <= asOfDate
        );
      })
      .reduce((s, m) => s + Number(m.qty || 0) * Number(m.rate || 0), 0);

    return Math.max(0, inflow - outflow);
  }, [stockMovements, asOfDate]);

  // ── Build BSNode tree ──────────────────────────────────────────────────────
  const buildTree = (
    bMap: Record<string, number>,
    pMap: Record<string, number>
  ) => {
    const nodeMap: Record<string, BSNode> = {};

    const sorted = [...accounts].sort(
      (a, b) =>
        (a.type || "").localeCompare(b.type || "") ||
        (a.code || "").localeCompare(b.code || "")
    );

    for (const acc of sorted) {
      const rawBal = bMap[acc.id] || 0;
      const priorRaw = pMap[acc.id] || 0;

      // Normalize: positive = normal side of the account type
      const balance = isDebitNature(acc.type) ? rawBal : -rawBal;
      const priorBalance = isDebitNature(acc.type) ? priorRaw : -priorRaw;

      nodeMap[acc.id] = {
        id: acc.id,
        code: acc.code || "",
        name: acc.name || "",
        type: acc.type || "",
        level: acc.level || "ledger",
        isGroup: !!acc.isGroup,
        depth: 0,
        balance,
        priorBalance,
        pct: 0,
        children: [],
      };
    }

    const roots: BSNode[] = [];
    for (const acc of sorted) {
      const node = nodeMap[acc.id];
      if (acc.parentId && nodeMap[acc.parentId]) {
        nodeMap[acc.parentId].children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Aggregate groups bottom-up
    const aggregate = (node: BSNode): void => {
      for (const child of node.children) aggregate(child);
      if (node.isGroup && node.children.length > 0) {
        node.balance = node.children.reduce((s, c) => s + c.balance, 0);
        node.priorBalance = node.children.reduce(
          (s, c) => s + c.priorBalance,
          0
        );
      }
    };
    for (const r of roots) aggregate(r);

    return { roots, nodeMap };
  };

  const { roots } = useMemo(
    () => buildTree(balanceMap, priorBalanceMap),
    [balanceMap, priorBalanceMap]
  );

  // ── Separate into Balance Sheet categories ────────────────────────────────
  const getByType = (type: string) =>
    roots.filter((r) => r.type === type || r.type === type.toLowerCase());

  const assetRoots = roots.filter((r) => r.type === "asset");
  const liabilityRoots = roots.filter((r) => r.type === "liability");
  const equityRoots = roots.filter((r) => r.type === "equity");

  const totalAssets = assetRoots.reduce((s, r) => s + r.balance, 0) + closingStockValue;
  const totalLiabilities = liabilityRoots.reduce((s, r) => s + r.balance, 0);
  const totalEquity = equityRoots.reduce((s, r) => s + r.balance, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const priorTotalAssets = assetRoots.reduce((s, r) => s + r.priorBalance, 0);
  const priorTotalLiabilities = liabilityRoots.reduce(
    (s, r) => s + r.priorBalance,
    0
  );
  const priorTotalEquity = equityRoots.reduce(
    (s, r) => s + r.priorBalance,
    0
  );

  const isBalanced =
    Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

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
      new Set(accounts.filter((a) => a.isGroup).map((a) => a.id))
    );
  const collapseAll = () => setExpandedIds(new Set());

  // ── Flatten nodes for table rendering ────────────────────────────────────
  const flattenNodes = (nodes: BSNode[], depth = 0): BSNode[] => {
    const result: BSNode[] = [];
    for (const node of nodes) {
      const withDepth = { ...node, depth };
      result.push(withDepth);
      if (expandedIds.has(node.id) && node.children.length > 0) {
        result.push(...flattenNodes(node.children, depth + 1));
      }
    }
    return result;
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const makeRows = (nodes: BSNode[], label: string) =>
      flattenNodes(nodes).map((n) => ({
        Section: label,
        Code: n.code,
        Account: "  ".repeat(n.depth) + n.name,
        Balance: n.balance,
        "Prior Balance": showComparative ? n.priorBalance : undefined,
        "% of Total Assets": showPct
          ? totalAssets > 0
            ? ((n.balance / totalAssets) * 100).toFixed(1) + "%"
            : "—"
          : undefined,
      }));

    const data = [
      ...makeRows(assetRoots, "Assets"),
      ...makeRows(liabilityRoots, "Liabilities"),
      ...makeRows(equityRoots, "Equity"),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Balance Sheet"
    );
    XLSX.writeFile(wb, `BalanceSheet_${asOfDate}.xlsx`);
  };

  // ─── Reusable section renderer ────────────────────────────────────────────
  const renderSection = (
    nodes: BSNode[],
    sectionTotal: number,
    priorTotal: number,
    label: string,
    totalLabel: string
  ) => {
    const flat = flattenNodes(nodes);

    return (
      <>
        {/* Section header */}
        <tr>
          <td
            colSpan={showComparative ? (showPct ? 5 : 4) : showPct ? 4 : 3}
            className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200"
          >
            {label}
          </td>
        </tr>

        {flat.map((node) => {
          const indent = node.depth * 18;
          const pctVal =
            totalAssets > 0 ? (node.balance / totalAssets) * 100 : 0;

          return (
            <tr
              key={node.id}
              className={`${node.isGroup ? "bg-gray-50" : "hover:bg-gray-50"}`}
            >
              <td className={`${tdCls} font-mono text-[11px] text-gray-400`} style={{ width: 80 }}>
                {node.code}
              </td>
              <td className={tdCls}>
                <div
                  className="flex items-center gap-1.5"
                  style={{ paddingLeft: indent }}
                >
                  {node.isGroup && node.children.length > 0 ? (
                    <button
                      onClick={() => toggleExpand(node.id)}
                      className="text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      {expandedIds.has(node.id) ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span
                    className={
                      node.isGroup
                        ? "font-semibold text-gray-800"
                        : "text-gray-700"
                    }
                  >
                    {node.name}
                  </span>
                </div>
              </td>
              <td className={`${amtCls} ${node.isGroup ? "font-semibold" : ""}`}>
                {node.balance !== 0 ? fmt(node.balance) : "—"}
              </td>
              {showComparative && (
                <td className={`${amtCls} text-gray-500`} style={{ background: "#fffbeb" }}>
                  {node.priorBalance !== 0 ? fmt(node.priorBalance) : "—"}
                </td>
              )}
              {showPct && (
                <td className={`${amtCls} text-gray-500`} style={{ background: "#f0f9ff" }}>
                  {pctFmt(pctVal)}
                </td>
              )}
            </tr>
          );
        })}

        {/* Section total */}
        <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
          <td className={tdCls} />
          <td className="px-3 py-2 text-[12px] font-bold text-gray-800 border-b border-gray-100">
            {totalLabel}
          </td>
          <td className="px-3 py-2 text-[12px] font-bold font-mono text-right text-[#1557b0] border-b border-gray-100">
            {fmt(sectionTotal)}
          </td>
          {showComparative && (
            <td
              className="px-3 py-2 text-[12px] font-bold font-mono text-right text-amber-700 border-b border-gray-100"
              style={{ background: "#fffbeb" }}
            >
              {fmt(priorTotal)}
            </td>
          )}
          {showPct && (
            <td
              className="px-3 py-2 text-[12px] font-bold font-mono text-right text-gray-500 border-b border-gray-100"
              style={{ background: "#f0f9ff" }}
            >
              {pctFmt(
                totalAssets > 0 ? (sectionTotal / totalAssets) * 100 : 0
              )}
            </td>
          )}
        </tr>
        <tr>
          <td
            colSpan={showComparative ? (showPct ? 5 : 4) : showPct ? 4 : 3}
            className="py-1"
          />
        </tr>
      </>
    );
  };

  // ─── Vertical format (single column) ─────────────────────────────────────
  const renderVertical = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              <th className={thCls} style={{ width: 80 }}>Code</th>
              <th className={thCls}>Account</th>
              <th className={`${thCls} text-right`}>
                As of {asOfDate}
              </th>
              {showComparative && (
                <th
                  className={`${thCls} text-right`}
                  style={{ background: "#fffbeb" }}
                >
                  Prior ({priorDate || "—"})
                </th>
              )}
              {showPct && (
                <th
                  className={`${thCls} text-right`}
                  style={{ background: "#f0f9ff" }}
                >
                  % of Assets
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {renderSection(
              assetRoots,
              totalAssets,
              priorTotalAssets,
              "ASSETS",
              "Total Assets"
            )}

            {/* Closing Stock line (from inventory) */}
            <tr className="bg-blue-50">
              <td className={`${tdCls} font-mono text-[11px] text-gray-400`} />
              <td className={tdCls}>
                <span className="text-[12px] text-blue-700 font-medium pl-5">
                  + Closing Stock (Inventory)
                </span>
              </td>
              <td className="px-3 py-2 text-[12px] font-mono text-right text-blue-700 border-b border-gray-100">
                {fmt(closingStockValue)}
              </td>
              {showComparative && <td style={{ background: "#fffbeb" }} className={amtCls}>—</td>}
              {showPct && <td style={{ background: "#f0f9ff" }} className={amtCls}>—</td>}
            </tr>
            <tr>
              <td colSpan={showComparative ? (showPct ? 5 : 4) : showPct ? 4 : 3} className="py-1" />
            </tr>

            {renderSection(
              liabilityRoots,
              totalLiabilities,
              priorTotalLiabilities,
              "LIABILITIES",
              "Total Liabilities"
            )}

            {renderSection(
              equityRoots,
              totalEquity,
              priorTotalEquity,
              "EQUITY / CAPITAL",
              "Total Equity"
            )}

            {/* Grand total */}
            <tr className="bg-[#1e2433] text-white">
              <td className="px-3 py-2.5 text-[12px]" />
              <td className="px-3 py-2.5 text-[12px] font-bold">
                Total Liabilities + Equity
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right">
                {fmt(totalLiabilitiesAndEquity)}
              </td>
              {showComparative && (
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right">
                  {fmt(priorTotalLiabilities + priorTotalEquity)}
                </td>
              )}
              {showPct && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Horizontal (T-Format) ────────────────────────────────────────────────
  const renderHorizontal = () => {
    const assetFlat = flattenNodes(assetRoots);
    const liabEquityFlat = [
      ...flattenNodes(liabilityRoots),
      ...flattenNodes(equityRoots),
    ];
    const maxRows = Math.max(assetFlat.length, liabEquityFlat.length);

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead>
              <tr>
                <th className={thCls} colSpan={2} style={{ textAlign: "center" }}>
                  LIABILITIES & EQUITY
                </th>
                <th className={`${thCls} text-right`} style={{ width: 130 }}>
                  Amount
                </th>
                <th className={thCls} colSpan={2} style={{ textAlign: "center" }}>
                  ASSETS
                </th>
                <th className={`${thCls} text-right`} style={{ width: 130 }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows + 3 }).map((_, i) => {
                const liabNode = liabEquityFlat[i];
                const assetNode = assetFlat[i];

                // Summary rows at the bottom
                if (i === maxRows) {
                  return (
                    <tr key="summary1" className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                      <td className={tdCls} />
                      <td className="px-3 py-2.5 font-bold text-gray-800 border-b border-gray-100">
                        Total Liabilities + Equity
                      </td>
                      <td className="px-3 py-2.5 font-bold font-mono text-right text-[#1557b0] border-b border-gray-100">
                        {fmt(totalLiabilitiesAndEquity)}
                      </td>
                      <td className={tdCls} />
                      <td className="px-3 py-2.5 font-bold text-gray-800 border-b border-gray-100">
                        Total Assets
                      </td>
                      <td className="px-3 py-2.5 font-bold font-mono text-right text-[#1557b0] border-b border-gray-100">
                        {fmt(totalAssets)}
                      </td>
                    </tr>
                  );
                }
                if (i > maxRows) return null;

                return (
                  <tr key={i} className="hover:bg-gray-50">
                    {/* Left side — liabilities & equity */}
                    {liabNode ? (
                      <>
                        <td
                          className="px-2 py-1.5 text-[11px] font-mono text-gray-400 border-b border-gray-100"
                          style={{ width: 60 }}
                        >
                          {liabNode.code}
                        </td>
                        <td
                          className="px-2 py-1.5 border-b border-gray-100"
                          style={{
                            paddingLeft: 8 + liabNode.depth * 14,
                            fontWeight: liabNode.isGroup ? 600 : 400,
                          }}
                        >
                          {liabNode.name}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right border-b border-r border-gray-200">
                          {liabNode.balance !== 0
                            ? fmt(liabNode.balance)
                            : ""}
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="border-b border-r border-gray-200" />
                    )}

                    {/* Right side — assets */}
                    {assetNode ? (
                      <>
                        <td
                          className="px-2 py-1.5 text-[11px] font-mono text-gray-400 border-b border-gray-100"
                          style={{ width: 60 }}
                        >
                          {assetNode.code}
                        </td>
                        <td
                          className="px-2 py-1.5 border-b border-gray-100"
                          style={{
                            paddingLeft: 8 + assetNode.depth * 14,
                            fontWeight: assetNode.isGroup ? 600 : 400,
                          }}
                        >
                          {assetNode.name}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-right border-b border-gray-100">
                          {assetNode.balance !== 0
                            ? fmt(assetNode.balance)
                            : ""}
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="border-b border-gray-100" />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Balance Sheet
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — As of {asOfDate}
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
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            As of Date
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        {/* Format toggle */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Format
          </label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(["vertical", "horizontal"] as BSFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`h-8 px-3 text-[11px] font-medium capitalize transition-colors ${
                  format === f
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f === "vertical" ? "Vertical (Schedule)" : "Horizontal (T-Format)"}
              </button>
            ))}
          </div>
        </div>

        {/* Comparative toggle */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Comparative
          </label>
          <label className="flex items-center gap-1.5 h-8 text-[12px] text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showComparative}
              onChange={(e) => setShowComparative(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#1557b0]"
            />
            Show Prior Period
          </label>
        </div>

        {showComparative && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Prior Date
            </label>
            <input
              type="date"
              value={priorDate}
              onChange={(e) => setPriorDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
        )}

        {/* Common-size % */}
        {format === "vertical" && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Common-Size
            </label>
            <label className="flex items-center gap-1.5 h-8 text-[12px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showPct}
                onChange={(e) => setShowPct(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1557b0]"
              />
              % of Total Assets
            </label>
          </div>
        )}

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

      {/* Balance check indicator */}
      <div
        className={`mb-4 px-4 py-2 rounded-md border text-[12px] font-semibold flex items-center gap-2 ${
          isBalanced
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}
      >
        {isBalanced
          ? "✓ Balance Sheet is BALANCED (Assets = Liabilities + Equity)"
          : `⚠ UNBALANCED — Difference: Rs. ${fmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))}`}
        <span className="ml-auto font-normal text-[11px] text-gray-500 flex gap-4">
          <span>Assets: Rs. {fmt(totalAssets)}</span>
          <span>Liabilities + Equity: Rs. {fmt(totalLiabilitiesAndEquity)}</span>
        </span>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Assets", value: totalAssets, color: "text-[#1557b0]" },
          { label: "Total Liabilities", value: totalLiabilities, color: "text-red-600" },
          { label: "Equity / Net Worth", value: totalEquity, color: "text-green-700" },
          {
            label: "Closing Stock",
            value: closingStockValue,
            color: "text-amber-700",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              {kpi.label}
            </p>
            <p className={`text-[15px] font-bold font-mono mt-1 ${kpi.color}`}>
              Rs. {fmt(kpi.value)}
            </p>
            {showComparative && kpi.label === "Total Assets" && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Prior: Rs. {fmt(priorTotalAssets)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Main report */}
      {format === "vertical" ? renderVertical() : renderHorizontal()}

      {/* Sources & Application note */}
      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-[12px] font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#1557b0]" />
          Sources &amp; Application of Funds (Summary)
        </h3>
        <div className="grid grid-cols-2 gap-4 text-[12px]">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Sources of Funds
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Equity Capital</span>
                <span className="font-mono font-semibold">
                  Rs. {fmt(totalEquity)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Liabilities</span>
                <span className="font-mono font-semibold">
                  Rs. {fmt(totalLiabilities)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
                <span>Total Sources</span>
                <span className="font-mono text-[#1557b0]">
                  Rs. {fmt(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Application of Funds
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Fixed / Non-Current Assets</span>
                <span className="font-mono font-semibold">
                  Rs.{" "}
                  {fmt(
                    assetRoots
                      .filter(
                        (a) =>
                          (a.name || "").toLowerCase().includes("fixed") ||
                          (a.name || "").toLowerCase().includes("non-current") ||
                          (a.name || "").toLowerCase().includes("property")
                      )
                      .reduce((s, a) => s + a.balance, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Assets + Stock</span>
                <span className="font-mono font-semibold">
                  Rs. {fmt(totalAssets)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
                <span>Total Application</span>
                <span className="font-mono text-[#1557b0]">
                  Rs. {fmt(totalAssets)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Balances computed from posted vouchers up to {asOfDate} • Opening
        balances included
      </p>
    </div>
  );
}
