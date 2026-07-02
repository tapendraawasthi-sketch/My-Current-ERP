// src/pages/StandardNarrationMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { getDB } from "../lib/db";

interface StandardNarration {
  id: string;
  narration: string;
  category?: string;
  voucherTypes?: string[];
  isActive: boolean;
}

const CATEGORIES = ["General", "Sales", "Purchase", "Payment", "Receipt", "Journal", "Contra", "Stock"];
const VOUCHER_TYPES = ["All", "Sales", "Purchase", "Payment", "Receipt", "Journal", "Contra", "Stock Journal"];

const DEFAULTS: Omit<StandardNarration, "id">[] = [
  { narration: "Being goods sold as per tax invoice", category: "Sales", voucherTypes: ["Sales"], isActive: true },
  { narration: "Being goods purchased as per invoice", category: "Purchase", voucherTypes: ["Purchase"], isActive: true },
  { narration: "Being payment made against invoice", category: "Payment", voucherTypes: ["Payment"], isActive: true },
  { narration: "Being receipt received against invoice", category: "Receipt", voucherTypes: ["Receipt"], isActive: true },
  { narration: "Being cash deposited into bank account", category: "Contra", voucherTypes: ["Contra"], isActive: true },
  { narration: "Being cash withdrawn from bank account", category: "Contra", voucherTypes: ["Contra"], isActive: true },
  { narration: "Being salary paid for the month", category: "Payment", voucherTypes: ["Payment"], isActive: true },
  { narration: "Being rent paid for premises", category: "Payment", voucherTypes: ["Payment"], isActive: true },
  { narration: "Being goods returned by customer", category: "Sales", voucherTypes: ["Sales"], isActive: true },
  { narration: "Being goods returned to supplier", category: "Purchase", voucherTypes: ["Purchase"], isActive: true },
  { narration: "Being stock adjusted per physical count", category: "Stock", voucherTypes: ["Stock Journal"], isActive: true },
  { narration: "Being depreciation charged on fixed assets", category: "Journal", voucherTypes: ["Journal"], isActive: true },
];

export default function StandardNarrationMaster() {
  const [narrations, setNarrations] = useState<StandardNarration[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<StandardNarration | null>(null);
  const [form, setForm] = useState<Omit<StandardNarration, "id">>({
    narration: "", category: "General", voucherTypes: ["All"], isActive: true
  });

  useEffect(() => { loadNarrations(); }, []);

  const loadNarrations = async () => {
    try {
      const db = getDB();
      if (db.standardNarrations) {
        const data = await db.standardNarrations.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` }));
          await db.standardNarrations.bulkPut(seeded);
          setNarrations(seeded);
        } else setNarrations(data);
      } else {
        setNarrations(DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` })));
      }
    } catch {
      setNarrations(DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` })));
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return narrations.filter(n => {
      const matchSearch = n.narration.toLowerCase().includes(q);
      const matchCat = categoryFilter === "All" || n.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [narrations, searchTerm, categoryFilter]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ narration: "", category: "General", voucherTypes: ["All"], isActive: true });
    setShowModal(true);
  };

  const openEdit = (item: StandardNarration) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.narration.trim()) { toast.error("Narration text is required"); return; }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.standardNarrations) await db.standardNarrations.put(updated);
        setNarrations(prev => prev.map(n => n.id === editItem.id ? updated : n));
        toast.success("Narration updated");
      } else {
        const newItem: StandardNarration = { ...form, id: `sn-${Date.now()}` };
        if (db.standardNarrations) await db.standardNarrations.put(newItem);
        setNarrations(prev => [...prev, newItem]);
        toast.success("Narration added");
      }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this narration?")) return;
    try {
      const db = getDB();
      if (db.standardNarrations) await db.standardNarrations.delete(id);
      setNarrations(prev => prev.filter(n => n.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Standard Narration Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Pre-defined narrations — press F4 in vouchers to pick from list</p>
        </div>
        <button onClick={openAdd} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Narration
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search narrations..." className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={inputCls}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-[11px] text-gray-500">{filtered.length} narrations</span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Narration Text", "Category", "Voucher Types", "Status", "Actions"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">{item.narration}</td>
                <td className="px-3 py-2.5 text-[12px]">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">{item.category}</span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.voucherTypes.join(", ")}</td>
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
            {filtered.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-[12px] text-gray-500">No narrations found</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-800">{editItem ? "Modify Narration" : "Add Narration"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Narration Text *</label>
                <textarea
                  value={form.narration}
                  onChange={e => setForm(p => ({ ...p, narration: e.target.value }))}
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 resize-none"
                  rows={3}
                  placeholder="e.g. Being goods sold as per tax invoice"
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={`${inputCls} w-full`}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Applicable Voucher Types</label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {VOUCHER_TYPES.map(vt => (
                    <label key={vt} className="flex items-center gap-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={form.voucherTypes.includes(vt)}
                        onChange={e => {
                          if (e.target.checked) setForm(p => ({ ...p, voucherTypes: [...p.voucherTypes, vt] }));
                          else setForm(p => ({ ...p, voucherTypes: p.voucherTypes.filter(v => v !== vt) }));
                        }}
                        className="rounded"
                      />
                      <span className="text-[12px] text-gray-700">{vt}</span>
                    </label>
                  ))}
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
