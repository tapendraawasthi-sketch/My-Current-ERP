import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBBillSundry as DBBillSundryMaster } from "../lib/db";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  Receipt,
} from "lucide-react";

// ─── Empty form template ──────────────────────────────────────────────────────

const emptyForm = (): Omit<DBBillSundryMaster, "id"> => ({
  name: "",
  alias: "",
  type: "additive",
  nature: "percentage",
  accountHeadId: "",
  defaultValue: 0,
  affectsCostInSale: false,
  affectsCostInPurchase: false,
  isActive: true,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillSundryMaster() {
  const {
    billSundryMasters,
    accounts,
    addBillSundryMaster,
    updateBillSundryMaster,
    deleteBillSundryMaster,
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
    if (!q) return billSundryMasters;
    return billSundryMasters.filter(
      (bs) =>
        bs.name.toLowerCase().includes(q) ||
        (bs.alias ?? "").toLowerCase().includes(q)
    );
  }, [billSundryMasters, search]);

  const deleteTarget = useMemo(
    () => billSundryMasters.find((bs) => bs.id === deleteTargetId) ?? null,
    [billSundryMasters, deleteTargetId]
  );

  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a: any) => a.isActive !== false),
    [accounts]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleOpenEdit = (bs: DBBillSundryMaster) => {
    setEditingId(bs.id);
    setForm({
      name: bs.name,
      alias: bs.alias ?? "",
      type: bs.type,
      nature: bs.nature,
      accountHeadId: bs.accountHeadId ?? "",
      defaultValue: bs.defaultValue ?? 0,
      affectsCostInSale: bs.affectsCostInSale ?? false,
      affectsCostInPurchase: bs.affectsCostInPurchase ?? false,
      isActive: bs.isActive ?? true,
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
    if (!form.name.trim()) return "Bill Sundry name is required.";
    
    const dup = billSundryMasters.find(
      (bs) => bs.name.toLowerCase() === form.name.trim().toLowerCase() && bs.id !== editingId
    );
    if (dup) return `Bill Sundry "${form.name.trim()}" already exists.`;

    if (form.defaultValue < 0) return "Default value cannot be negative.";
    
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
      const payload: Omit<DBBillSundryMaster, "id"> = {
        name: form.name.trim(),
        alias: form.alias?.trim() || undefined,
        type: form.type,
        nature: form.nature,
        accountHeadId: form.accountHeadId || undefined,
        defaultValue: Number(form.defaultValue),
        affectsCostInSale: form.affectsCostInSale,
        affectsCostInPurchase: form.affectsCostInPurchase,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateBillSundryMaster(editingId, payload);
        toast.success("Bill Sundry updated successfully.");
      } else {
        await addBillSundryMaster(payload);
        toast.success("Bill Sundry created successfully.");
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
      await deleteBillSundryMaster(deleteTargetId);
      toast.success("Bill Sundry deleted.");
    } catch {
      toast.error("Failed to delete bill sundry.");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const getAccountName = (id?: string) => {
    if (!id) return "—";
    const acc = activeAccounts.find((a: any) => a.id === id);
    return acc ? acc.name : "Unknown Account";
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Bill Sundries</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage additional charges, discounts, and taxes for billing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Bill Sundry
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
            placeholder="Search by name or alias..."
            className="w-64 h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nature</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Head</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Default Value</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {search ? "No results found." : "No bill sundries yet. Create your first bill sundry."}
                </td>
              </tr>
            ) : (
              filtered.map((bs) => (
                <tr
                  key={bs.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium text-[12px] text-gray-700">
                    <div>{bs.name}</div>
                    {bs.alias && <div className="text-[10px] text-gray-400 font-normal">Alias: {bs.alias}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                    {bs.type === "additive" ? (
                      <span className="text-blue-600 font-medium">Add (+)</span>
                    ) : (
                      <span className="text-red-600 font-medium">Sub (-)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                    {bs.nature.replace('_', ' ')}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[200px] truncate" title={getAccountName(bs.accountHeadId)}>
                    {getAccountName(bs.accountHeadId)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                    {bs.defaultValue > 0 ? (
                      <span>
                        {bs.defaultValue}
                        {bs.nature === "percentage" ? "%" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        bs.isActive
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {bs.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(bs)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(bs.id)}
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
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg flex-shrink-0">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Bill Sundry" : "New Bill Sundry"}
              </h2>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. VAT, Freight Charges"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={(e) => setField("alias", e.target.value)}
                    placeholder="Short name or code"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Bill Sundry Type *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value as any)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="additive">Additive (+)</option>
                    <option value="subtractive">Subtractive (-)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Bill Sundry Nature *
                  </label>
                  <select
                    value={form.nature}
                    onChange={(e) => setField("nature", e.target.value as any)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Absolute Amount</option>
                    <option value="per_unit">Per Unit Rate</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Default Value
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.defaultValue}
                    onChange={(e) => setField("defaultValue", Number(e.target.value))}
                    className="h-8 px-2.5 font-mono text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Account Head to Post (Optional)
                  </label>
                  <select
                    value={form.accountHeadId}
                    onChange={(e) => setField("accountHeadId", e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="">— Do not post to account —</option>
                    {activeAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Behavior Settings */}
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Behavior & Costing
                </span>
                
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.affectsCostInSale}
                      onChange={(e) => setField("affectsCostInSale", e.target.checked)}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] font-medium text-gray-700">Affects Cost of Goods Sold (COGS)</span>
                  </label>

                  <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.affectsCostInPurchase}
                      onChange={(e) => setField("affectsCostInPurchase", e.target.checked)}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] font-medium text-gray-700">Affects Cost of Goods Purchased (Landed Cost)</span>
                  </label>
                  
                  <label className="flex w-fit items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setField("isActive", e.target.checked)}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <span className="text-[12px] font-medium text-gray-700">Active Status</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2 flex-shrink-0">
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Bill Sundry"}
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
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Bill Sundry</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteTarget.name}</span>? 
                This action cannot be undone.
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
