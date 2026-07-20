// src/pages/StockSummaryReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatCurrency, formatNumber } from "../lib/utils";
import { Package, AlertTriangle } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";
import {
  computeStockSummary,
  mapConfigMethodToValuation,
  movementsToStockRaw,
} from "../lib/stockValuation";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { ReportWorkspace } from "@/features/reports";

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
  const { branchFilter, setBranchFilter, branchOptions, matchMovement } = useBranchFilter();
  const [viewMode, setViewMode] = useState<ViewMode>("alphabetical");
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [showZeroBalance, setShowZeroBalance] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const valuationMethod = mapConfigMethodToValuation(inventoryConfig?.stockValuationMethod);

  const scopedMovements = useMemo(
    () => (stockMovements || []).filter((m: any) => matchMovement(m)),
    [stockMovements, matchMovement, branchFilter],
  );

  const stockSummaries = useMemo(() => {
    const raw = movementsToStockRaw(scopedMovements);
    return computeStockSummary(raw, valuationMethod, undefined, asOnDate);
  }, [scopedMovements, valuationMethod, asOnDate]);

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
    "h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";

  const exportCsv = () => {
    const rows = (viewMode === "critical_level" ? criticalItems : sorted).map((r) =>
      [r.code, r.name, r.group, r.unit, r.qty, r.avgRate, r.value]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(
      [["Code,Item,Group,Unit,Qty,Avg Rate,Value", ...rows].join("\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ReportWorkspace
      title="Stock summary"
      description={`Quantities and values — ${valuationMethod.toUpperCase().replace("_", " ")} valuation`}
      periodLabel={`As on ${asOnDate}`}
      onExportCsv={exportCsv}
      kpiSlot={
        <>
          {[
            { label: "Total Items", value: String(totals.totalItems), color: "text-gray-700" },
            {
              label: "Stock Value",
              value: formatCurrency(totals.totalValue),
              color: "text-[var(--ds-action-primary)]",
            },
            { label: "Zero Stock", value: String(totals.zeroStockItems), color: "text-amber-600" },
            { label: "Critical Items", value: String(totals.criticalItems), color: "text-red-600" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3"
            >
              <div className="text-[11px] text-[var(--ds-text-muted)] font-semibold uppercase tracking-wide">
                {stat.label}
              </div>
              <div className={`text-[16px] font-bold ${stat.color} mt-1`}>{stat.value}</div>
            </div>
          ))}
        </>
      }
      filterSlot={
        <div className="flex flex-wrap items-end gap-3">
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
                type="button"
                onClick={() => setViewMode(key)}
                className={`h-8 rounded-md px-3 text-[12px] font-medium transition-colors ${viewMode === key ? "bg-[var(--ds-action-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {label}
                {key === "critical_level" && totals.criticalItems > 0 && (
                  <span
                    className={`ml-1.5 rounded px-1.5 py-0.5 text-[12px] ${viewMode === key ? "bg-white/20" : "bg-red-100 text-red-700"}`}
                  >
                    {totals.criticalItems}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-gray-500">As on:</span>
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              aria-label="Branch"
              className={inputCls}
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
            className={`${inputCls} w-44`}
          />
          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={showZeroBalance}
              onChange={(e) => setShowZeroBalance(e.target.checked)}
              className="rounded"
            />
            <span className="text-[12px] text-gray-700">Show Zero Balance</span>
          </label>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
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
                <div className="flex justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-[12px] font-semibold text-[var(--ds-action-primary)]">
                  <span>
                    {group} — {groupItems.length} items
                  </span>
                  <span className="font-mono">
                    {formatCurrency(groupItems.reduce((s, i) => s + i.value, 0))}
                  </span>
                </div>
                <StockTable items={groupItems} />
              </div>
            ))
        ) : (
          <StockTable items={sorted} />
        )}

        {hasDisplayRows && (
          <div className="flex justify-between border-t-2 border-[var(--ds-border-strong)] bg-[var(--ds-surface-selected)] px-4 py-2.5 text-[12px] font-bold text-gray-700">
            <span>
              TOTAL — {viewMode === "critical_level" ? criticalItems.length : sorted.length} items
            </span>
            <span className="font-mono">
              {formatCurrency(
                (viewMode === "critical_level" ? criticalItems : sorted).reduce(
                  (s, i) => s + i.value,
                  0,
                ),
              )}
            </span>
          </div>
        )}
      </div>
    </ReportWorkspace>
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
        <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
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
              className={`px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-500 ${
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
              <td className="px-3 py-2.5 text-[12px] font-mono text-gray-500">
                {item.code || "—"}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {isAtReorder && (
                    <span
                      title="Stock at or below reorder level — replenishment required"
                      className="shrink-0 text-[12px] text-red-600"
                    >
                      
                    </span>
                  )}
                  <span
                    className={`text-[12px] ${isAtReorder ? "font-semibold text-red-800" : "text-gray-700"}`}
                  >
                    {item.name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-[12px] text-gray-500">{item.group}</td>
              <td className="px-3 py-2.5 text-[12px] text-gray-500">{item.unit}</td>
              <td
                className={`px-3 py-2.5 text-[12px] font-mono text-right font-bold ${item.qty === 0 ? "text-gray-400" : "text-gray-700"}`}
              >
                {formatNumber(item.qty)}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-600">
                {item.avgRate > 0 ? formatNumber(item.avgRate) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-green-700">
                {formatCurrency(item.value)}
              </td>
              <td className="px-3 py-2.5">
                {item.isBelowMin ? (
                  <span className="flex items-center gap-1 text-[12px] text-red-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Below Min
                  </span>
                ) : item.isBelowReorder ? (
                  <span className="flex items-center gap-1 text-[12px] text-red-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Reorder
                  </span>
                ) : item.isNearReorder ? (
                  <span className="flex items-center gap-1 text-[12px] text-amber-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Near Reorder
                  </span>
                ) : item.isAboveMax ? (
                  <span className="text-[12px] text-blue-600 font-semibold">Above Max</span>
                ) : (
                  <span className="text-[12px] text-green-600 font-semibold">Normal</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
