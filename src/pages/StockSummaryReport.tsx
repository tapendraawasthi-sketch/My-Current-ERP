// src/pages/StockSummaryReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { Download, Package, AlertTriangle } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";
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
  const hasDisplayRows =
    viewMode === "group_wise"
      ? stockData.length > 0
      : viewMode === "critical_level"
        ? criticalItems.length > 0
        : sorted.length > 0;

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
        <button className="flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50">
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
          <div key={stat.label} className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
              {stat.label}
            </div>
            <div className={`text-[16px] font-bold ${stat.color} mt-1`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
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
              className={`h-8 rounded-md px-3 text-[12px] font-medium transition-colors ${viewMode === key ? "bg-[#1557b0] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {label}
              {key === "critical_level" && totals.criticalItems > 0 && (
                <span
                  className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] ${viewMode === key ? "bg-white/20" : "bg-red-100 text-red-700"}`}
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
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {!hasDisplayRows ? (
          <ReportEmptyState
            icon={<Package className="mx-auto h-8 w-8 text-gray-300" />}
            message={
              viewMode === "critical_level"
                ? "No items at critical stock levels."
                : "No items to display"
            }
            hint={
              viewMode === "critical_level"
                ? "All active items are currently within the configured thresholds."
                : "Adjust the date, search term, or zero-balance filter."
            }
          />
        ) : viewMode === "group_wise" ? (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, groupItems]) => (
              <div key={group}>
                <div className="flex justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-[12px] font-semibold text-[#1557b0]">
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
          <StockTable items={sorted} />
        )}

        {/* Grand Total */}
        {hasDisplayRows && (
          <div className="flex justify-between border-t-2 border-[#c7d2fe] bg-[#eef2ff] px-4 py-2.5 text-[12px] font-bold text-gray-800">
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
        )}
      </div>
    </div>
  );
}

function StockTable({ items }: { items: StockRow[] }) {
  if (items.length === 0) {
    return (
      <ReportEmptyState
        icon={<Package className="mx-auto h-8 w-8 text-gray-300" />}
        message="No items to display"
        hint="Adjust the date, search term, or zero-balance filter."
      />
    );
  }

  return (
    <table className="report-table w-full table-fixed">
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
              className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 ${
                h.includes("Qty") || h.includes("Rate") || h.includes("Value")
                  ? "text-right"
                  : "text-left"
              } ${
                h === "Code"
                  ? "w-[10%]"
                  : h === "Item Name"
                    ? "w-[25%]"
                    : h === "Group"
                      ? "w-[15%]"
                      : h === "Unit"
                        ? "w-[8%]"
                        : h === "Closing Qty" || h === "Avg Rate"
                          ? "w-[10%]"
                          : h === "Stock Value"
                            ? "w-[12%]"
                            : "w-[10%]"
              }`}
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
              className={`group border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                isAtReorder
                  ? "border-l-[3px] border-l-red-600 bg-red-50/60"
                  : isNearReorder
                    ? "border-l-[3px] border-l-amber-600"
                    : "border-l-[3px] border-l-transparent"
              }`}
            >
              <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500">
                {item.code || "—"}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {isAtReorder && (
                    <span
                      title="Stock at or below reorder level — replenishment required"
                      className="shrink-0 text-[12px] text-red-600"
                    >
                      ⚠
                    </span>
                  )}
                  <span
                    className={`text-[12px] ${isAtReorder ? "font-semibold text-red-800" : "text-gray-800"}`}
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
              <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-green-700">
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
      </tbody>
    </table>
  );
}
