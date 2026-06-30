// src/pages/SalesAnalysisReport.tsx
// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Download, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

type GroupBy = "item" | "party" | "month" | "group";

export default function SalesAnalysisReport() {
  const store = useStore();
  const invoices = store.invoices || [];
  const items = store.items || [];
  const parties = store.parties || [];
  const itemGroups = store.itemGroups || [];

  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setMonth(0); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [groupBy, setGroupBy] = useState<GroupBy>("item");
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [reportType, setReportType] = useState<"sales" | "purchase">("sales");

  useEffect(() => { store.loadItems?.(); store.loadItemGroups?.(); }, []);

  const salesInvoices = useMemo(() =>
    invoices.filter((inv: any) =>
      (reportType === "sales" ? ["sales-invoice", "sales"].includes(inv.type) : ["purchase-invoice", "purchase"].includes(inv.type)) &&
      inv.status === "posted" && inv.date >= fromDate && inv.date <= toDate &&
      (!partyFilter || inv.partyId === partyFilter)
    ),
  [invoices, reportType, fromDate, toDate, partyFilter]);

  const analysisData = useMemo(() => {
    const map: Record<string, { label: string; qty: number; amount: number; taxable: number; vat: number; invoices: number }> = {};
    for (const inv of salesInvoices) {
      for (const line of (inv.lines || [])) {
        if (itemFilter && line.itemId !== itemFilter) continue;
        let key = "";
        let label = "";
        if (groupBy === "item") { key = line.itemId || "unknown"; label = line.itemName || "Unknown"; }
        else if (groupBy === "party") { key = inv.partyId; label = inv.partyName; }
        else if (groupBy === "month") { key = inv.date.slice(0, 7); label = inv.date.slice(0, 7); }
        else if (groupBy === "group") {
          const item = items.find((i) => i.id === line.itemId);
          const group = itemGroups.find((g) => g.id === item?.itemGroupId);
          key = group?.id || "other"; label = group?.name || "Other";
        }
        if (!map[key]) map[key] = { label, qty: 0, amount: 0, taxable: 0, vat: 0, invoices: 0 };
        map[key].qty += Number(line.qty || 0);
        map[key].amount += Number(line.totalAmount || line.netAmount || 0);
        map[key].taxable += Number(line.taxableAmount || 0);
        map[key].vat += Number(line.vatAmount || 0);
      }
      if (groupBy === "party") {
        const k = inv.partyId;
        if (!map[k]) map[k] = { label: inv.partyName, qty: 0, amount: 0, taxable: 0, vat: 0, invoices: 0 };
        map[k].invoices++;
      } else if (groupBy === "month") {
        const k = inv.date.slice(0, 7);
        if (!map[k]) map[k] = { label: k, qty: 0, amount: 0, taxable: 0, vat: 0, invoices: 0 };
        map[k].invoices++;
      }
    }
    return Object.entries(map).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.amount - a.amount);
  }, [salesInvoices, groupBy, itemFilter, items, itemGroups]);

  const totals = useMemo(() => ({
    qty: analysisData.reduce((s, r) => s + r.qty, 0),
    amount: analysisData.reduce((s, r) => s + r.amount, 0),
    vat: analysisData.reduce((s, r) => s + r.vat, 0),
  }), [analysisData]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analysisData.map((r) => ({ Label: r.label, Quantity: r.qty.toFixed(2), Amount: r.amount.toFixed(2), "VAT Amount": r.vat.toFixed(2) }))), "Analysis");
    XLSX.writeFile(wb, `SalesAnalysis_${groupBy}_${fromDate}.xlsx`);
    toast.success("Exported");
  };

  const inp = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#1557b0]" />Sales Analysis</h1><p className="text-[11px] text-gray-500 mt-0.5">Item-wise, party-wise, month-wise sales breakdown</p></div>
        <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md flex items-center gap-1.5 hover:bg-gray-50"><Download className="h-3.5 w-3.5" /> Export</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="flex gap-1">
          {(["sales", "purchase"] as const).map((t) => (
            <button key={t} onClick={() => setReportType(t)} className={`h-8 px-3 text-[12px] font-medium rounded capitalize ${reportType === t ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{t}</button>
          ))}
        </div>
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Group By</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={inp}>
            <option value="item">Item-wise</option>
            <option value="party">Party-wise</option>
            <option value="month">Month-wise</option>
            <option value="group">Group-wise</option>
          </select>
        </div>
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inp} /></div>
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inp} /></div>
        <div><label className="text-[10px] font-medium text-gray-500 block mb-0.5">Party</label>
          <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)} className={`${inp} w-40`}>
            <option value="">All Parties</option>
            {parties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{groupBy === "item" ? "Item" : groupBy === "party" ? "Party" : groupBy === "month" ? "Month" : "Group"}</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Net Amount</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">VAT Amount</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
          </tr></thead>
          <tbody>
            {analysisData.map((r) => (
              <tr key={r.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{r.label}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">{r.qty.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">Rs. {r.amount.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-600">Rs. {r.vat.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right text-[12px] text-gray-500">{totals.amount > 0 ? ((r.amount / totals.amount) * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
            {analysisData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-[12px] text-gray-400">No data for selected filters.</td></tr>}
          </tbody>
          {analysisData.length > 0 && (
            <tfoot><tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
              <td className="px-3 py-2.5 text-[12px] text-gray-800">Total ({analysisData.length} rows)</td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">{totals.qty.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">Rs. {totals.amount.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">Rs. {totals.vat.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right text-[12px] text-gray-500">100%</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
