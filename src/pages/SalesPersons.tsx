// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBSalesPerson } from "../lib/db";
import {
  Plus, Pencil, Trash2, X, Save,
  Search, User, Phone, Mail, Percent,
  CheckCircle, XCircle, Users,
} from "lucide-react";

// ─── Empty form template ──────────────────────────────────────────────────────

const emptyForm = (): Omit<DBSalesPerson, "id"> => ({
  name: "",
  code: "",
  phone: "",
  email: "",
  commissionRate: 0,
  isActive: true,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesPersons() {
  const {
    salesPersons,
    addSalesPerson,
    updateSalesPerson,
    deleteSalesPerson,
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
    if (!q) return salesPersons;
    return salesPersons.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        sp.code.toLowerCase().includes(q) ||
        (sp.email ?? "").toLowerCase().includes(q) ||
        (sp.phone ?? "").includes(q)
    );
  }, [salesPersons, search]);

  const deleteTarget = useMemo(
    () => salesPersons.find((sp) => sp.id === deleteTargetId) ?? null,
    [salesPersons, deleteTargetId]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleOpenEdit = (sp: DBSalesPerson) => {
    setEditingId(sp.id);
    setForm({
      name: sp.name,
      code: sp.code,
      phone: sp.phone ?? "",
      email: sp.email ?? "",
      commissionRate: sp.commissionRate ?? 0,
      isActive: sp.isActive,
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
    if (!form.name.trim()) return "Name is required.";
    if (!form.code.trim()) return "Code is required.";

    const dupCode = salesPersons.find(
      (sp) =>
        sp.code.toLowerCase() === form.code.trim().toLowerCase() &&
        sp.id !== editingId
    );
    if (dupCode) return `Code "${form.code.trim()}" is already in use.`;

    const dupName = salesPersons.find(
      (sp) =>
        sp.name.toLowerCase() === form.name.trim().toLowerCase() &&
        sp.id !== editingId
    );
    if (dupName) return `Sales person "${form.name.trim()}" already exists.`;

    if (form.commissionRate < 0 || form.commissionRate > 100)
      return "Commission rate must be between 0 and 100.";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return "Please enter a valid email address.";
    }

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
      if (editingId) {
        await updateSalesPerson({
          id: editingId,
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          commissionRate: Number(form.commissionRate),
          isActive: form.isActive,
        });
        toast.success("Sales person updated successfully.");
      } else {
        await addSalesPerson({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          commissionRate: Number(form.commissionRate),
          isActive: form.isActive,
        });
        toast.success("Sales person added successfully.");
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
      await deleteSalesPerson(deleteTargetId);
      toast.success("Sales person deleted.");
    } catch {
      toast.error("Failed to delete sales person.");
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
          <h1 className="text-[15px] font-semibold text-gray-800">Sales Persons</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage your sales team members and commission rates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Sales Person
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
            placeholder="Search by name, code, email..."
            className="w-64 h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Code</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Comm. %</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {search ? "No results found." : "No sales persons yet. Create your first sales person."}
                </td>
              </tr>
            ) : (
              filtered.map((sp) => (
                <tr
                  key={sp.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-700">
                    {sp.code || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-gray-700">
                    {sp.name}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {sp.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {sp.email || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                    {sp.commissionRate != null ? (
                      <span className="flex items-center justify-end gap-1">
                        {sp.commissionRate}
                        <Percent className="w-3 h-3 text-gray-400" />
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        sp.isActive
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {sp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sp)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(sp.id)}
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
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingId ? "Edit Sales Person" : "New Sales Person"}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setField("code", e.target.value.toUpperCase())}
                    placeholder="e.g. SP01"
                    maxLength={20}
                    className="h-8 px-2.5 text-[12px] font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      autoFocus
                      className="h-8 w-full pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      placeholder="+91 98..."
                      className="h-8 w-full pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="salesperson@example.com"
                      className="h-8 w-full pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 w-1/2 pr-1.5">
                <label className="text-[11px] font-medium text-gray-600">
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.commissionRate}
                    onChange={(e) => setField("commissionRate", Number(e.target.value))}
                    className="h-8 w-full pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
              </div>

              <div className="pt-1">
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Sales Person"}
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
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Sales Person</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">"{deleteTarget.name}"</span>? 
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
