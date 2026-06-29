import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBUnitConversion, DBUnit } from "../lib/db";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  CheckCircle,
  XCircle,
  Scale,
  RefreshCcw,
} from "lucide-react";

// ─── Empty form template ──────────────────────────────────────────────────────

const emptyForm = (): Omit<DBUnitConversion, "id"> => ({
  mainUnit: "",
  subUnit: "",
  conversionFactor: 1,
  isActive: true,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function UnitConversionMaster() {
  const { unitConversions, units, addUnitConversion, updateUnitConversion, deleteUnitConversion } =
    useStore();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // ── Derived data ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return unitConversions;
    return unitConversions.filter(
      (uc) => uc.mainUnit.toLowerCase().includes(q) || uc.subUnit.toLowerCase().includes(q),
    );
  }, [unitConversions, search]);

  const deleteTarget = useMemo(
    () => unitConversions.find((uc) => uc.id === deleteTargetId) ?? null,
    [unitConversions, deleteTargetId],
  );

  const activeUnits = useMemo(
    () => (units ?? []).filter((u: DBUnit) => u.isActive !== false),
    [units],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleOpenEdit = (uc: DBUnitConversion) => {
    setEditingId(uc.id);
    setForm({
      mainUnit: uc.mainUnit,
      subUnit: uc.subUnit,
      conversionFactor: uc.conversionFactor ?? 1,
      isActive: uc.isActive,
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.mainUnit) return "Main unit is required.";
    if (!form.subUnit) return "Sub unit is required.";
    if (form.mainUnit === form.subUnit) return "Main unit and sub unit cannot be the same.";
    if (form.conversionFactor <= 0) return "Conversion factor must be greater than zero.";

    // Check for duplicates
    const dup = unitConversions.find(
      (uc) => uc.mainUnit === form.mainUnit && uc.subUnit === form.subUnit && uc.id !== editingId,
    );
    if (dup) return `Conversion rule for ${form.mainUnit} to ${form.subUnit} already exists.`;

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        mainUnit: form.mainUnit,
        subUnit: form.subUnit,
        conversionFactor: Number(form.conversionFactor),
        isActive: form.isActive,
      };

      if (editingId) {
        await updateUnitConversion(editingId, payload);
        toast.success("Unit conversion updated successfully.");
      } else {
        await addUnitConversion(payload);
        toast.success("Unit conversion added successfully.");
      }
      handleCloseForm();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (id: string) => setDeleteTargetId(id);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteUnitConversion(deleteTargetId);
      toast.success("Unit conversion deleted.");
    } catch {
      toast.error("Failed to delete unit conversion.");
    } finally {
      setDeleteTargetId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Unit Conversions</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage relationships and conversion factors between units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Conversion
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by unit..."
            className="w-64 h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Main Unit
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Sub Unit
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Conv. Factor
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {search
                    ? "No results found."
                    : "No unit conversions yet. Create your first conversion rule."}
                </td>
              </tr>
            ) : (
              filtered.map((uc) => (
                <tr key={uc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[12px] text-gray-700">
                    {uc.mainUnit}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{uc.subUnit}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                    <div className="flex items-center justify-end gap-1.5 text-gray-500">
                      <span>1 {uc.mainUnit}</span>
                      <span>=</span>
                      <span className="font-semibold text-gray-900">{uc.conversionFactor}</span>
                      <span>{uc.subUnit}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        uc.isActive
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {uc.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(uc)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(uc.id)}
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

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Unit Conversion" : "New Unit Conversion"}
              </h2>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Main Unit *</label>
                <select
                  value={form.mainUnit}
                  onChange={(e) => setField("mainUnit", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                >
                  <option value="">— Select main unit —</option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-center py-1 opacity-50">
                <RefreshCcw className="h-4 w-4 text-gray-400" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Sub Unit *</label>
                <select
                  value={form.subUnit}
                  onChange={(e) => setField("subUnit", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                >
                  <option value="">— Select sub unit —</option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[11px] font-medium text-gray-600">
                  Conversion Factor (1 {form.mainUnit || "Main"} = ? {form.subUnit || "Sub"}) *
                </label>
                <input
                  type="number"
                  min={0.0001}
                  step={0.0001}
                  value={form.conversionFactor}
                  onChange={(e) => setField("conversionFactor", Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>

              <div className="pt-1 mt-1">
                <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setField("isActive", e.target.checked)}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Conversion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {deleteTargetId && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Unit Conversion</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete the conversion rule from{" "}
                <span className="font-semibold text-gray-900">{deleteTarget.mainUnit}</span> to{" "}
                <span className="font-semibold text-gray-900">{deleteTarget.subUnit}</span>? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
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
