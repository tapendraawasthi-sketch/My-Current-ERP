// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBUnit } from "../lib/db";
import { Plus, Edit2, Trash2, Ruler, CheckCircle, XCircle } from "lucide-react";

export default function Units() {
  const { units, addUnit, updateUnit, deleteUnit } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DBUnit | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const emptyForm = {
    code: "",
    name: "",
    symbol: "",
    decimalPlaces: 2,
    isActive: true,
  };

  const [formData, setFormData] = useState<Omit<DBUnit, "id">>(emptyForm as any);

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
    // Check duplicate code
    const duplicate = units.find(
      (u) =>
        u.code?.toLowerCase() === formData.code?.trim().toLowerCase() &&
        u.id !== editingUnit?.id
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
      setShowForm(false);
      setEditingUnit(null);
      setFormData(emptyForm as any);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save unit.");
    }
  };

  const handleDeleteRequest = (unit: DBUnit) => {
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

  const filteredUnits = units.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.code?.toLowerCase().includes(q) ||
      u.symbol?.toLowerCase().includes(q)
    );
  });

  const DECIMAL_OPTIONS = [
    { value: 0, label: "0 (whole numbers)" },
    { value: 1, label: "1 decimal place" },
    { value: 2, label: "2 decimal places" },
    { value: 3, label: "3 decimal places" },
    { value: 4, label: "4 decimal places" },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Units of Measure</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage measurement units used for stock items (kg, pcs, ltr, etc.)
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Unit
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Ruler className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, code or symbol…"
            className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
          />
        </div>
        <span className="text-[11px] text-gray-500 font-medium">
          {filteredUnits.length} of {units.length} unit{units.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Code
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Symbol
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Decimal Places
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Ruler className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {searchTerm
                    ? "No units match your search."
                    : "No units found. Create your first unit of measure."}
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700">
                    {unit.code || "—"}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-700 text-[12px]">
                    {unit.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono text-gray-700">
                      {unit.symbol || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-[12px] font-mono text-gray-700">
                    {unit.decimalPlaces ?? 2}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        unit.isActive !== false
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {unit.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(unit)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(unit)}
                        title="Delete"
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingUnit ? "Edit Unit of Measure" : "New Unit of Measure"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUnit(null);
                }}
                className="text-gray-400 hover:text-gray-700 font-bold text-[16px] leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. KG"
                    maxLength={10}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={formData.symbol || ""}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="e.g. kg"
                    maxLength={10}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Kilogram"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">
                  Decimal Places
                </label>
                <select
                  value={formData.decimalPlaces ?? 2}
                  onChange={(e) =>
                    setFormData({ ...formData, decimalPlaces: Number(e.target.value) })
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  {DECIMAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-0.5">
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

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUnit(null);
                  }}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
                >
                  {editingUnit ? "Save Changes" : "Add Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Unit</h2>
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
                  onClick={() => setConfirmDeleteId(null)}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors"
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
