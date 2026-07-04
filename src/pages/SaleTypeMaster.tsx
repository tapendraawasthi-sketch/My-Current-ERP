// src/pages/SaleTypeMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { SaleType } from "../lib/busyTypes";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

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
  {
    name: "Local Sale GST 13%",
    saleType: SaleType.LOCAL_GST_18,
    defaultTaxRate: 13,
    isDefault: true,
    isActive: true,
  },
  {
    name: "Export Sale",
    saleType: SaleType.EXPORT,
    defaultTaxRate: 0,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Nil Rated Sale",
    saleType: SaleType.NIL_RATED,
    defaultTaxRate: 0,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Exempt Sale",
    saleType: SaleType.EXEMPT,
    defaultTaxRate: 0,
    isDefault: false,
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

const emptyForm = (): Omit<SaleTypeMasterItem, "id"> => ({
  name: "",
  saleType: SaleType.LOCAL_GST_18,
  defaultTaxRate: 13,
  isDefault: false,
  isActive: true,
});

export default function SaleTypeMaster() {
  const [items, setItems] = useState<SaleTypeMasterItem[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SaleTypeMasterItem | null>(null);
  const [form, setForm] = useState<Omit<SaleTypeMasterItem, "id">>(emptyForm());

  useEffect(() => {
    loadItems();
  }, []);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(q) || item.saleType.toLowerCase().includes(q),
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

  const openEdit = (item: SaleTypeMasterItem) => {
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
        if (db.saleTypes) await db.saleTypes.put(updated);
        setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
        toast.success("Sale Type updated");
      } else {
        const newItem: SaleTypeMasterItem = { ...form, id: `st-${Date.now()}` };
        if (db.saleTypes) await db.saleTypes.put(newItem);
        setItems((prev) => [...prev, newItem]);
        toast.success("Sale Type added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this sale type?")) return;
    try {
      const db = getDB();
      if (db.saleTypes) await db.saleTypes.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const saleTypeLabel = (value: SaleType) =>
    SALE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Sale Type Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Configure sale types: local GST, central GST, export, itemwise, etc.
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add sale type
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search sale types..."
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
                message={search ? "No sale types match your search" : "No sale types configured"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "Add sale type" to create your first sale type.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={th}>Sale type</th>
                    <th className={`${th} text-right`}>Tax rate %</th>
                    <th className={`${th} text-center`}>Default</th>
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
                      <td className={`${td} text-[11px] text-gray-600`}>
                        {saleTypeLabel(item.saleType)}
                      </td>
                      <td className={`${td} text-right font-mono`}>{item.defaultTaxRate}%</td>
                      <td className={`${td} text-center`}>
                        {item.isDefault ? (
                          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                            Yes
                          </span>
                        ) : (
                          "—"
                        )}
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
                {filtered.length} sale type{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editItem ? "Edit sale type" : "Add sale type"}
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
                placeholder="e.g. Local Sale GST 18%"
              />
            </div>
            <div>
              <label className={labelCls}>Sale type</label>
              <select
                value={form.saleType}
                onChange={(e) => setForm((p) => ({ ...p, saleType: e.target.value as SaleType }))}
                className={inputCls}
              >
                {SALE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Default tax rate (%)</label>
              <input
                type="number"
                value={form.defaultTaxRate}
                onChange={(e) => setForm((p) => ({ ...p, defaultTaxRate: +e.target.value }))}
                className={`${inputCls} font-mono`}
                min={0}
                max={100}
              />
            </div>
            <div className="flex flex-col gap-2 border border-gray-200 rounded-md p-3 bg-gray-50">
              {[
                { key: "isDefault", label: "Set as default" },
                { key: "isActive", label: "Active" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={!!(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  {label}
                </label>
              ))}
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
