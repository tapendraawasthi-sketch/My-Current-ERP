// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBUnit } from "../lib/db";
import { Plus, Edit2, Trash2, X, Save, Search } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const DECIMAL_OPTIONS = [
  { value: 0, label: "0 (whole numbers)" },
  { value: 1, label: "1 decimal place" },
  { value: 2, label: "2 decimal places" },
  { value: 3, label: "3 decimal places" },
  { value: 4, label: "4 decimal places" },
];

export default function Units() {
  const { units, addUnit, updateUnit, deleteUnit } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DBUnit | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const emptyForm = {
    code: "",
    name: "",
    symbol: "",
    decimalPlaces: 2,
    isActive: true,
  };

  const [formData, setFormData] = useState<Omit<DBUnit, "id">>(emptyForm as any);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.code?.toLowerCase().includes(q) ||
        u.symbol?.toLowerCase().includes(q),
    );
  }, [units, search]);

  const resetForm = () => {
    setShowForm(false);
    setEditingUnit(null);
    setFormData(emptyForm as any);
  };

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormData(emptyForm as any);
    setShowForm(true);
  };

  const handleOpenEdit = (unit: DBUnit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code || "",
      name: unit.name || "",
      symbol: unit.symbol || "",
      decimalPlaces: unit.decimalPlaces ?? 2,
      isActive: unit.isActive !== false,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Unit name is required.");
      return;
    }
    if (!formData.code?.trim()) {
      toast.error("Unit code is required.");
      return;
    }
    if (!formData.symbol?.trim()) {
      toast.error("Unit symbol is required.");
      return;
    }
    const duplicate = units.find(
      (u) =>
        u.code?.toLowerCase() === formData.code?.trim().toLowerCase() && u.id !== editingUnit?.id,
    );
    if (duplicate) {
      toast.error(`Code "${formData.code}" is already used by "${duplicate.name}".`);
      return;
    }
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, {
          ...formData,
          code: formData.code?.trim(),
          name: formData.name?.trim(),
          symbol: formData.symbol?.trim(),
          decimalPlaces: Number(formData.decimalPlaces) || 0,
        });
        toast.success("Unit updated successfully.");
      } else {
        await addUnit({
          ...formData,
          code: formData.code?.trim(),
          name: formData.name?.trim(),
          symbol: formData.symbol?.trim(),
          decimalPlaces: Number(formData.decimalPlaces) || 0,
        });
        toast.success("Unit added successfully.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save unit.");
    }
  };

  const handleDeleteRequest = (unit: DBUnit, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConfirmDeleteId(unit.id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteUnit(confirmDeleteId);
      toast.success("Unit deleted successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete unit.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const unitToDelete = units.find((u) => u.id === confirmDeleteId);

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Units of Measure</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage measurement units used for stock items (kg, pcs, ltr, etc.)
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5" />
              New unit
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search units..."
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
                message={search ? "No units match your search" : "No units found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "New unit" to create your first unit of measure.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Code</th>
                    <th className={th}>Name</th>
                    <th className={th}>Symbol</th>
                    <th className={`${th} text-center`}>Decimal places</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((unit) => (
                    <tr
                      key={unit.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => handleOpenEdit(unit)}
                    >
                      <td className={`${td} font-mono`}>{unit.code || "—"}</td>
                      <td className={`${td} font-medium text-gray-800`}>{unit.name}</td>
                      <td className={td}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700 font-mono">
                          {unit.symbol || "—"}
                        </span>
                      </td>
                      <td className={`${td} text-center font-mono`}>{unit.decimalPlaces ?? 2}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            unit.isActive !== false
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {unit.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(unit);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteRequest(unit, e)}
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
                {filtered.length} unit{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editingUnit ? "Edit unit" : "New unit"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>Code *</label>
              <input
                type="text"
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. KG"
                maxLength={10}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Symbol *</label>
              <input
                type="text"
                value={formData.symbol || ""}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="e.g. kg"
                maxLength={10}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Name *</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Kilogram"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Decimal places</label>
              <select
                value={formData.decimalPlaces ?? 2}
                onChange={(e) =>
                  setFormData({ ...formData, decimalPlaces: Number(e.target.value) })
                }
                className={inputCls}
              >
                {DECIMAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                Number of decimal places allowed when entering quantities
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
              />
              <span className="text-[12px] font-medium text-gray-700">Active</span>
            </label>
          </form>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {editingUnit ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h2 className="text-[13px] font-semibold text-gray-800">Delete unit</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <strong>
                  "{unitToDelete?.name}" ({unitToDelete?.symbol})
                </strong>
                ? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
