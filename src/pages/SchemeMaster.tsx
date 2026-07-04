// src/pages/SchemeMaster.tsx
import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

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
  {
    name: "10% Seasonal Discount",
    type: "discount_percent",
    discountPercent: 10,
    applicableFrom: "2024-01-01",
    applicableTo: "2024-03-31",
    applicableItems: "all",
    applicableParties: "all",
    isActive: true,
  },
  {
    name: "Buy 10 Get 1 Free",
    type: "qty_bonus",
    minQty: 10,
    bonusQty: 1,
    applicableFrom: "2024-01-01",
    applicableTo: "2024-12-31",
    applicableItems: "specific",
    applicableParties: "all",
    isActive: true,
  },
];

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = (): Omit<Scheme, "id"> => ({
  name: "",
  type: "discount_percent",
  discountPercent: 0,
  applicableFrom: today(),
  applicableTo: today(),
  applicableItems: "all",
  applicableParties: "all",
  isActive: true,
});

const typeLabel = (type: Scheme["type"]) =>
  type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const schemeValue = (scheme: Scheme) => {
  if (scheme.type === "discount_percent") return `${scheme.discountPercent ?? 0}%`;
  if (scheme.type === "discount_amount") return `₹${scheme.discountAmount ?? 0}`;
  if (scheme.type === "qty_bonus") return `Buy ${scheme.minQty ?? 0} Get ${scheme.bonusQty ?? 0}`;
  return "—";
};

export default function SchemeMaster() {
  const [schemes, setSchemes] = useState<Scheme[]>(
    DEFAULTS.map((d, i) => ({ ...d, id: `sch-${i}` })),
  );
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Scheme | null>(null);
  const [form, setForm] = useState<Omit<Scheme, "id">>(emptyForm());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schemes;
    return schemes.filter(
      (scheme) =>
        scheme.name.toLowerCase().includes(q) ||
        scheme.type.toLowerCase().includes(q) ||
        scheme.applicableItems.toLowerCase().includes(q) ||
        scheme.applicableParties.toLowerCase().includes(q),
    );
  }, [schemes, search]);

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

  const openEdit = (item: Scheme) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    if (editItem) {
      setSchemes((prev) => prev.map((s) => (s.id === editItem.id ? { ...editItem, ...form } : s)));
      toast.success("Scheme updated");
    } else {
      setSchemes((prev) => [...prev, { ...form, id: `sch-${Date.now()}` }]);
      toast.success("Scheme added");
    }
    resetForm();
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this scheme?")) return;
    setSchemes((prev) => prev.filter((s) => s.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Scheme / Offer Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Configure promotional schemes, discounts, and offers for items and parties
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add scheme
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search schemes..."
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
                message={search ? "No schemes match your search" : "No schemes configured"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "Add scheme" to create your first promotional scheme.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Scheme name</th>
                    <th className={th}>Type</th>
                    <th className={`${th} text-right`}>Value</th>
                    <th className={th}>Period</th>
                    <th className={th}>Items</th>
                    <th className={th}>Parties</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((scheme) => (
                    <tr
                      key={scheme.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => openEdit(scheme)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{scheme.name}</td>
                      <td className={td}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                          {typeLabel(scheme.type)}
                        </span>
                      </td>
                      <td className={`${td} text-right font-mono`}>{schemeValue(scheme)}</td>
                      <td className={`${td} text-[11px] text-gray-500`}>
                        {scheme.applicableFrom} – {scheme.applicableTo}
                      </td>
                      <td className={`${td} capitalize`}>{scheme.applicableItems}</td>
                      <td className={`${td} capitalize`}>{scheme.applicableParties}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            scheme.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {scheme.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(scheme);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(scheme.id, e)}
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
                {filtered.length} scheme{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editItem ? "Edit scheme" : "Add scheme"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={labelCls}>Scheme name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Festival Discount 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Scheme type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value as Scheme["type"] }))
                  }
                  className={inputCls}
                >
                  <option value="discount_percent">Discount %</option>
                  <option value="discount_amount">Flat discount amount</option>
                  <option value="qty_bonus">Quantity bonus (free goods)</option>
                  <option value="flat_rate">Flat rate</option>
                </select>
              </div>
              {form.type === "discount_percent" && (
                <div>
                  <label className={labelCls}>Discount %</label>
                  <input
                    type="number"
                    value={form.discountPercent || 0}
                    onChange={(e) => setForm((p) => ({ ...p, discountPercent: +e.target.value }))}
                    className={`${inputCls} font-mono`}
                    min={0}
                    max={100}
                  />
                </div>
              )}
              {form.type === "discount_amount" && (
                <div>
                  <label className={labelCls}>Discount amount (₹)</label>
                  <input
                    type="number"
                    value={form.discountAmount || 0}
                    onChange={(e) => setForm((p) => ({ ...p, discountAmount: +e.target.value }))}
                    className={`${inputCls} font-mono`}
                    min={0}
                  />
                </div>
              )}
              {form.type === "qty_bonus" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Min qty</label>
                    <input
                      type="number"
                      value={form.minQty || 0}
                      onChange={(e) => setForm((p) => ({ ...p, minQty: +e.target.value }))}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Bonus qty</label>
                    <input
                      type="number"
                      value={form.bonusQty || 0}
                      onChange={(e) => setForm((p) => ({ ...p, bonusQty: +e.target.value }))}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From date</label>
                <input
                  type="date"
                  value={form.applicableFrom}
                  onChange={(e) => setForm((p) => ({ ...p, applicableFrom: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>To date</label>
                <input
                  type="date"
                  value={form.applicableTo}
                  onChange={(e) => setForm((p) => ({ ...p, applicableTo: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Applicable items</label>
                <select
                  value={form.applicableItems}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      applicableItems: e.target.value as Scheme["applicableItems"],
                    }))
                  }
                  className={inputCls}
                >
                  <option value="all">All items</option>
                  <option value="specific">Specific items</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Applicable parties</label>
                <select
                  value={form.applicableParties}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      applicableParties: e.target.value as Scheme["applicableParties"],
                    }))
                  }
                  className={inputCls}
                >
                  <option value="all">All parties</option>
                  <option value="specific">Specific parties</option>
                </select>
              </div>
            </div>
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
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
