// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBSalesPerson } from "../lib/db";
import { Plus, Edit2, Trash2, X, Save, Search, User, Phone, Mail, Percent } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = (): Omit<DBSalesPerson, "id"> => ({
  name: "",
  code: "",
  phone: "",
  email: "",
  commissionRate: 0,
  isActive: true,
});

export default function SalesPersons() {
  const { salesPersons, addSalesPerson, updateSalesPerson, deleteSalesPerson } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return salesPersons;
    return salesPersons.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        sp.code.toLowerCase().includes(q) ||
        (sp.email ?? "").toLowerCase().includes(q) ||
        (sp.phone ?? "").includes(q),
    );
  }, [salesPersons, search]);

  const deleteTarget = useMemo(
    () => salesPersons.find((sp) => sp.id === deleteTargetId) ?? null,
    [salesPersons, deleteTargetId],
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

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.name.trim()) return "Name is required.";
    if (!form.code.trim()) return "Code is required.";

    const dupCode = salesPersons.find(
      (sp) => sp.code.toLowerCase() === form.code.trim().toLowerCase() && sp.id !== editingId,
    );
    if (dupCode) return `Code "${form.code.trim()}" is already in use.`;

    const dupName = salesPersons.find(
      (sp) => sp.name.toLowerCase() === form.name.trim().toLowerCase() && sp.id !== editingId,
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
      await deleteSalesPerson(deleteTargetId);
      toast.success("Sales person deleted.");
    } catch {
      toast.error("Failed to delete sales person.");
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
              <h1 className="text-[15px] font-semibold text-gray-800">Sales Persons</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage your sales team members and commission rates
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5" />
              New sales person
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search sales persons..."
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
                message={search ? "No sales persons match your search" : "No sales persons found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "New sales person" to add your first team member.'
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
                    <th className={th}>Phone</th>
                    <th className={th}>Email</th>
                    <th className={`${th} text-right`}>Comm. %</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sp) => (
                    <tr
                      key={sp.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => handleOpenEdit(sp)}
                    >
                      <td className={`${td} font-mono`}>{sp.code || "—"}</td>
                      <td className={`${td} font-medium text-gray-800`}>{sp.name}</td>
                      <td className={td}>{sp.phone || "—"}</td>
                      <td className={td}>{sp.email || "—"}</td>
                      <td className={`${td} text-right font-mono`}>
                        {sp.commissionRate != null ? (
                          <span className="inline-flex items-center justify-end gap-1">
                            {sp.commissionRate}
                            <Percent className="w-3 h-3 text-gray-400" />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            sp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {sp.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(sp);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteRequest(sp.id, e)}
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
                {filtered.length} sales person{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {editingId ? "Edit sales person" : "New sales person"}
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
                value={form.code}
                onChange={(e) => setField("code", e.target.value.toUpperCase())}
                placeholder="e.g. SP01"
                maxLength={20}
                className={`${inputCls} font-mono`}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Full name *</label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  autoFocus
                  className={`${inputCls} pl-8`}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="+91 98..."
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="salesperson@example.com"
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Commission rate (%)</label>
              <div className="relative">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.commissionRate}
                  onChange={(e) => setField("commissionRate", Number(e.target.value))}
                  className={`${inputCls} pl-8 font-mono`}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
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
              <h2 className="text-[13px] font-semibold text-gray-800">Delete sales person</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">"{deleteTarget.name}"</span>? This
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
