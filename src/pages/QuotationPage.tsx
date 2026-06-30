// src/pages/QuotationPage.tsx
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, ArrowLeft, FileText } from "lucide-react";
import type { DBItem } from "../lib/db";

const uid = () => Math.random().toString(36).slice(2, 10);
interface Props { type: "sales_quotation" | "purchase_quotation"; }

export default function QuotationPage({ type }: Props) {
  const store = useStore();
  const items: DBItem[] = store.items || [];
  const parties = store.parties || [];
  const quotations = (store.quotationVouchers || []).filter((q: any) => q.type === type);

  const isSales = type === "sales_quotation";
  const [view, setView] = useState<"list" | "add">("list");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    validUntil: "", partyId: "", narration: "",
    lines: [{ id: uid(), itemId: "", itemName: "", qty: 1, unit: "PCS", rate: 0, taxableAmount: 0, totalAmount: 0 }],
  });

  useEffect(() => { store.loadAllInventoryVouchers?.(); }, []);

  const total = form.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0);

  const handleSave = async () => {
    if (!form.partyId) { toast.error("Select a party"); return; }
    const valid = form.lines.filter((l) => l.itemId && l.qty > 0);
    if (!valid.length) { toast.error("Add at least one line"); return; }
    try {
      const party = parties.find((p: any) => p.id === form.partyId);
      await store.saveQuotationVoucher?.({
        type, date: form.date, validUntil: form.validUntil || undefined,
        partyId: form.partyId, partyName: party?.name || "",
        lines: valid.map((l) => ({ ...l, taxableAmount: l.qty * l.rate, totalAmount: l.qty * l.rate })),
        totalAmount: valid.reduce((s, l) => s + l.qty * l.rate, 0),
        narration: form.narration, status: "open",
      });
      toast.success("Quotation saved");
      setView("list");
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const inp = "w-full h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  if (view === "add") {
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView("list")} className="p-2 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-[15px] font-semibold text-gray-800">New {isSales ? "Sales" : "Purchase"} Quotation</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Date</label><input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inp} /></div>
            <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Valid Until</label><input type="date" value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} className={inp} /></div>
            <div><label className="text-[11px] font-medium text-gray-600 block mb-1">{isSales ? "Customer" : "Supplier"} *</label>
              <select value={form.partyId} onChange={(e) => setForm((p) => ({ ...p, partyId: e.target.value }))} className={inp}>
                <option value="">— Select —</option>
                {parties.filter((p: any) => p.type === (isSales ? "customer" : "supplier") || p.type === "both").map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] font-medium text-gray-600 block mb-1">Narration</label><input value={form.narration} onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))} className={inp} /></div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-4">
          <table className="w-full min-w-[600px]">
            <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">{["Item", "Qty", "Unit", "Rate", "Amount", ""].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {form.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="px-2 py-1.5">
                    <select value={l.itemId} onChange={(e) => {
                      const item = items.find((i) => i.id === e.target.value);
                      setForm((p) => ({ ...p, lines: p.lines.map((x) => x.id === l.id ? { ...x, itemId: e.target.value, itemName: item?.name || "", unit: item?.mainUnit || "PCS", rate: isSales ? (item?.salePrice || 0) : (item?.purchasePrice || 0) } : x) }));
                    }} className={inp}>
                      <option value="">— Item —</option>
                      {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 w-24"><input type="number" value={l.qty || ""} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((x) => x.id === l.id ? { ...x, qty: Number(e.target.value) } : x) }))} className={inp} /></td>
                  <td className="px-2 py-1.5 w-16"><input value={l.unit} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((x) => x.id === l.id ? { ...x, unit: e.target.value } : x) }))} className={inp} /></td>
                  <td className="px-2 py-1.5 w-28"><input type="number" value={l.rate || ""} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((x) => x.id === l.id ? { ...x, rate: Number(e.target.value) } : x) }))} className={inp} step="0.01" /></td>
                  <td className="px-2 py-1.5 w-28 text-right font-mono text-[12px] text-gray-700">{(l.qty * l.rate).toFixed(2)}</td>
                  <td className="px-2 py-1.5 w-8"><button onClick={() => setForm((p) => ({ ...p, lines: p.lines.filter((x) => x.id !== l.id) }))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 flex items-center justify-between border-t border-gray-100">
            <button onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { id: uid(), itemId: "", itemName: "", qty: 1, unit: "PCS", rate: 0, taxableAmount: 0, totalAmount: 0 }] }))} className="h-7 px-3 text-[11px] bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Line</button>
            <span className="text-[13px] font-bold text-gray-800">Total: Rs. {total.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save Quotation</button>
          <button onClick={() => setView("list")} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2"><FileText className="h-4 w-4 text-[#1557b0]" />{isSales ? "Sales" : "Purchase"} Quotations</h1></div>
        <button onClick={() => setView("add")} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Quotation</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full min-w-[700px]">
          <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">{["Quotation No", "Date", "Valid Until", "Party", "Total", "Status"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody>
            {quotations.map((q: any) => (
              <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#1557b0]">{q.voucherNo}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{q.date}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{q.validUntil || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{q.partyName}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">Rs. {Number(q.totalAmount || 0).toFixed(2)}</td>
                <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${q.status === "open" ? "bg-green-50 text-green-700 border border-green-200" : q.status === "converted" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>{q.status}</span></td>
              </tr>
            ))}
            {quotations.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[12px] text-gray-400">No quotations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
