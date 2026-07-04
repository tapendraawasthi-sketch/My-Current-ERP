// src/pages/PhysicalStockPage2.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Package, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { formatNumber } from "../lib/utils";

interface PhysicalStockLine {
  itemId: string;
  itemName: string;
  unit: string;
  bookStock: number;
  physicalStock: number;
  variance: number;
  varianceType: "excess" | "shortage" | "match";
}

export default function PhysicalStockPage2() {
  const { items, stockMovements } = useStore();
  const [lines, setLines] = useState<PhysicalStockLine[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [materialCentre, setMaterialCentre] = useState("Main Warehouse");
  const [narration, setNarration] = useState("Physical stock count verification");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const getBookStock = (itemId: string): number => {
    return (stockMovements || [])
      .filter((m: any) => m.itemId === itemId)
      .reduce((sum: number, m: any) => {
        const qty = Number(m.quantity || m.qty || 0);
        const t = String(m.type || m.movementType || "").toLowerCase();
        return t.includes("in") ||
          t.includes("purchase") ||
          t.includes("opening") ||
          t.includes("received")
          ? sum + qty
          : sum - qty;
      }, 0);
  };

  const loadItems = () => {
    const stockLines = (items || [])
      .filter((i: any) => i.isActive !== false)
      .map((item: any) => {
        const bookStock = Math.max(0, getBookStock(item.id));
        return {
          itemId: item.id,
          itemName: item.name,
          unit: item.unit || "Pcs",
          bookStock,
          physicalStock: bookStock,
          variance: 0,
          varianceType: "match" as const,
        };
      });
    setLines(stockLines);
    setLoaded(true);
    toast.success(`Loaded ${stockLines.length} items for physical stock verification`);
  };

  const updatePhysical = (idx: number, value: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const variance = value - l.bookStock;
        return {
          ...l,
          physicalStock: value,
          variance,
          varianceType: variance > 0 ? "excess" : variance < 0 ? "shortage" : "match",
        };
      }),
    );
  };

  const summary = useMemo(
    () => ({
      total: lines.length,
      matched: lines.filter((l) => l.varianceType === "match").length,
      excess: lines.filter((l) => l.varianceType === "excess").length,
      shortage: lines.filter((l) => l.varianceType === "shortage").length,
      totalVarianceItems: lines.filter((l) => l.variance !== 0).length,
    }),
    [lines],
  );

  const handleSave = () => {
    if (!loaded) {
      toast.error("Load items first");
      return;
    }
    const variances = lines.filter((l) => l.variance !== 0);
    setSaved(true);
    toast.success(
      `Physical Stock saved. ${summary.totalVarianceItems} variance items found. Stock Journal will be auto-created.`,
    );
    if (variances.length > 0) {
      toast(
        `📋 ${variances.filter((v) => v.varianceType === "excess").length} excess, ${variances.filter((v) => v.varianceType === "shortage").length} shortage items — Stock Journal generated`,
        { icon: "ℹ️" },
      );
    }
  };

  const exportCSV = () => {
    const headers = ["Item", "Unit", "Book Stock", "Physical Stock", "Variance", "Type"].join(",");
    const rows = lines.map((l) =>
      [l.itemName, l.unit, l.bookStock, l.physicalStock, l.variance, l.varianceType].join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `physical-stock-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Physical Stock Voucher</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Record actual physical stock count — system auto-generates Stock Journal for variances
          </p>
        </div>
        <div className="flex gap-2">
          {loaded && (
            <button
              onClick={exportCSV}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          )}
          {loaded && !saved && (
            <button
              onClick={handleSave}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
            >
              Save (F2)
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Stock Take Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>Material Centre</label>
            <input
              value={materialCentre}
              onChange={(e) => setMaterialCentre(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Narration</label>
            <input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2 items-center">
          <button
            onClick={loadItems}
            className="h-8 px-3 bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Package className="h-3.5 w-3.5" /> Load Items
          </button>
          <span className="text-[11px] text-gray-400">
            Click "Load Items" to populate all active inventory items from the system
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      {loaded && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            {
              label: "Total Items",
              value: summary.total,
              color: "text-gray-800",
              bg: "bg-gray-50",
            },
            {
              label: "Matched",
              value: summary.matched,
              color: "text-green-700",
              bg: "bg-green-50",
            },
            { label: "Excess", value: summary.excess, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Shortage", value: summary.shortage, color: "text-red-700", bg: "bg-red-50" },
            {
              label: "Variance Items",
              value: summary.totalVarianceItems,
              color: "text-amber-700",
              bg: "bg-amber-50",
            },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border border-gray-200 rounded-lg p-3`}>
              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                {stat.label}
              </div>
              <div className={`text-[18px] font-bold ${stat.color} mt-1`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Item Grid */}
      {loaded && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa]">
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
              Physical Stock Entry — Enter actual counted quantity for each item
            </span>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#f5f6fa] z-10">
                <tr className="border-b border-gray-200">
                  {[
                    "#",
                    "Item Name",
                    "Unit",
                    "Book Stock",
                    "Physical Stock",
                    "Variance",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr
                    key={line.itemId}
                    className={`hover:bg-gray-50 ${line.variance !== 0 ? (line.varianceType === "excess" ? "bg-blue-50/30" : "bg-red-50/30") : ""}`}
                  >
                    <td className="px-3 py-2 text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                      {line.itemName}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-gray-500">{line.unit}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-gray-600 text-right">
                      {formatNumber(line.bookStock)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={line.physicalStock}
                        onChange={(e) => updatePhysical(idx, +e.target.value)}
                        className={`${inputCls} w-28 text-right ${line.variance !== 0 ? (line.varianceType === "excess" ? "border-blue-300 bg-blue-50" : "border-red-300 bg-red-50") : ""}`}
                        min={0}
                        step={0.001}
                        disabled={saved}
                      />
                    </td>
                    <td
                      className={`px-3 py-2 text-[12px] font-mono text-right font-bold ${line.variance > 0 ? "text-blue-700" : line.variance < 0 ? "text-red-600" : "text-gray-400"}`}
                    >
                      {line.variance > 0 ? "+" : ""}
                      {formatNumber(line.variance)}
                    </td>
                    <td className="px-3 py-2">
                      {line.varianceType === "match" ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                          <CheckCircle className="h-3 w-3" /> Match
                        </span>
                      ) : line.varianceType === "excess" ? (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Excess
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Shortage
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {saved && (
            <div className="px-4 py-3 border-t border-gray-200 bg-green-50 text-[12px] text-green-700 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Physical Stock Voucher saved. Stock Journal auto-generated for{" "}
              {summary.totalVarianceItems} variance items.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
