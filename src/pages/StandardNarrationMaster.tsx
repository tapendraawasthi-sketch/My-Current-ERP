// src/pages/StandardNarrationMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

interface StandardNarration {
  id: string;
  text: string;
  category: string;
  voucherTypes: string[];
  isActive: boolean;
}

const CATEGORIES = [
  "General",
  "Sales",
  "Purchase",
  "Payment",
  "Receipt",
  "Journal",
  "Contra",
  "Stock",
];
const VOUCHER_TYPES = [
  "All",
  "Sales",
  "Purchase",
  "Payment",
  "Receipt",
  "Journal",
  "Contra",
  "Stock Journal",
];

const DEFAULTS: Omit<StandardNarration, "id">[] = [
  {
    text: "Being goods sold as per tax invoice",
    category: "Sales",
    voucherTypes: ["Sales"],
    isActive: true,
  },
  {
    text: "Being goods purchased as per invoice",
    category: "Purchase",
    voucherTypes: ["Purchase"],
    isActive: true,
  },
  {
    text: "Being payment made against invoice",
    category: "Payment",
    voucherTypes: ["Payment"],
    isActive: true,
  },
  {
    text: "Being receipt received against invoice",
    category: "Receipt",
    voucherTypes: ["Receipt"],
    isActive: true,
  },
  {
    text: "Being cash deposited into bank account",
    category: "Contra",
    voucherTypes: ["Contra"],
    isActive: true,
  },
  {
    text: "Being cash withdrawn from bank account",
    category: "Contra",
    voucherTypes: ["Contra"],
    isActive: true,
  },
  {
    text: "Being salary paid for the month",
    category: "Payment",
    voucherTypes: ["Payment"],
    isActive: true,
  },
  {
    text: "Being rent paid for premises",
    category: "Payment",
    voucherTypes: ["Payment"],
    isActive: true,
  },
  {
    text: "Being goods returned by customer",
    category: "Sales",
    voucherTypes: ["Sales"],
    isActive: true,
  },
  {
    text: "Being goods returned to supplier",
    category: "Purchase",
    voucherTypes: ["Purchase"],
    isActive: true,
  },
  {
    text: "Being stock adjusted per physical count",
    category: "Stock",
    voucherTypes: ["Stock Journal"],
    isActive: true,
  },
  {
    text: "Being depreciation charged on fixed assets",
    category: "Journal",
    voucherTypes: ["Journal"],
    isActive: true,
  },
];

const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

export default function StandardNarrationMaster() {
  const [narrations, setNarrations] = useState<StandardNarration[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<StandardNarration | null>(null);
  const [form, setForm] = useState<Omit<StandardNarration, "id">>({
    text: "",
    category: "General",
    voucherTypes: ["All"],
    isActive: true,
  });

  useEffect(() => {
    loadNarrations();
  }, []);

  const loadNarrations = async () => {
    try {
      const db = getDB();
      if (db.standardNarrations) {
        const data = await db.standardNarrations.toArray();
        if (data.length === 0) {
          const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` }));
          await db.standardNarrations.bulkPut(seeded);
          setNarrations(seeded);
        } else setNarrations(data as any);
      } else {
        setNarrations(DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` })));
      }
    } catch {
      setNarrations(DEFAULTS.map((d, i) => ({ ...d, id: `sn-${i}` })));
    }
  };

  const filtered = useMemo(
    () =>
      narrations.filter((n) => {
        const matchSearch = n.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = categoryFilter === "All" || n.category === categoryFilter;
        return matchSearch && matchCat;
      }),
    [narrations, searchTerm, categoryFilter],
  );

  const resetForm = () => {
    setShowForm(false);
    setEditItem(null);
    setForm({ text: "", category: "General", voucherTypes: ["All"], isActive: true });
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ text: "", category: "General", voucherTypes: ["All"], isActive: true });
    setShowForm(true);
  };

  const openEdit = (item: StandardNarration) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.text.trim()) {
      toast.error("Narration text is required");
      return;
    }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.standardNarrations) await db.standardNarrations.put(updated);
        setNarrations((prev) => prev.map((n) => (n.id === editItem.id ? updated : n)));
        toast.success("Narration updated");
      } else {
        const newItem: StandardNarration = { ...form, id: `sn-${Date.now()}` };
        if (db.standardNarrations) await db.standardNarrations.put(newItem);
        setNarrations((prev) => [...prev, newItem]);
        toast.success("Narration added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this narration?")) return;
    try {
      const db = getDB();
      if (db.standardNarrations) await db.standardNarrations.delete(id);
      setNarrations((prev) => prev.filter((n) => n.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const hasFilters = searchTerm.trim() !== "" || categoryFilter !== "All";

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Standard Narration Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Pre-defined narrations — press F4 in vouchers to pick from list
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add narration
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search narrations..."
                className={`${inputCls} pl-8`}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`${inputCls} w-auto min-w-[140px]`}
            >
              <option value="All">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={hasFilters ? "No narrations match your filters" : "No narrations found"}
                hint={
                  hasFilters
                    ? "Try a different search or category."
                    : 'Click "Add narration" to create a standard narration.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Narration text</th>
                    <th className={th}>Category</th>
                    <th className={th}>Voucher types</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => openEdit(item)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{item.text}</td>
                      <td className={td}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                          {item.category}
                        </span>
                      </td>
                      <td className={`${td} text-[11px] text-gray-500`}>
                        {item.voucherTypes.join(", ")}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(item.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filtered.length} narration{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editItem ? "Edit narration" : "Add narration"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Narration text *</label>
              <textarea
                value={form.text}
                onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none"
                rows={3}
                placeholder="e.g. Being goods sold as per tax invoice"
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Applicable voucher types</label>
              <div className="grid grid-cols-1 gap-1 mt-1 border border-gray-200 rounded-md p-2 bg-gray-50">
                {VOUCHER_TYPES.map((vt) => (
                  <label key={vt} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={form.voucherTypes.includes(vt)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setForm((p) => ({ ...p, voucherTypes: [...p.voucherTypes, vt] }));
                        else
                          setForm((p) => ({
                            ...p,
                            voucherTypes: p.voucherTypes.filter((v) => v !== vt),
                          }));
                      }}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] text-gray-700">{vt}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
              />
              <span className="text-[12px] font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {editItem ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
