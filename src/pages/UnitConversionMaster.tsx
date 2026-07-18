import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBUnitConversion, DBUnit } from "../lib/db";
import { Plus, Edit2, Trash2, X, Save, Search, RefreshCcw } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = (): Omit<DBUnitConversion, "id"> => ({
  mainUnit: "",
  subUnit: "",
  conversionFactor: 1,
  isActive: true,
});

export default function UnitConversionMaster() {
  const { unitConversions, units, addUnitConversion, updateUnitConversion, deleteUnitConversion } =
    useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return unitConversions.filter((uc) => {
      if (!matchBranch((uc as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return uc.mainUnit.toLowerCase().includes(q) || uc.subUnit.toLowerCase().includes(q);
    });
  }, [unitConversions, search, matchBranch, branchFilter]);

  const deleteTarget = useMemo(
    () => unitConversions.find((uc) => uc.id === deleteTargetId) ?? null,
    [unitConversions, deleteTargetId],
  );

  const activeUnits = useMemo(
    () => (units ?? []).filter((u: DBUnit) => u.isActive !== false),
    [units],
  );

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

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

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.mainUnit) return "Main unit is required.";
    if (!form.subUnit) return "Sub unit is required.";
    if (form.mainUnit === form.subUnit) return "Main unit and sub unit cannot be the same.";
    if (form.conversionFactor <= 0) return "Conversion factor must be greater than zero.";

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
        branchId:
          (editingId
            ? (unitConversions.find((u) => u.id === editingId) as { branchId?: string } | undefined)
                ?.branchId
            : undefined) ||
          readActiveBranchId() ||
          undefined,
      };

      if (editingId) {
        await updateUnitConversion(editingId, payload as any);
        toast.success("Unit conversion updated successfully.");
      } else {
        await addUnitConversion(payload as any);
        toast.success("Unit conversion added successfully.");
      }
      resetForm();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTargetId(id);
  };

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

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Unit Conversions</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage relationships and conversion factors between units
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  aria-label="Branch"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className={btnPrimary} onClick={handleOpenCreate}>
                <Plus className="h-3.5 w-3.5" />
                New conversion
              </button>
            </div>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search conversions..."
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
                message={search ? "No conversions match your search" : "No unit conversions found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "New conversion" to create your first conversion rule.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Main unit</th>
                    <th className={th}>Sub unit</th>
                    <th className={`${th} text-right`}>Conversion</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((uc) => (
                    <tr
                      key={uc.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                      onClick={() => handleOpenEdit(uc)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{uc.mainUnit}</td>
                      <td className={td}>{uc.subUnit}</td>
                      <td className={`${td} text-right font-mono`}>
                        <span className="text-gray-500">
                          1 {uc.mainUnit} ={" "}
                          <span className="font-semibold text-gray-800">{uc.conversionFactor}</span>{" "}
                          {uc.subUnit}
                        </span>
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            uc.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {uc.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(uc);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteRequest(uc.id, e)}
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
                {filtered.length} conversion{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editingId ? "Edit conversion" : "New conversion"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>Main unit *</label>
              <select
                value={form.mainUnit}
                onChange={(e) => setField("mainUnit", e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select main unit</option>
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

            <div>
              <label className={labelCls}>Sub unit *</label>
              <select
                value={form.subUnit}
                onChange={(e) => setField("subUnit", e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select sub unit</option>
                {activeUnits.map((u) => (
                  <option key={u.id} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                Conversion factor (1 {form.mainUnit || "main"} = ? {form.subUnit || "sub"}) *
              </label>
              <input
                type="number"
                min={0.0001}
                step={0.0001}
                value={form.conversionFactor}
                onChange={(e) => setField("conversionFactor", Number(e.target.value))}
                className={`${inputCls} font-mono`}
                required
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
              />
              <span className="text-[12px] font-medium text-gray-700">Active</span>
            </label>
          </form>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} disabled={saving} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteTargetId && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h2 className="text-[13px] font-semibold text-gray-800">Delete conversion</h2>
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
                  className={btnOutline}
                  onClick={() => setDeleteTargetId(null)}
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
