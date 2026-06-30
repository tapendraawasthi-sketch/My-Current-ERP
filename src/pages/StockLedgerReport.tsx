// src/pages/StockLedgerReport.tsx
// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import type { DBItem, DBStockMovement, DBMaterialCentre } from "../lib/db";

const TYPE_LABELS: Record<string, string> = {
  purchase: "Purchase", sales: "Sales", sales_return: "Sales Return", purchase_return: "Purchase Return",
  stock_journal_in: "SJ-In", stock_journal_out: "SJ-Out",
  stock_transfer_in: "Transfer In", stock_transfer_out: "Transfer Out",
  production_in: "Production In", production_out: "Production Out",
  physical_stock_adjustment: "Physical Adj", opening: "Opening",
};

export default function StockLedgerReport() {
  const store = useStore();
  const items: DBItem[] = store.items || [];
  const movements: DBStockMovement[] = store.stockMovements || [];
  const mcs: DBMaterialCentre[] = store.materialCentres || [];

  const [itemId, setItemId] = useState("");
  const [mcId, setMcId] = useState("");
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { store.loadItems?.(); store.loadAllInventoryVouchers?.(); store.loadMaterialCentres?.(); }, []);

  const selectedItem = items.find((i) => i.id === itemId);

  const ledger = useMemo(() => {
    if (!itemId) return [];
    const filtered = movements
      .filter((m) => m.itemId === itemId && (!mcId || m.mcId === mcId) && m.date >= fromDate && m.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    let runningQty = 0;
    const beforePeriod = movements.filter((m) => m.itemId === itemId && (!mcId || m.mcId === mcId) && m.date < fromDate);
    runningQty = beforePeriod.reduce((s, m) => s + m.qtyIn - m.qtyOut, 0);
    const rows = [];
    if (runningQty !== 0 || true) rows.push({ isOpening: true, date: fromDate, narration: "Opening Balance", qtyIn: 0, qtyOut: 0, balance: runningQty, type: "opening" });
    for (const m of filtered) {
      runningQty += m.qtyIn - m.qtyOut;
      rows.push({ ...m, balance: runningQty, isOpening: false });
    }
    return rows;
  }, [itemId, mcId, fromDate, toDate, movements]);

  const totals = useMemo(() => ({
    qtyIn: ledger.filter((r: any) => !r.isOpening).reduce((s: number, r: any) => s + (r.qtyIn || 0), 0),
    qtyOut: ledger.filter((r: any) => !r.isOpening).reduce((s: number, r: any) => s + (r.qtyOut || 0), 0),
    closing: ledger.length > 0 ? ledger[ledger.length - 1].balance : 0,
  }), [ledger]);

  const handleExport = () => {
    if (!ledger.length) return;
    const rows = ledger.map((r: any) => ({
      Date: r.date,
      Type: TYPE_LABELS[r.type] || r.type,
      "Reference No": r.referenceNo || "",
      Party: r.partyName || "",
      Narration: r.narration || "",
      "Qty In": r.qtyIn || "",
      "Qty Out": r.qtyOut || "",
      Balance: r.balance,
      Rate: r.rate || "",
      Value: r.value || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Stock Ledger");
    XLSX.writeFile(wb, `StockLedger_${selectedItem?.name}_${fromDate}.xlsx`);
    toast.success("Exported");
  };

  const inp = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800">Stock Ledger</h1><p className="text-[11px] text-gray-500 mt-0.5">Item-wise transaction ledger with running balance</p></div>
        <button onClick={handleExport} disabled={!ledger.length} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Item *</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${inp} w-56`}>
            <option value="">— Select Item —</option>
            {items.filter((i) => i.isActive && i.maintainStock !== false).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        {store.inventoryConfig?.enableMultiGodown && (
          <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Godown</label>
            <select value={mcId} onChange={(e) => setMcId(e.target.value)} className={`${inp} w-40`}>
              <option value="">All</option>
              {mcs.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inp} /></div>
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inp} /></div>
      </div>

      {!itemId && <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-[13px] text-gray-400 shadow-sm">Select an item to view its stock ledger</div>}

      {itemId && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {selectedItem && (
            <div className="px-4 py-3 bg-[#eef2ff] border-b border-[#c7d2fe] flex items-center justify-between">
              <div>
                <span className="text-[13px] font-bold text-[#1557b0]">{selectedItem.name}</span>
                {selectedItem.alias && <span className="ml-2 text-[11px] text-gray-500">{selectedItem.alias}</span>}
                <span className="ml-3 text-[11px] text-gray-600">Unit: {selectedItem.mainUnit}</span>
              </div>
              <div className="flex gap-4 text-[12px]">
                <span>Total In: <strong className="text-green-600">{totals.qtyIn.toFixed(2)}</strong></span>
                <span>Total Out: <strong className="text-red-600">{totals.qtyOut.toFixed(2)}</strong></span>
                <span>Closing: <strong className="text-[#1557b0]">{totals.closing.toFixed(2)}</strong></span>
              </div>
            </div>
          )}
          <table className="w-full min-w-[800px]">
            <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Date", "Type", "Ref No", "Party", "Qty In", "Qty Out", "Balance", "Rate", "Godown"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ledger.map((r: any, idx: number) => (
                <tr key={idx} className={`border-b border-gray-100 ${r.isOpening ? "bg-blue-50/40 font-semibold" : "hover:bg-gray-50"}`}>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{r.date}</td>
                  <td className="px-3 py-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${r.type === "purchase" || r.type === "stock_journal_in" || r.type === "production_in" || r.type === "stock_transfer_in" ? "bg-green-50 text-green-700 border border-green-200" : r.isOpening ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {TYPE_LABELS[r.type] || r.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{r.referenceNo || "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{r.partyName || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-green-600 font-semibold">{r.qtyIn > 0 ? r.qtyIn.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-red-500 font-semibold">{r.qtyOut > 0 ? r.qtyOut.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-gray-800">{r.balance.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-500">{r.rate ? r.rate.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-500">{r.mcName || "—"}</td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-[12px] text-gray-400">No transactions found for selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
