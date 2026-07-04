// src/pages/StockSummaryReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { Download, Package, AlertTriangle } from "lucide-react";
import {
  computeStockSummary,
  mapConfigMethodToValuation,
  movementsToStockRaw,
} from "../lib/stockValuation";

type ViewMode = "alphabetical" | "group_wise" | "critical_level";

interface StockRow {
  id: string;
  name: string;
  code: string;
  group: string;
  unit: string;
  qty: number;
  value: number;
  avgRate: number;
  reorderLevel: number;
  minStock: number;
  maxStock: number;
  isBelowReorder: boolean;
  isNearReorder: boolean;
  isBelowMin: boolean;
  isAboveMax: boolean;
}

export default function StockSummaryReport() {
  const { items, stockMovements, inventoryConfig } = useStore() as any;
  const [viewMode, setViewMode] = useState<ViewMode>("alphabetical");
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [showZeroBalance, setShowZeroBalance] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const valuationMethod = mapConfigMethodToValuation(inventoryConfig?.stockValuationMethod);

  const stockSummaries = useMemo(() => {
    const raw = movementsToStockRaw(stockMovements || []);
    return computeStockSummary(raw, valuationMethod, undefined, asOnDate);
  }, [stockMovements, valuationMethod, asOnDate]);

  const summaryByItemId = useMemo(() => {
    const map = new Map<string, (typeof stockSummaries)[number]>();
    stockSummaries.forEach((s) => map.set(s.itemId, s));
    return map;
  }, [stockSummaries]);

  const stockData: StockRow[] = useMemo(() => {
    return (items || [])
      .filter((i: any) => i.isActive !== false)
      .map((item: any) => {
        const summary = summaryByItemId.get(item.id);
        const qty = Math.max(0, summary?.closingQty ?? 0);
        const value = Math.max(0, summary?.closingAmount ?? 0);
        const avgRate = summary?.closingRate ?? (qty > 0 ? value / qty : 0);
        const reorderLevel = Number(item.reorderLevel || item.minStockLevel || 0);
        const minStock = Number(item.minStock || 0);
        const maxStock = Number(item.maxStock || 0);
        const isAtReorder =
          (reorderLevel > 0 || minStock > 0) && qty <= Math.max(reorderLevel, minStock);
        const isNearReorder = !isAtReorder && reorderLevel > 0 && qty <= reorderLevel * 1.2;
        return {
          id: item.id,
          name: item.name,
          code: item.code || "",
          group: item.groupName || item.group || "Ungrouped",
          unit: item.unit || "Pcs",
          qty,
          value,
          avgRate,
          reorderLevel,
          minStock,
          maxStock,
          isBelowReorder: isAtReorder,
          isNearReorder,
          isBelowMin: minStock > 0 && qty < minStock,
          isAboveMax: maxStock > 0 && qty > maxStock,
        };
      })
      .filter((s: StockRow) => showZeroBalance || s.qty > 0)
      .filter(
        (s: StockRow) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.code.toLowerCase().includes(searchTerm.toLowerCase()),
      );
  }, [items, summaryByItemId, showZeroBalance, searchTerm]);

  const criticalItems = useMemo(
    () => stockData.filter((s) => s.isBelowReorder || s.isBelowMin || s.isAboveMax),
    [stockData],
  );

  const totals = useMemo(
    () => ({
      totalItems: stockData.length,
      totalValue: stockData.reduce((s, i) => s + i.value, 0),
      zeroStockItems: stockData.filter((i) => i.qty === 0).length,
      criticalItems: criticalItems.length,
    }),
    [stockData, criticalItems],
  );

  const grouped: Record<string, StockRow[]> = useMemo(() => {
    if (viewMode !== "group_wise") return { "": stockData };
    return stockData.reduce(
      (acc, item) => {
        const g = item.group;
        if (!acc[g]) acc[g] = [];
        acc[g].push(item);
        return acc;
      },
      {} as Record<string, StockRow[]>,
    );
  }, [stockData, viewMode]);

  const displayData = viewMode === "critical_level" ? criticalItems : stockData;
  const sorted = [...displayData].sort((a, b) => a.name.localeCompare(b.name));

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Summary Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Closing stock — {valuationMethod.toUpperCase().replace("_", " ")} valuation
          </p>
        </div>
        <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md flex items-center gap-1.5 hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Items", value: totals.totalItems, color: "text-gray-800" },
          {
            label: "Stock Value",
            value: `Rs. ${formatNumber(totals.totalValue)}`,
            color: "text-[#1557b0]",
          },
          { label: "Zero Stock", value: totals.zeroStockItems, color: "text-amber-600" },
          { label: "Critical Items", value: totals.criticalItems, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
              {stat.label}
            </div>
            <div className={`text-[16px] font-bold ${stat.color} mt-1`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(
            [
              ["alphabetical", "Alphabetical"],
              ["group_wise", "Group-wise"],
              ["critical_level", "Critical Level"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${viewMode === key ? "bg-[#1557b0] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {label}
              {key === "critical_level" && totals.criticalItems > 0 && (
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${viewMode === key ? "bg-white/20" : "bg-red-100 text-red-700"}`}
                >
                  {totals.criticalItems}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500">As on:</span>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search items..."
          className={`${inputCls} w-44`}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showZeroBalance}
            onChange={(e) => setShowZeroBalance(e.target.checked)}
            className="rounded"
          />
          <span className="text-[12px] text-gray-700">Show Zero Balance</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {viewMode === "group_wise" ? (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, groupItems]) => (
              <div key={group}>
                <div className="px-4 py-2 bg-[#e8f0fe] border-b border-blue-200 font-semibold text-[12px] text-[#1557b0] flex justify-between">
                  <span>
                    {group} — {groupItems.length} items
                  </span>
                  <span className="font-mono">
                    Rs. {formatNumber(groupItems.reduce((s, i) => s + i.value, 0))}
                  </span>
                </div>
                <StockTable items={groupItems} />
              </div>
            ))
        ) : (
          <>
            {viewMode === "critical_level" && criticalItems.length === 0 && (
              <div className="py-12 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-[12px] text-gray-500">
                  No items at critical stock levels. All stock levels are normal.
                </p>
              </div>
            )}
            <StockTable items={sorted} />
          </>
        )}

        {/* Grand Total */}
        <div className="px-4 py-2.5 border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex justify-between text-[12px] font-bold text-gray-800">
          <span>
            TOTAL — {viewMode === "critical_level" ? criticalItems.length : sorted.length} items
          </span>
          <span className="font-mono">
            Rs.{" "}
            {formatNumber(
              (viewMode === "critical_level" ? criticalItems : sorted).reduce(
                (s, i) => s + i.value,
                0,
              ),
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function StockTable({ items }: { items: StockRow[] }) {
  return (
    <table
      className="report-table w-full"
      style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <colgroup>
        <col style={{ width: "10%" }} /> {/* Code */}
        <col style={{ width: "25%" }} /> {/* Name */}
        <col style={{ width: "15%" }} /> {/* Group */}
        <col style={{ width: "8%" }} /> {/* Unit */}
        <col style={{ width: "10%" }} /> {/* Qty */}
        <col style={{ width: "10%" }} /> {/* Avg Rate */}
        <col style={{ width: "12%" }} /> {/* Value */}
        <col style={{ width: "10%" }} /> {/* Status */}
      </colgroup>
      <thead>
        <tr className="bg-[#f5f6fa] border-b border-gray-200">
          {[
            "Code",
            "Item Name",
            "Group",
            "Unit",
            "Closing Qty",
            "Avg Rate",
            "Stock Value",
            "Status",
          ].map((h) => (
            <th
              key={h}
              className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
              style={{
                textAlign:
                  h.includes("Qty") || h.includes("Rate") || h.includes("Value") ? "right" : "left",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => {
          const isAtReorder = item.isBelowReorder;
          const isNearReorder = item.isNearReorder;

          return (
            <tr
              key={item.id}
              style={{
                borderBottom: "1px solid #f3f4f6",
                borderLeft: isAtReorder
                  ? "3px solid #dc2626"
                  : isNearReorder
                    ? "3px solid #d97706"
                    : "3px solid transparent",
                background: isAtReorder ? "#fef2f2" : "transparent",
              }}
              className="hover:bg-gray-50"
            >
              <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500">
                {item.code || "—"}
              </td>
              <td style={{ padding: "7px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {isAtReorder && (
                    <span
                      title="Stock at or below reorder level — replenishment required"
                      style={{ fontSize: 12, flexShrink: 0 }}
                    >
                      ⚠
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isAtReorder ? 700 : 400,
                      color: isAtReorder ? "#991b1b" : "#111827",
                    }}
                  >
                    {item.name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.group}</td>
              <td className="px-3 py-2.5 text-[12px] text-gray-500">{item.unit}</td>
              <td
                className={`px-3 py-2.5 text-[12px] font-mono text-right font-bold ${item.qty === 0 ? "text-gray-400" : "text-gray-800"}`}
              >
                {formatNumber(item.qty)}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-600">
                {item.avgRate > 0 ? formatNumber(item.avgRate) : "—"}
              </td>
              <td
                className="px-3 py-2.5 text-[12px] font-mono text-right font-bold"
                style={{ color: "#059669" }}
              >
                Rs. {formatNumber(item.value)}
              </td>
              <td className="px-3 py-2.5">
                {item.isBelowMin ? (
                  <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Below Min
                  </span>
                ) : item.isBelowReorder ? (
                  <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Reorder
                  </span>
                ) : item.isNearReorder ? (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Near Reorder
                  </span>
                ) : item.isAboveMax ? (
                  <span className="text-[10px] text-blue-600 font-semibold">Above Max</span>
                ) : (
                  <span className="text-[10px] text-green-600 font-semibold">Normal</span>
                )}
              </td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={8} className="py-8 text-center text-[12px] text-gray-500">
              No items to display
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
