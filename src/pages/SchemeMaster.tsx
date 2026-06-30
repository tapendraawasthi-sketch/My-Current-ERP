// src/pages/SchemeMaster.tsx
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import type { DBScheme, DBItem } from "../lib/db";

const uid = () => Math.random().toString(36).slice(2, 10);
const inp = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]";
const lbl = "text-[11px] font-medium text-gray-600 block mb-1";

const emptyScheme = (): Omit<DBScheme, "id" | "createdAt"> => ({
  name: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  applicableParties: "all",
  voucherType: "sales" as any,
  appliedOn: "individual_item",
  schemeType: "discount",
  lines: [{ billItemId: "", billItemName: "", triggerQty: 1, discountPercent: 0 }],
  isActive: true,
});

export default function SchemeMaster() {
  const store = useStore();
  const schemes: DBScheme[] = store.schemes || [];
  const items: DBItem[] = store.items || [];

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DBScheme | null>(null);
  const [form, setForm] = useState(emptyScheme());

  useEffect(() => { store.loadSchemes?.(); store.loadItems?.(); }, []);

  const resetForm = () => { setForm(emptyScheme()); setEditing(null); setShowForm(false); };

  const handleEdit = (s: DBScheme) => {
    setEditing(s);
    setForm({ name: s.name, startDate: s.startDate, endDate: s.endDate, applicableParties: s.applicableParties, voucherType: s.voucherType, appliedOn: s.appliedOn, schemeType: s.schemeType, lines: s.lines.map((l) => ({ ...l, id: uid() })), isActive: s.isActive });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Scheme name required"); return; }
    try {
      if (editing) { await store.updateScheme?.(editing.id, form); toast.success("Updated"); }
      else { await store.addScheme?.(form); toast.success("Created"); }
      resetForm();
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const updateLine = (idx: number, updates: any) =>
    setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, ...updates } : l) }));

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2"><Tag className="h-4 w-4 text-[#1557b0]" /> Scheme Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Define promotional offers — Buy X Get Y, threshold discounts</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Scheme
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">{editing ? "Edit Scheme" : "New Scheme"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div><label className={lbl}>Scheme Name *</label><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Start Date</label><input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>End Date</label><input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Applicable Voucher</label>
              <select value={form.voucherType} onChange={(e) => setForm((p) => ({ ...p, voucherType: e.target.value as any }))} className={inp}>
                <option value="sales">Sales Invoice</option>
                <option value="purchase">Purchase Invoice</option>
              </select>
            </div>
            <div><label className={lbl}>Scheme Applied On</label>
              <select value={form.appliedOn} onChange={(e) => setForm((p) => ({ ...p, appliedOn: e.target.value as any }))} className={inp}>
                <option value="individual_item">Individual Item</option>
                <option value="voucher">Voucher (Total)</option>
                <option value="clubbed">Clubbed Items</option>
              </select>
            </div>
            <div><label className={lbl}>Scheme Type</label>
              <select value={form.schemeType} onChange={(e) => setForm((p) => ({ ...p, schemeType: e.target.value as any }))} className={inp}>
                <option value="discount">Discount</option>
                <option value="free_item">Free Item (Buy X Get Y)</option>
              </select>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 text-[12px] font-semibold text-gray-700">Scheme Lines</div>
            <table className="w-full">
              <thead><tr className="bg-[#f5f6fa] border-b border-gray-100">
                {["Trigger Item", "Trigger Qty", form.schemeType === "free_item" ? "Free Item" : "Discount %", form.schemeType === "free_item" ? "Free Qty" : "Discount Amt", ""].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {form.lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-2 py-1.5">
                      <select value={line.billItemId || ""} onChange={(e) => {
                        const item = items.find((i) => i.id === e.target.value);
                        updateLine(idx, { billItemId: e.target.value, billItemName: item?.name || "" });
                      }} className={inp}>
                        <option value="">— All Items —</option>
                        {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 w-24"><input type="number" value={line.triggerQty || ""} onChange={(e) => updateLine(idx, { triggerQty: Number(e.target.value) })} className={inp} min={0} step="0.01" /></td>
                    <td className="px-2 py-1.5">
                      {form.schemeType === "free_item" ? (
                        <select value={line.freeItemId || ""} onChange={(e) => {
                          const item = items.find((i) => i.id === e.target.value);
                          updateLine(idx, { freeItemId: e.target.value, freeItemName: item?.name || "" });
                        }} className={inp}>
                          <option value="">— Select Free Item —</option>
                          {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={line.discountPercent || ""} onChange={(e) => updateLine(idx, { discountPercent: Number(e.target.value) })} className={inp} min={0} max={100} step="0.01" placeholder="%" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 w-24">
                      {form.schemeType === "free_item" ? (
                        <input type="number" value={line.freeQty || ""} onChange={(e) => updateLine(idx, { freeQty: Number(e.target.value) })} className={inp} min={0} step="0.01" />
                      ) : (
                        <input type="number" value={line.discountAmount || ""} onChange={(e) => updateLine(idx, { discountAmount: Number(e.target.value) })} className={inp} min={0} step="0.01" placeholder="Rs." />
                      )}
                    </td>
                    <td className="px-2 py-1.5 w-8">
                      <button onClick={() => setForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2">
              <button onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { billItemId: "", triggerQty: 1, discountPercent: 0 }] }))} className="h-7 px-3 text-[11px] bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96]">{editing ? "Update" : "Save"} Scheme</button>
            <button onClick={resetForm} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full min-w-[700px]">
          <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
            {["Scheme Name", "Type", "Start Date", "End Date", "Applied On", "Status", ""].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}
          </tr></thead>
          <tbody>
            {schemes.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800">{s.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600 capitalize">{s.schemeType.replace("_", " ")}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{s.startDate}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{s.endDate}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-500 capitalize">{s.appliedOn.replace("_", " ")}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${s.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(s)} className="p-1.5 text-gray-400 hover:text-[#1557b0] rounded"><Edit2 className="h-3 w-3" /></button>
                    <button onClick={async () => { if (!confirm("Delete scheme?")) return; await store.deleteScheme?.(s.id); toast.success("Deleted"); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {schemes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[12px] text-gray-400">No schemes defined yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
