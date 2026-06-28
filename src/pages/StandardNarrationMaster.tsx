import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBStandardNarration } from "../lib/db";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  MessageSquare,
} from "lucide-react";

// ─── Empty form template ──────────────────────────────────────────────────────

const emptyForm = (): Omit<DBStandardNarration, "id"> => ({
  voucherType: "all",
  narration: "",
  isActive: true,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function StandardNarrationMaster() {
  const {
    standardNarrations,
    addStandardNarration,
    updateStandardNarration,
    deleteStandardNarration,
  } = useStore();

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
    if (!q) return standardNarrations;
    return standardNarrations.filter(
      (sn) =>
        sn.narration.toLowerCase().includes(q) ||
        sn.voucherType.toLowerCase().includes(q)
    );
  }, [standardNarrations, search]);

  const deleteTarget = useMemo(
    () => standardNarrations.find((sn) => sn.id === deleteTargetId) ?? null,
    [standardNarrations, deleteTargetId]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleOpenEdit = (sn: DBStandardNarration) => {
    setEditingId(sn.id);
    setForm({
      voucherType: sn.voucherType || "all",
      narration: sn.narration,
      isActive: sn.isActive,
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.narration.trim()) return "Narration text is required.";
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
        voucherType: form.voucherType,
        narration: form.narration.trim(),
        isActive: form.isActive,
      };

      if (editingId) {
        await updateStandardNarration(editingId, payload);
        toast.success("Standard narration updated successfully.");
      } else {
        await addStandardNarration(payload);
        toast.success("Standard narration added successfully.");
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
      await deleteStandardNarration(deleteTargetId);
      toast.success("Standard narration deleted.");
    } catch {
      toast.error("Failed to delete standard narration.");
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
          <h1 className="text-[15px] font-semibold text-gray-800">Standard Narrations</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Pre-defined reusable remarks for voucher entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Narration
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
            placeholder="Search narrations..."
            className="w-64 h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-48">Voucher Type</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Narration Text</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Status</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {search ? "No results found." : "No standard narrations yet. Create your first template."}
                </td>
              </tr>
            ) : (
              filtered.map((sn) => (
                <tr
                  key={sn.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium text-[12px] text-gray-700 capitalize">
                    {sn.voucherType === "all" ? "All Vouchers" : sn.voucherType}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-xl truncate" title={sn.narration}>
                    {sn.narration}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        sn.isActive
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {sn.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sn)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(sn.id)}
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
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Standard Narration" : "New Standard Narration"}
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
                <label className="text-[11px] font-medium text-gray-600">
                  Voucher Type
                </label>
                <select
                  value={form.voucherType}
                  onChange={(e) => setField("voucherType", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="all">All Vouchers</option>
                  <option value="Sales">Sales</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Sales Return">Sales Return</option>
                  <option value="Purchase Return">Purchase Return</option>
                  <option value="Payment">Payment</option>
                  <option value="Receipt">Receipt</option>
                  <option value="Journal">Journal</option>
                  <option value="Contra">Contra</option>
                  <option value="Stock Transfer">Stock Transfer</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[11px] font-medium text-gray-600">
                  Narration Text *
                </label>
                <textarea
                  value={form.narration}
                  onChange={(e) => setField("narration", e.target.value)}
                  placeholder="Enter standard remark/narration here..."
                  className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-h-[100px] resize-y"
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Narration"}
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
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Standard Narration</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete this narration template? This action cannot be undone.
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
