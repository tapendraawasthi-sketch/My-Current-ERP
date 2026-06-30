// src/pages/TaxCategoryMaster.tsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { ITCEligibility } from "../lib/busyTypes";
import { getDB } from "../lib/db";

interface TaxCategory {
  id: string;
  name: string;
  taxRate: number;
  type: "local" | "central" | "igst";
  changeTaxRateOnBasisOfPrice: boolean;
  hsnSacCode?: string;
  itcEligibility: ITCEligibility;
  isActive: boolean;
}

const DEFAULTS: Omit<TaxCategory, "id">[] = [
  { name: "GST 5%", taxRate: 5, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true },
  { name: "GST 12%", taxRate: 12, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true },
  { name: "GST 18%", taxRate: 18, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true },
  { name: "GST 28%", taxRate: 28, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true },
  { name: "VAT 13%", taxRate: 13, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true },
  { name: "NIL Rated", taxRate: 0, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.NONE, isActive: true },
  { name: "Exempt", taxRate: 0, type: "local", changeTaxRateOnBasisOfPrice: false, itcEligibility: ITCEligibility.NONE, isActive: true },
];

export default function TaxCategoryMaster() {
  const [items, setItems] = useState<TaxCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<TaxCategory | null>(null);
  const [form, setForm] = useState<Omit<TaxCategory, "id">>({
    name: "", taxRate: 18, type: "local", changeTaxRateOnBasisOfPrice: false,
    hsnSacCode: "", itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true
  });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const db = getDB();
      if (db.taxCategories) {
        const data = await db.taxCategories.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` }));
          await db.taxCategories.bulkPut(seeded);
          setItems(seeded);
        } else setItems(data);
      } else {
        setItems(DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` })));
      }
    } catch {
      setItems(DEFAULTS.map((d, i) => ({ ...d, id: `tc-${i}` })));
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", taxRate: 18, type: "local", changeTaxRateOnBasisOfPrice: false, hsnSacCode: "", itcEligibility: ITCEligibility.INPUT_GOODS, isActive: true });
    setShowModal(true);
  };

  const openEdit = (item: TaxCategory) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.taxCategories) await db.taxCategories.put(updated);
        setItems(prev => prev.map(i => i.id === editItem.id ? updated : i));
        toast.success("Tax Category updated");
      } else {
        const newItem: TaxCategory = { ...form, id: `tc-${Date.now()}` };
        if (db.taxCategories) await db.taxCategories.put(newItem);
        setItems(prev => [...prev, newItem]);
        toast.success("Tax Category added");
      }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tax category?")) return;
    try {
      const db = getDB();
      if (db.taxCategories) await db.taxCategories.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Tax Category Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">GST 5%, 12%, 18%, 28%, VAT 13%, NIL, Exempt tax categories</p>
        </div>
        <button onClick={openAdd} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Tax Category
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Name", "Rate %", "Type", "HSN/SAC", "ITC Eligibility", "Status", "Actions"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{item.name}</td>
                <td className="px-3 py-2.5 text-[12px] font-mono font-bold">{item.taxRate}%</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600 capitalize">{item.type}</td>
                <td className="px-3 py-2.5 text-[12px] font-mono text-gray-500">{item.hsnSacCode || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600 capitalize">{item.itcEligibility.replace(/_/g, " ")}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editItem ? "Modify Tax Category" : "Add Tax Category"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. GST 18%, VAT 13%" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input type="number" value={form.taxRate} onChange={e => setForm(p => ({ ...p, taxRate: +e.target.value }))} className={`${inputCls} w-full`} min={0} max={100} step={0.01} />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className={`${inputCls} w-full`}>
                    <option value="local">Local (CGST+SGST)</option>
                    <option value="central">Central (IGST)</option>
                    <option value="igst">IGST</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>HSN/SAC Code (Optional)</label>
                <input value={form.hsnSacCode || ""} onChange={e => setForm(p => ({ ...p, hsnSacCode: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. 9954, 3004" />
              </div>
              <div>
                <label className={labelCls}>ITC Eligibility</label>
                <select value={form.itcEligibility} onChange={e => setForm(p => ({ ...p, itcEligibility: e.target.value as ITCEligibility }))} className={`${inputCls} w-full`}>
                  <option value={ITCEligibility.INPUT_GOODS}>Input Goods</option>
                  <option value={ITCEligibility.INPUT_SERVICES}>Input Services</option>
                  <option value={ITCEligibility.CAPITAL_GOODS}>Capital Goods</option>
                  <option value={ITCEligibility.NONE}>None</option>
                  <option value={ITCEligibility.INELIGIBLE}>Ineligible</option>
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.changeTaxRateOnBasisOfPrice} onChange={e => setForm(p => ({ ...p, changeTaxRateOnBasisOfPrice: e.target.checked }))} className="rounded" />
                  <span className="text-[12px] text-gray-700">Change Tax Rate on Basis of Price (slab)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-[12px] text-gray-700">Active</span>
                </label>
              </div>
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
