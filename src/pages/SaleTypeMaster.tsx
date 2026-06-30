// src/pages/SaleTypeMaster.tsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { SaleType } from "../lib/busyTypes";
import { getDB } from "../lib/db";

interface SaleTypeMasterItem {
  id: string;
  name: string;
  saleType: SaleType;
  defaultTaxRate: number;
  isDefault: boolean;
  isActive: boolean;
}

const SALE_TYPE_OPTIONS = [
  { value: SaleType.LOCAL_GST_5, label: "L/GST-5% (Local CGST+SGST 5%)" },
  { value: SaleType.LOCAL_GST_12, label: "L/GST-12% (Local CGST+SGST 12%)" },
  { value: SaleType.LOCAL_GST_18, label: "L/GST-18% (Local CGST+SGST 18%)" },
  { value: SaleType.LOCAL_GST_28, label: "L/GST-28% (Local CGST+SGST 28%)" },
  { value: SaleType.CENTRAL_GST_5, label: "C/GST-5% (Interstate IGST 5%)" },
  { value: SaleType.CENTRAL_GST_12, label: "C/GST-12% (Interstate IGST 12%)" },
  { value: SaleType.CENTRAL_GST_18, label: "C/GST-18% (Interstate IGST 18%)" },
  { value: SaleType.CENTRAL_GST_28, label: "C/GST-28% (Interstate IGST 28%)" },
  { value: SaleType.EXPORT, label: "Export (Zero-rated)" },
  { value: SaleType.ITEMWISE, label: "Itemwise (Tax from item master)" },
  { value: SaleType.MULTIRATE, label: "Multirate (Multiple tax rates)" },
  { value: SaleType.SINGLE_RATE, label: "Single Rate (One rate for invoice)" },
  { value: SaleType.NIL_RATED, label: "Nil Rated" },
  { value: SaleType.EXEMPT, label: "Exempt" },
  { value: SaleType.NON_GST, label: "Non-GST" },
  { value: SaleType.CONSUMER, label: "Consumer (B2C)" },
];

const DEFAULTS: Omit<SaleTypeMasterItem, "id">[] = [
  { name: "Local Sale GST 13%", saleType: SaleType.LOCAL_GST_18, defaultTaxRate: 13, isDefault: true, isActive: true },
  { name: "Export Sale", saleType: SaleType.EXPORT, defaultTaxRate: 0, isDefault: false, isActive: true },
  { name: "Nil Rated Sale", saleType: SaleType.NIL_RATED, defaultTaxRate: 0, isDefault: false, isActive: true },
  { name: "Exempt Sale", saleType: SaleType.EXEMPT, defaultTaxRate: 0, isDefault: false, isActive: true },
];

export default function SaleTypeMaster() {
  const [items, setItems] = useState<SaleTypeMasterItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SaleTypeMasterItem | null>(null);
  const [form, setForm] = useState<Omit<SaleTypeMasterItem, "id">>({ name: "", saleType: SaleType.LOCAL_GST_18, defaultTaxRate: 13, isDefault: false, isActive: true });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const db = getDB();
      if (db.saleTypes) {
        const data = await db.saleTypes.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` }));
          await db.saleTypes.bulkPut(seeded);
          setItems(seeded);
        } else setItems(data);
      } else {
        setItems(DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` })));
      }
    } catch {
      setItems(DEFAULTS.map((d, i) => ({ ...d, id: `st-${i}` })));
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", saleType: SaleType.LOCAL_GST_18, defaultTaxRate: 13, isDefault: false, isActive: true });
    setShowModal(true);
  };

  const openEdit = (item: SaleTypeMasterItem) => {
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
        if (db.saleTypes) await db.saleTypes.put(updated);
        setItems(prev => prev.map(i => i.id === editItem.id ? updated : i));
        toast.success("Sale Type updated");
      } else {
        const newItem: SaleTypeMasterItem = { ...form, id: `st-${Date.now()}` };
        if (db.saleTypes) await db.saleTypes.put(newItem);
        setItems(prev => [...prev, newItem]);
        toast.success("Sale Type added");
      }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sale type?")) return;
    try {
      const db = getDB();
      if (db.saleTypes) await db.saleTypes.delete(id);
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
          <h1 className="text-[15px] font-semibold text-gray-800">Sale Type Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Configure sale types: Local GST, Central GST, Export, Itemwise, etc.</p>
        </div>
        <button onClick={openAdd} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Sale Type
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Name", "Sale Type", "Tax Rate %", "Default", "Status", "Actions"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{item.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{item.saleType}</td>
                <td className="px-3 py-2.5 text-[12px] font-mono">{item.defaultTaxRate}%</td>
                <td className="px-3 py-2.5 text-[12px] text-center">{item.isDefault ? "✓" : "—"}</td>
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
            {items.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-[12px] text-gray-500">No sale types configured</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editItem ? "Modify Sale Type" : "Add Sale Type"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g. Local Sale GST 18%" />
              </div>
              <div>
                <label className={labelCls}>Sale Type</label>
                <select value={form.saleType} onChange={e => setForm(p => ({ ...p, saleType: e.target.value as SaleType }))} className={`${inputCls} w-full`}>
                  {SALE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Default Tax Rate (%)</label>
                <input type="number" value={form.defaultTaxRate} onChange={e => setForm(p => ({ ...p, defaultTaxRate: +e.target.value }))} className={`${inputCls} w-full`} min={0} max={100} />
              </div>
              <div className="flex gap-4">
                {[{ key: "isDefault", label: "Set as Default" }, { key: "isActive", label: "Active" }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} className="rounded" />
                    <span className="text-[12px] text-gray-700">{label}</span>
                  </label>
                ))}
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
