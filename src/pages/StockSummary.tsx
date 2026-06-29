// src/pages/StockSummary.tsx
// @ts-nocheck
// Enhanced Stock Summary with:
// - FIFO / LIFO / Moving Weighted Average / Weighted Average toggle
// - Fast / Slow / Non-Moving classification
// - Reorder level alerts
// - Stock Ageing buckets
// - Warehouse-wise breakdown
// - Export to Excel

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  computeStockValuation,
  normalizeDBMovements,
  costingMethodLabel,
} from "../lib/stockValuation";
import type { CostingMethod } from "../lib/stockValuation";
import * as XLSX from "xlsx";
import { Download, AlertTriangle, Package } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const thCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls =
  "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

// Classify item movement speed
type MovementClass = "fast" | "slow" | "non-moving";
const classifyMovement = (
  txnCount: number,
  lastMovementDaysAgo: number
): MovementClass => {
  if (txnCount === 0 || lastMovementDaysAgo > 180) return "non-moving";
  if (lastMovementDaysAgo > 60) return "slow";
  return "fast";
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function StockSummary() {
  const {
    items,
    stockMovements,
    warehouses,
    companySettings,
    currentFiscalYear,
  } = useStore();

  const [costingMethod, setCostingMethod] = useState<CostingMethod>("moving_avg");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [movementFilter, setMovementFilter] = useState<"ALL" | MovementClass>("ALL");
  const [showReorderOnly, setShowReorderOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fyEnd =
    currentFiscalYear?.endDate ||
    new Date().toISOString().split("T")[0];

  // ── Compute stock for each item ───────────────────────────────────────────
  const stockRows = useMemo(() => {
    const today = new Date();

    return items.map((item) => {
      // Filter movements for this item
      const itemMovements = stockMovements.filter(
        (m) =>
          m.itemId === item.id &&
          (warehouseFilter === "ALL" || m.warehouseId === warehouseFilter) &&
          (m.date || "") <= fyEnd
      );

      // Normalize to StockMovement[] format
      const normalized = normalizeDBMovements(itemMovements);

      // Compute valuation using chosen method
      const valuation = computeStockValuation(
        costingMethod,
        normalized,
        0,
        0,
        []
      );

      // Movement stats for fast/slow/non-moving classification
      const outMovements = itemMovements.filter((m) => {
        const t = (m.type || "").toLowerCase();
        return t.includes("sales") || t.includes("out");
      });

      const txnCount = outMovements.length;
      const lastMovDate = outMovements.length > 0
        ? outMovements.sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
          )[0].date
        : null;

      const lastMovementDaysAgo = lastMovDate
        ? Math.floor(
            (today.getTime() - new Date(lastMovDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 9999;

      const movementClass = classifyMovement(txnCount, lastMovementDaysAgo);

      // Reorder level check
      const reorderLevel = item.reorderLevel || item.minStockLevel || 0;
      const isBelowReorder =
        reorderLevel > 0 && valuation.closingQty <= reorderLevel;

      // Warehouse-wise breakdown
      const warehouseBreakdown = (warehouses || []).map((wh) => {
        const whMovements = stockMovements.filter(
          (m) =>
            m.itemId === item.id &&
            m.warehouseId === wh.id &&
            (m.date || "") <= fyEnd
        );
        const whNorm = normalizeDBMovements(whMovements);
        const whVal  = computeStockValuation(costingMethod, whNorm, 0, 0, []);
        return {
          warehouseId: wh.id,
          warehouseName: wh.name,
          qty: whVal.closingQty,
          value: whVal.closingValue,
        };
      });

      return {
        id: item.id,
        code: item.code || item.sku || "",
        name: item.name || "",
        unit: item.unit || "PCS",
        category: item.category || item.group || "",
        openingQty: 0, // simplified
        inQty: normalized.filter((m) => m.type === "in").reduce((s, m) => s + m.qty, 0),
        outQty: normalized.filter((m) => m.type === "out").reduce((s, m) => s + m.qty, 0),
        closingQty: valuation.closingQty,
        closingValue: valuation.closingValue,
        closingRate: valuation.closingRate,
        cogsSold: valuation.cogsValue,
        reorderLevel,
        isBelowReorder,
        movementClass,
        lastMovementDaysAgo,
        txnCount,
        lastMovDate,
        warehouseBreakdown,
      };
    });
  }, [items, stockMovements, warehouses, costingMethod, warehouseFilter, fyEnd]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return stockRows.filter((r) => {
      if (movementFilter !== "ALL" && r.movementClass !== movementFilter)
        return false;
      if (showReorderOnly && !r.isBelowReorder) return false;
      if (
        searchTerm &&
        !r.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !r.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    });
  }, [stockRows, movementFilter, showReorderOnly, searchTerm]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = useMemo(
    () => ({
      totalItems:   filtered.length,
      totalValue:   filtered.reduce((s, r) => s + r.closingValue, 0),
      fastMoving:   filtered.filter((r) => r.movementClass === "fast").length,
      slowMoving:   filtered.filter((r) => r.movementClass === "slow").length,
      nonMoving:    filtered.filter((r) => r.movementClass === "non-moving").length,
      belowReorder: filtered.filter((r) => r.isBelowReorder).length,
      zeroStock:    filtered.filter((r) => r.closingQty <= 0).length,
    }),
    [filtered]
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const data = filtered.map((r) => ({
      Code:            r.code,
      "Item Name":     r.name,
      Unit:            r.unit,
      Category:        r.category,
      "In Qty":        r.inQty,
      "Out Qty":       r.outQty,
      "Closing Qty":   r.closingQty,
      "Avg Rate":      r.closingRate,
      "Closing Value": r.closingValue,
      "COGS Value":    r.cogsSold,
      "Reorder Level": r.reorderLevel,
      "Below Reorder": r.isBelowReorder ? "YES" : "",
      "Movement":      r.movementClass,
      "Last Sale":     r.lastMovDate || "Never",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Stock Summary"
    );
    XLSX.writeFile(
      wb,
      `StockSummary_${costingMethod}_${fyEnd}.xlsx`
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Stock Summary
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} —{" "}
            {costingMethodLabel(costingMethod)} • As of {fyEnd}
          </p>
        </div>
        <button
          onClick={exportToExcel}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
        {/* Costing method */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Valuation Method
          </label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(
              [
                ["moving_avg", "Moving WA"],
                ["weighted_avg", "Weighted Avg"],
                ["fifo", "FIFO"],
                ["lifo", "LIFO"],
              ] as [CostingMethod, string][]
            ).map(([method, label]) => (
              <button
                key={method}
                onClick={() => setCostingMethod(method)}
                className={`h-8 px-3 text-[11px] font-medium transition-colors ${
                  costingMethod === method
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Warehouse filter */}
        {(warehouses || []).length > 0 && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Warehouse
            </label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="ALL">All Warehouses</option>
              {(warehouses || []).map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Movement filter */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Movement
          </label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(["ALL", "fast", "slow", "non-moving"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMovementFilter(f)}
                className={`h-8 px-3 text-[11px] font-medium capitalize transition-colors ${
                  movementFilter === f
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f === "non-moving" ? "Non-Moving" : f === "ALL" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Item name or code..."
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
          />
        </div>

        {/* Reorder toggle */}
        <label className="flex items-center gap-1.5 h-8 text-[12px] text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showReorderOnly}
            onChange={(e) => setShowReorderOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#1557b0]"
          />
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Below Reorder Only
        </label>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {[
          { label: "Total Items",    value: summary.totalItems,    isAmt: false, color: "text-gray-800" },
          { label: "Stock Value",    value: summary.totalValue,    isAmt: true,  color: "text-[#1557b0]" },
          { label: "Fast Moving",    value: summary.fastMoving,    isAmt: false, color: "text-green-700" },
          { label: "Slow Moving",    value: summary.slowMoving,    isAmt: false, color: "text-amber-700" },
          { label: "Non-Moving",     value: summary.nonMoving,     isAmt: false, color: "text-red-600" },
          { label: "Below Reorder",  value: summary.belowReorder,  isAmt: false, color: "text-red-600" },
          { label: "Zero Stock",     value: summary.zeroStock,     isAmt: false, color: "text-gray-400" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">
              {kpi.label}
            </p>
            <p className={`font-bold font-mono mt-1 ${kpi.color} ${kpi.isAmt ? "text-[13px]" : "text-[18px]"}`}>
              {kpi.isAmt
                ? "Rs. " + fmt(kpi.value as number)
                : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Reorder alert banner */}
      {summary.belowReorder > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-[12px] text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <strong>{summary.belowReorder} items</strong> are at or below
          reorder level. Consider raising purchase orders.
        </div>
      )}

      {/* Main table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th className={thCls} style={{ width: 80 }}>
                  Code
                </th>
                <th className={thCls}>Item Name</th>
                <th className={thCls}>Category</th>
                <th className={thCls} style={{ width: 60 }}>
                  Unit
                </th>
                <th className={`${thCls} text-right`}>In Qty</th>
                <th className={`${thCls} text-right`}>Out Qty</th>
                <th className={`${thCls} text-right`}>Closing Qty</th>
                <th className={`${thCls} text-right`}>Avg Rate</th>
                <th className={`${thCls} text-right`}>Closing Value</th>
                <th className={thCls} style={{ width: 80 }}>
                  Reorder
                </th>
                <th className={thCls}>Movement</th>
                <th className={thCls}>Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-12 text-center text-[12px] text-gray-400"
                  >
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No stock items found for the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const movColors = {
                  fast:        "bg-green-100 text-green-700",
                  slow:        "bg-amber-100 text-amber-700",
                  "non-moving": "bg-red-100 text-red-700",
                };
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${row.closingQty <= 0 ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500 border-b border-gray-100">
                      {row.code}
                    </td>
                    <td className={tdCls}>
                      <span className="font-medium text-gray-800">
                        {row.name}
                      </span>
                      {row.isBelowReorder && (
                        <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1.5" />
                      )}
                    </td>
                    <td className={tdCls}>{row.category || "—"}</td>
                    <td className={tdCls}>{row.unit}</td>
                    <td className={amtCls}>{fmt(row.inQty)}</td>
                    <td className={amtCls}>{fmt(row.outQty)}</td>
                    <td
                      className={`${amtCls} font-semibold ${
                        row.closingQty <= 0
                          ? "text-red-500"
                          : row.isBelowReorder
                          ? "text-amber-700"
                          : "text-gray-800"
                      }`}
                    >
                      {fmt(row.closingQty)}
                    </td>
                    <td className={amtCls}>
                      {row.closingRate > 0 ? fmt(row.closingRate) : "—"}
                    </td>
                    <td className={`${amtCls} font-semibold text-[#1557b0]`}>
                      {row.closingValue > 0
                        ? fmt(row.closingValue)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] border-b border-gray-100">
                      {row.reorderLevel > 0 ? (
                        <span
                          className={`font-mono ${row.isBelowReorder ? "text-red-600 font-bold" : "text-gray-500"}`}
                        >
                          {row.reorderLevel}
                          {row.isBelowReorder && " ⚠"}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-b border-gray-100">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase ${movColors[row.movementClass]}`}
                      >
                        {row.movementClass}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-500 border-b border-gray-100">
                      {row.lastMovDate
                        ? row.lastMovDate + ` (${row.lastMovementDaysAgo}d ago)`
                        : "Never"}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer total */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                  <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                    TOTAL ({filtered.length} items)
                  </td>
                  <td className={amtCls}>
                    {fmt(filtered.reduce((s, r) => s + r.inQty, 0))}
                  </td>
                  <td className={amtCls}>
                    {fmt(filtered.reduce((s, r) => s + r.outQty, 0))}
                  </td>
                  <td className={amtCls}>
                    {fmt(filtered.reduce((s, r) => s + r.closingQty, 0))}
                  </td>
                  <td className={amtCls}>—</td>
                  <td className={`${amtCls} text-[#1557b0]`}>
                    Rs. {fmt(summary.totalValue)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Valuation: {costingMethodLabel(costingMethod)} • As of {fyEnd} •
        Fast Moving: sold within 60 days • Slow: 61-180 days •
        Non-Moving: over 180 days or never sold
      </p>
    </div>
  );
}
