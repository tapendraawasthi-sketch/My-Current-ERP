// src/pages/StockSummaryReport.tsx  (replaces the existing one)
// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

// Compute net stock for an item (optionally filtered by warehouse/material centre)
function computeItemStock(movements: any[], itemId: string, warehouseId?: string): number {
  return movements
    .filter((m) => m.itemId === itemId && (!warehouseId || m.warehouseId === warehouseId || m.materialCentreId === warehouseId))
    .reduce((sum, m) => sum + (Number(m.qty) || 0), 0);
}

export default function StockSummaryReport() {
  const store = useStore();
  const items = store.items || [];
  const movements = store.stockMovements || [];
  const mcs = store.materialCentres || [];
  const itemGroups = store.itemGroups || [];
  const inventoryConfig = store.inventoryConfig;

  const [mcFilter, setMcFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [showType, setShowType] = useState<"all" | "below_reorder" | "out_of_stock" | "above_max">("all");

  useEffect(() => { store.loadItems?.(); store.loadAllInventoryVouchers?.(); store.loadMaterialCentres?.(); }, []);

  const data = useMemo(() => {
    return items
      .filter((i) => i.isActive && i.maintainStock !== false)
      .filter((i) => !groupFilter || i.itemGroupId === groupFilter)
      .map((i) => {
        const stock = computeItemStock(movements, i.id, mcFilter || undefined);
        const group = itemGroups.find((g) => g.id === i.itemGroupId);
        const atMin = i.criticalLevelEnabled && i.minLevel !== undefined && stock <= i.minLevel;
        const atReorder = i.criticalLevelEnabled && i.reorderLevel !== undefined && stock <= i.reorderLevel;
        const aboveMax = i.criticalLevelEnabled && i.maxLevel !== undefined && stock > i.maxLevel;
        return { ...i, stock, groupName: group?.name || "", atMin, atReorder, aboveMax };
      })
      .filter((i) => {
        if (showType === "below_reorder") return i.atReorder;
        if (showType === "out_of_stock") return i.stock <= 0;
        if (showType === "above_max") return i.aboveMax;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, movements, mcFilter, groupFilter, showType, itemGroups]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map((i) => ({
      "Item Name": i.name, "Group": i.groupName, "Unit": i.mainUnit,
      "Stock Qty": i.stock.toFixed(2), "Sale Price": i.salePrice,
      "Min Level": i.minLevel || "", "Reorder Level": i.reorderLevel || "",
      "Max Level": i.maxLevel || "", "Alert": i.atMin ? "Below Min" : i.atReorder ? "Reorder" : i.aboveMax ? "Above Max" : "",
    }))), "Stock Summary");
    XLSX.writeFile(wb, `StockSummary_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported");
  };

  const inp = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800">Stock Summary</h1><p className="text-[11px] text-gray-500 mt-0.5">{data.length} items · Critical level monitoring</p></div>
        <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md flex items-center gap-1.5 hover:bg-gray-50"><Download className="h-3.5 w-3.5" /> Export</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
        {inventoryConfig?.enableMultiGodown && (
          <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Godown</label>
            <select value={mcFilter} onChange={(e) => setMcFilter(e.target.value)} className={inp}>
              <option value="">All Godowns</option>
              {mcs.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Item Group</label>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={inp}>
            <option value="">All Groups</option>
            {itemGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          {[
            { id: "all", label: "All" },
            { id: "below_reorder", label: "Below Reorder" },
            { id: "out_of_stock", label: "Out of Stock" },
            { id: "above_max", label: "Above Max" },
          ].map((opt) => (
            <button key={opt.id} onClick={() => setShowType(opt.id as any)} className={`h-7 px-2.5 text-[11px] font-medium rounded transition-colors ${showType === opt.id ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full min-w-[800px]">
          <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
            {["Item", "Group", "Unit", "Stock", "Min Level", "Reorder", "Max Level", "Sale Price", "Alert"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map((i) => (
              <tr key={i.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i.atMin ? "bg-red-50/30" : i.atReorder ? "bg-amber-50/30" : i.aboveMax ? "bg-blue-50/30" : ""}`}>
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{i.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{i.groupName}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{i.mainUnit}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold">
                  <span className={i.stock <= 0 ? "text-gray-400" : i.atMin ? "text-red-600" : i.atReorder ? "text-amber-600" : "text-gray-800"}>{i.stock.toFixed(2)}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-500">{i.minLevel ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-500">{i.reorderLevel ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-500">{i.maxLevel ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">Rs. {i.salePrice.toFixed(2)}</td>
                <td className="px-3 py-2.5">
                  {i.atMin && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">Below Min</span>}
                  {i.atReorder && !i.atMin && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Reorder</span>}
                  {i.aboveMax && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">Above Max</span>}
                  {i.stock <= 0 && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-50 text-gray-500 border border-gray-200">Out of Stock</span>}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-[12px] text-gray-400">No items matching criteria.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
