// src/pages/SalesmanMaster.tsx
import React, { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";

interface Salesman {
  id: string; name: string; alias?: string; phone?: string; email?: string;
  commissionType: "percentage" | "fixed"; commissionRate: number; isActive: boolean;
}

const inputCls = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const SalesmanMaster: React.FC = () => {
  const [salesmen, setSalesmen] = useState<Salesman[]>(() => {
    try { return JSON.parse(localStorage.getItem("sutra_salesmen") || "[]"); } catch { return []; }
  });
  const [mode, setMode] = useState<"list" | "add" | "modify">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", alias: "", phone: "", email: "", commissionType: "percentage" as "percentage" | "fixed", commissionRate: 0, isActive: true });

  function save(data: Salesman[]) { localStorage.setItem("sutra_salesmen", JSON.stringify(data)); }

  function openAdd() { setForm({ name: "", alias: "", phone: "", email: "", commissionType: "percentage", commissionRate: 0, isActive: true }); setEditingId(null); setMode("add"); }
  function openModify(s: Salesman) { setForm({ name: s.name, alias: s.alias || "", phone: s.phone || "", email: s.email || "", commissionType: s.commissionType, commissionRate: s.commissionRate, isActive: s.isActive }); setEditingId(s.id); setMode("modify"); }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const s: Salesman = { id: editingId || `sal-${Date.now()}`, name: form.name.trim(), alias: form.alias || undefined, phone: form.phone || undefined, email: form.email || undefined, commissionType: form.commissionType, commissionRate: form.commissionRate, isActive: form.isActive };
    const updated = editingId ? salesmen.map(x => x.id === editingId ? s : x) : [...salesmen, s];
    setSalesmen(updated); save(updated);
    toast.success(`Salesman "${s.name}" ${editingId ? "updated" : "created"}.`);
    setMode("list");
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this salesman?")) return;
    const updated = salesmen.filter(s => s.id !== id);
    setSalesmen(updated); save(updated); toast.success("Salesman deleted.");
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Salesman Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Administration → Masters → Salesman</p>
        </div>
        {mode !== "list" && <button onClick={() => setMode("list")} className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50">← Back</button>}
      </div>

      {mode === "list" && (
        <>
          <div className="flex px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
            <button onClick={openAdd} className="h-7 px-3 bg-[#1557b0] text-white text-[11px] font-medium rounded flex items-center gap-1.5 hover:bg-[#0f4a96]"><Plus className="h-3.5 w-3.5" /> Add Salesman</button>
          </div>
          <div className="grid grid-cols-[1fr_100px_120px_80px_80px] px-4 py-1.5 bg-[#c9deb5] border-b border-gray-200 text-[10px] font-bold text-gray-700 uppercase tracking-wide">
            <span>Name</span><span>Phone</span><span>Commission</span><span>Status</span><span>Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {salesmen.length === 0 ? (
              <div className="text-center py-12 text-[12px] text-gray-500">No salesmen configured.</div>
            ) : salesmen.map(s => (
              <div key={s.id} className="grid grid-cols-[1fr_100px_120px_80px_80px] items-center px-4 py-1.5 border-b border-gray-100 hover:bg-[#f0f5ff] group text-[12px]" onClick={() => openModify(s)}>
                <div><span className="font-medium text-gray-800">{s.name}</span>{s.alias && <span className="text-[10px] text-gray-400 ml-1">({s.alias})</span>}</div>
                <span className="text-gray-600 text-[11px]">{s.phone || "—"}</span>
                <span className="text-gray-600 text-[11px]">{s.commissionRate}{s.commissionType === "percentage" ? "%" : " Rs."} {s.commissionType === "percentage" ? "of sale" : "fixed"}</span>
                <span className={`text-[10px] font-semibold ${s.isActive ? "text-green-600" : "text-red-500"}`}>{s.isActive ? "Active" : "Inactive"}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); openModify(s); }} className="p-1 rounded text-gray-500 hover:text-[#1557b0]"><Edit2 className="h-3 w-3" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }} className="p-1 rounded text-gray-500 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(mode === "add" || mode === "modify") && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4">{mode === "modify" ? "Modify Salesman" : "Add Salesman"}</h2>
            <div className="flex flex-col gap-4">
              <div><label className={labelCls}>Name <span className="text-red-500">*</span></label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Alias</label><input value={form.alias} onChange={e => setForm(p => ({ ...p, alias: e.target.value }))} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Commission Type</label>
                  <select value={form.commissionType} onChange={e => setForm(p => ({ ...p, commissionType: e.target.value as any }))} className={inputCls}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Commission Rate {form.commissionType === "percentage" ? "(%)" : "(Rs.)"}</label>
                  <input type="number" min={0} step={0.01} value={form.commissionRate || ""} onChange={e => setForm(p => ({ ...p, commissionRate: Number(e.target.value) || 0 }))} className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="slsActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded accent-[#1557b0]" />
                <label htmlFor="slsActive" className="text-[12px] text-gray-700 cursor-pointer">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button onClick={() => setMode("list")} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 flex items-center gap-1.5"><X className="h-3.5 w-3.5" /> Cancel</button>
                <button onClick={handleSave} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded hover:bg-[#0f4a96] flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save (F2)</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesmanMaster;
