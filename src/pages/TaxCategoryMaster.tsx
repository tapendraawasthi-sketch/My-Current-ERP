// src/pages/TaxCategoryMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { ITCEligibility } from "../lib/busyTypes";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

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
  {
    name: "GST 5%",
    taxRate: 5,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 12%",
    taxRate: 12,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 18%",
    taxRate: 18,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "GST 28%",
    taxRate: 28,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "VAT 13%",
    taxRate: 13,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.INPUT_GOODS,
    isActive: true,
  },
  {
    name: "NIL Rated",
    taxRate: 0,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.NONE,
    isActive: true,
  },
  {
    name: "Exempt",
    taxRate: 0,
    type: "local",
    changeTaxRateOnBasisOfPrice: false,
    itcEligibility: ITCEligibility.NONE,
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

const emptyForm = (): Omit<TaxCategory, "id"> => ({
  name: "",
  taxRate: 18,
  type: "local",
  changeTaxRateOnBasisOfPrice: false,
  hsnSacCode: "",
  itcEligibility: ITCEligibility.INPUT_GOODS,
  isActive: true,
});

export default function TaxCategoryMaster() {
  const [items, setItems] = useState<TaxCategory[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TaxCategory | null>(null);
  const [form, setForm] = useState<Omit<TaxCategory, "id">>(emptyForm());

  useEffect(() => {
    loadItems();
  }, []);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.hsnSacCode || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const resetForm = () => {
    setShowForm(false);
    setEditItem(null);
    setForm(emptyForm());
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (item: TaxCategory) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.taxCategories) await db.taxCategories.put(updated);
        setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
        toast.success("Tax Category updated");
      } else {
        const newItem: TaxCategory = { ...form, id: `tc-${Date.now()}` };
        if (db.taxCategories) await db.taxCategories.put(newItem);
        setItems((prev) => [...prev, newItem]);
        toast.success("Tax Category added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this tax category?")) return;
    try {
      const db = getDB();
      if (db.taxCategories) await db.taxCategories.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Tax Category Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                GST 5%, 12%, 18%, 28%, VAT 13%, NIL, exempt tax categories
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add tax category
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search tax categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={search ? "No tax categories match your search" : "No tax categories found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "Add tax category" to create your first tax category.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={`${th} text-right`}>Rate %</th>
                    <th className={th}>Type</th>
                    <th className={th}>HSN/SAC</th>
                    <th className={th}>ITC eligibility</th>
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
                      <td className={`${td} font-medium text-gray-800`}>{item.name}</td>
                      <td className={`${td} text-right font-mono font-medium`}>{item.taxRate}%</td>
                      <td className={`${td} capitalize`}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
                          {item.type}
                        </span>
                      </td>
                      <td className={`${td} font-mono text-gray-500`}>{item.hsnSacCode || "—"}</td>
                      <td className={`${td} capitalize`}>{item.itcEligibility.replace(/_/g, " ")}</td>
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
                {filtered.length} tax categor{filtered.length === 1 ? "y" : "ies"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editItem ? "Edit tax category" : "Add tax category"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. GST 18%, VAT 13%"
              />
            </div>
            <div>
              <label className={labelCls}>Tax rate (%)</label>
              <input
                type="number"
                value={form.taxRate}
                onChange={(e) => setForm((p) => ({ ...p, taxRate: +e.target.value }))}
                className={`${inputCls} font-mono`}
                min={0}
                max={100}
                step={0.01}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as TaxCategory["type"] }))}
                className={inputCls}
              >
                <option value="local">Local (CGST+SGST)</option>
                <option value="central">Central (IGST)</option>
                <option value="igst">IGST</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>HSN/SAC code (optional)</label>
              <input
                value={form.hsnSacCode || ""}
                onChange={(e) => setForm((p) => ({ ...p, hsnSacCode: e.target.value }))}
                className={`${inputCls} font-mono`}
                placeholder="e.g. 9954, 3004"
              />
            </div>
            <div>
              <label className={labelCls}>ITC eligibility</label>
              <select
                value={form.itcEligibility}
                onChange={(e) =>
                  setForm((p) => ({ ...p, itcEligibility: e.target.value as ITCEligibility }))
                }
                className={inputCls}
              >
                <option value={ITCEligibility.INPUT_GOODS}>Input goods</option>
                <option value={ITCEligibility.INPUT_SERVICES}>Input services</option>
                <option value={ITCEligibility.CAPITAL_GOODS}>Capital goods</option>
                <option value={ITCEligibility.NONE}>None</option>
                <option value={ITCEligibility.INELIGIBLE}>Ineligible</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 border border-gray-200 rounded-md p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={form.changeTaxRateOnBasisOfPrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, changeTaxRateOnBasisOfPrice: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                Change tax rate on basis of price (slab)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                Active
              </label>
            </div>
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
