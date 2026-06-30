// src/pages/OrderVoucherPage.tsx
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, ArrowLeft, ShoppingCart, ClipboardList } from "lucide-react";
import type { DBItem } from "../lib/db";

const uid = () => Math.random().toString(36).slice(2, 10);

interface Props { type: "sales_order" | "purchase_order"; }

export default function OrderVoucherPage({ type }: Props) {
  const store = useStore();
  const items: DBItem[] = store.items || [];
  const parties = store.parties || [];
  const orders = (store.orderVouchers || []).filter((o: any) => o.type === type);

  const [view, setView] = useState<"list" | "add">("list");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    partyId: "", partyName: "", narration: "",
    lines: [{ id: uid(), itemId: "", itemName: "", qty: 1, unit: "PCS", rate: 0, pendingQty: 1, taxableAmount: 0, totalAmount: 0 }],
  });

  useEffect(() => { store.loadAllInventoryVouchers?.(); }, []);

  const isSales = type === "sales_order";
  const title = isSales ? "Sales Orders" : "Purchase Orders";
  const Icon = isSales ? ShoppingCart : ClipboardList;

  const updateLine = (id: string, updates: any) =>
    setForm((p) => ({
      ...p,
      lines: p.lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...updates };
        if (updates.itemId) {
          const item = items.find((i) => i.id === updates.itemId);
          if (item) { next.itemName = item.name; next.unit = item.mainUnit; next.rate = isSales ? item.salePrice : item.purchasePrice; }
        }
        next.totalAmount = Number(next.qty || 0) * Number(next.rate || 0);
        next.taxableAmount = next.totalAmount;
        next.pendingQty = next.qty;
        return next;
      }),
    }));

  const handleSave = async () => {
    if (!form.partyId) { toast.error(`Select a ${isSales ? "customer" : "supplier"}`); return; }
    const valid = form.lines.filter((l) => l.itemId && l.qty > 0);
    if (!valid.length) { toast.error("Add at least one item line"); return; }
    try {
      const party = parties.find((p: any) => p.id === form.partyId);
      await store.saveOrderVoucher?.({
        type,
        date: form.date,
        partyId: form.partyId,
        partyName: party?.name || form.partyName,
        narration: form.narration,
        lines: valid,
        totalAmount: valid.reduce((s, l) => s + l.totalAmount, 0),
        status: "pending",
      });
      toast.success(`${isSales ? "Sales" : "Purchase"} order saved`);
      setForm({ date: new Date().toISOString().split("T")[0], partyId: "", partyName: "", narration: "", lines: [{ id: uid(), itemId: "", itemName: "", qty: 1, unit: "PCS", rate: 0, pendingQty: 1, taxableAmount: 0, totalAmount: 0 }] });
      setView("list");
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const inp = "w-full h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";

  if (view === "add") {
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView("list")} className="p-2 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-[15px] font-semibold text-gray-800">New {isSales ? "Sales" : "Purchase"} Order</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">{isSales ? "Customer" : "Supplier"} *</label>
              <select value={form.partyId} onChange={(e) => setForm((p) => ({ ...p, partyId: e.target.value }))} className={inp}>
                <option value="">— Select —</option>
                {parties.filter((p: any) => p.type === (isSales ? "customer" : "supplier") || p.type === "both").map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Narration</label>
              <input value={form.narration} onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))} className={inp} placeholder="Notes" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-4">
          <table className="w-full min-w-[600px]">
            <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Item", "Qty", "Unit", "Rate", "Amount", ""].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {form.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="px-2 py-1.5">
                    <select value={l.itemId} onChange={(e) => updateLine(l.id, { itemId: e.target.value })} className={inp}>
                      <option value="">— Select Item —</option>
                      {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 w-24"><input type="number" value={l.qty || ""} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} className={inp} min={0} step="0.01" /></td>
                  <td className="px-2 py-1.5 w-16"><input value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })} className={inp} /></td>
                  <td className="px-2 py-1.5 w-28"><input type="number" value={l.rate || ""} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className={inp} step="0.01" /></td>
                  <td className="px-2 py-1.5 w-28 text-right font-mono text-[12px] text-gray-700">{(l.qty * l.rate).toFixed(2)}</td>
                  <td className="px-2 py-1.5 w-8"><button onClick={() => setForm((p) => ({ ...p, lines: p.lines.filter((x) => x.id !== l.id) }))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2"><button onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { id: uid(), itemId: "", itemName: "", qty: 1, unit: "PCS", rate: 0, pendingQty: 1, taxableAmount: 0, totalAmount: 0 }] }))} className="h-7 px-3 text-[11px] bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Line</button></div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save Order</button>
          <button onClick={() => setView("list")} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2"><Icon className="h-4 w-4 text-[#1557b0]" /> {title}</h1><p className="text-[11px] text-gray-500 mt-0.5">Pending: {orders.filter((o: any) => o.status === "pending").length} orders</p></div>
        <button onClick={() => setView("add")} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Order</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full min-w-[700px]">
          <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">{["Order No", "Date", "Party", "Items", "Total", "Status"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#1557b0]">{o.voucherNo}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{o.date}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">{o.partyName}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{o.lines?.length || 0}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">Rs. {Number(o.totalAmount || 0).toFixed(2)}</td>
                <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${o.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" : o.status === "fulfilled" ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>{o.status}</span></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[12px] text-gray-400">No {isSales ? "sales" : "purchase"} orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
