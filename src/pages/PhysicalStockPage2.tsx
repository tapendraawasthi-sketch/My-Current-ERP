// src/pages/PhysicalStockPage2.tsx
// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Save, RefreshCw } from "lucide-react";
import type { DBItem, DBMaterialCentre } from "../lib/db";
import { computeItemStock } from "../lib/db";

export default function PhysicalStockPage2() {
  const store = useStore();
  const items: DBItem[] = store.items || [];
  const mcs: DBMaterialCentre[] = store.materialCentres || [];
  const movements = store.stockMovements || [];
  const physicalVouchers = store.physicalStockVouchers || [];

  const [mcId, setMcId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<any[]>([]);
  const [narration, setNarration] = useState("");
  const [createAdj, setCreateAdj] = useState(true);

  useEffect(() => { store.loadAllInventoryVouchers?.(); store.loadItems?.(); store.loadMaterialCentres?.(); }, []);

  const loadRows = () => {
    const active = items.filter((i) => i.isActive && i.maintainStock !== false);
    setRows(active.map((i) => {
      const sysQty = computeItemStock(movements, i.id, mcId || undefined);
      return { itemId: i.id, itemName: i.name, unit: i.mainUnit, systemQty: sysQty, physicalQty: sysQty, difference: 0, rate: i.purchasePrice || 0, mcId: mcId || undefined };
    }));
  };

  const updatePhysical = (itemId: string, val: number) => {
    setRows((p) => p.map((r) => r.itemId === itemId ? { ...r, physicalQty: val, difference: val - r.systemQty } : r));
  };

  const diffRows = useMemo(() => rows.filter((r) => r.difference !== 0), [rows]);

  const handleSave = async () => {
    if (!rows.length) { toast.error("Load items first"); return; }
    try {
      const mc = mcs.find((m) => m.id === mcId);
      await store.savePhysicalStockVoucher?.({
        date, mcId: mcId || undefined, mcName: mc?.name,
        createAdjustmentVoucher: createAdj,
        lines: rows,
        narration,
        status: "posted",
      });
      toast.success(`Physical stock voucher posted — ${diffRows.length} adjustments`);
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const inp = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800">Physical Stock Voucher</h1><p className="text-[11px] text-gray-500 mt-0.5">Conduct physical count and reconcile system stock</p></div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inp} w-full`} /></div>
          <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Material Centre</label>
            <select value={mcId} onChange={(e) => setMcId(e.target.value)} className={`${inp} w-full`}>
              <option value="">All Godowns</option>
              {mcs.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Narration</label><input value={narration} onChange={(e) => setNarration(e.target.value)} className={`${inp} w-full`} placeholder="Physical count reason" /></div>
          <div className="flex items-end gap-2">
            <button onClick={loadRows} className="h-8 px-4 bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Load Items</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input type="checkbox" checked={createAdj} onChange={(e) => setCreateAdj(e.target.checked)} className="accent-[#1557b0]" id="createAdj" />
          <label htmlFor="createAdj" className="text-[12px] text-gray-700 cursor-pointer">Auto-create Stock Journal for differences</label>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-4">
            <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-gray-700">{rows.length} items loaded · {diffRows.length} differences</span>
              {diffRows.length > 0 && <span className="text-[11px] text-amber-600 font-medium">{diffRows.length} items need adjustment</span>}
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full min-w-[700px]">
                <thead className="sticky top-0 bg-[#f5f6fa] border-b border-gray-200">
                  <tr>{["Item Name", "Unit", "System Qty", "Physical Qty", "Difference"].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemId} className={`border-b border-gray-100 ${r.difference !== 0 ? "bg-amber-50/30" : "hover:bg-gray-50"}`}>
                      <td className="px-3 py-2 text-[12px] font-medium text-gray-800">{r.itemName}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-600">{r.unit}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-700">{r.systemQty.toFixed(2)}</td>
                      <td className="px-3 py-2 w-36">
                        <input type="number" value={r.physicalQty} onChange={(e) => updatePhysical(r.itemId, Number(e.target.value))}
                          className="w-full h-7 px-2 text-[12px] text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0] font-mono" step="0.01" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">
                        <span className={r.difference > 0 ? "text-green-600" : r.difference < 0 ? "text-red-600" : "text-gray-400"}>
                          {r.difference > 0 ? "+" : ""}{r.difference.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Post Physical Stock</button>
          </div>
        </>
      )}

      {physicalVouchers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mt-6">
          <div className="px-3 py-2 border-b border-gray-200 text-[12px] font-semibold text-gray-700 bg-[#f5f6fa]">Past Physical Stock Vouchers</div>
          <table className="w-full">
            <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">{["Voucher No", "Date", "Godown", "Items", "Status"].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {physicalVouchers.slice(0, 20).map((v: any) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#1557b0]">{v.voucherNo}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{v.date}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-600">{v.mcName || "All"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-600">{v.lines?.length || 0}</td>
                  <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">{v.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
