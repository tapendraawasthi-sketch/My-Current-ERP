// src/pages/SchemeMaster.tsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";

interface Scheme {
  id: string;
  name: string;
  type: "discount_percent" | "discount_amount" | "qty_bonus" | "flat_rate";
  discountPercent?: number;
  discountAmount?: number;
  minQty?: number;
  bonusQty?: number;
  applicableFrom: string;
  applicableTo: string;
  applicableItems: "all" | "specific";
  applicableParties: "all" | "specific";
  isActive: boolean;
}

const DEFAULTS: Omit<Scheme, "id">[] = [
  { name: "10% Seasonal Discount", type: "discount_percent", discountPercent: 10, applicableFrom: "2024-01-01", applicableTo: "2024-03-31", applicableItems: "all", applicableParties: "all", isActive: true },
  { name: "Buy 10 Get 1 Free", type: "qty_bonus", minQty: 10, bonusQty: 1, applicableFrom: "2024-01-01", applicableTo: "2024-12-31", applicableItems: "specific", applicableParties: "all", isActive: true },
];

export default function SchemeMaster() {
  const [schemes, setSchemes] = useState<Scheme[]>(DEFAULTS.map((d, i) => ({ ...d, id: `sch-${i}` })));
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Scheme | null>(null);
  const [form, setForm] = useState<Omit<Scheme, "id">>({
    name: "", type: "discount_percent", discountPercent: 0,
    applicableFrom: new Date().toISOString().split("T")[0],
    applicableTo: new Date().toISOString().split("T")[0],
    applicableItems: "all", applicableParties: "all", isActive: true
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({
      name: "", type: "discount_percent", discountPercent: 0,
      applicableFrom: new Date().toISOString().split("T")[0],
      applicableTo: new Date().toISOString().split("T")[0],
      applicableItems: "all", applicableParties: "all", isActive: true
    });
    setShowModal(true);
  };

  const openEdit = (item: Scheme) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (editItem) {
      setSchemes(prev => prev.map(s => s.id === editItem.id ? { ...editItem, ...form } : s));
      toast.success("Scheme updated");
    } else {
      setSchemes(prev => [...prev, { ...form, id: `sch-${Date.now()}` }]);
      toast.success("Scheme added");
    }
    setShowModal(false);
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Scheme / Offer Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Configure promotional schemes, discounts, and offers for items and parties</p>
        </div>
        <button onClick={openAdd} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Scheme
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Scheme Name", "Type", "Value", "Period", "Items", "Parties", "Status", "Actions"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schemes.map(scheme => (
              <tr key={scheme.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{scheme.name}</td>
                <td className="px-3 py-2.5 text-[12px]">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                    {scheme.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] font-mono">
                  {scheme.type === "discount_percent" ? `${scheme.discountPercent}%` :
                   scheme.type === "discount_amount" ? `₹${scheme.discountAmount}` :
                   scheme.type === "qty_bonus" ? `Buy ${scheme.minQty} Get ${scheme.bonusQty}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-gray-500">{scheme.applicableFrom} – {scheme.applicableTo}</td>
                <td className="px-3 py-2.5 text-[12px] capitalize">{scheme.applicableItems}</td>
                <td className="px-3 py-2.5 text-[12px] capitalize">{scheme.applicableParties}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${scheme.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {scheme.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(scheme)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setSchemes(prev => prev.filter(s => s.id !== scheme.id))} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {schemes.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-[12px] text-gray-500">No schemes configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editItem ? "Modify" : "Add"} Scheme</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Scheme Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. Festival Discount 2024" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Scheme Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className={`${inputCls} w-full`}>
                    <option value="discount_percent">Discount %</option>
                    <option value="discount_amount">Flat Discount Amount</option>
                    <option value="qty_bonus">Quantity Bonus (Free Goods)</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>
                {form.type === "discount_percent" && (
                  <div>
                    <label className={labelCls}>Discount %</label>
                    <input type="number" value={form.discountPercent || 0} onChange={e => setForm(p => ({ ...p, discountPercent: +e.target.value }))} className={`${inputCls} w-full`} min={0} max={100} />
                  </div>
                )}
                {form.type === "discount_amount" && (
                  <div>
                    <label className={labelCls}>Discount Amount (₹)</label>
                    <input type="number" value={form.discountAmount || 0} onChange={e => setForm(p => ({ ...p, discountAmount: +e.target.value }))} className={`${inputCls} w-full`} min={0} />
                  </div>
                )}
                {form.type === "qty_bonus" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Min Qty</label>
                      <input type="number" value={form.minQty || 0} onChange={e => setForm(p => ({ ...p, minQty: +e.target.value }))} className={`${inputCls} w-full`} />
                    </div>
                    <div>
                      <label className={labelCls}>Bonus Qty</label>
                      <input type="number" value={form.bonusQty || 0} onChange={e => setForm(p => ({ ...p, bonusQty: +e.target.value }))} className={`${inputCls} w-full`} />
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>From Date</label>
                  <input type="date" value={form.applicableFrom} onChange={e => setForm(p => ({ ...p, applicableFrom: e.target.value }))} className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className={labelCls}>To Date</label>
                  <input type="date" value={form.applicableTo} onChange={e => setForm(p => ({ ...p, applicableTo: e.target.value }))} className={`${inputCls} w-full`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Applicable Items</label>
                  <select value={form.applicableItems} onChange={e => setForm(p => ({ ...p, applicableItems: e.target.value as any }))} className={`${inputCls} w-full`}>
                    <option value="all">All Items</option>
                    <option value="specific">Specific Items</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Applicable Parties</label>
                  <select value={form.applicableParties} onChange={e => setForm(p => ({ ...p, applicableParties: e.target.value as any }))} className={`${inputCls} w-full`}>
                    <option value="all">All Parties</option>
                    <option value="specific">Specific Parties</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                <span className="text-[12px] text-gray-700">Active</span>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md hover:bg-[#0f4a96]">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
