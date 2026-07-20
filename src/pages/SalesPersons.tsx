// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBSalesPerson } from "../lib/db";
import { Plus, X, Save, Search, User, Phone, Mail, Percent } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
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
  const { salesPersons, addSalesPerson, updateSalesPerson, deleteSalesPerson, initLifecycle } =
    useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return salesPersons.filter((sp) => {
      if (!matchBranch((sp as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        sp.name.toLowerCase().includes(q) ||
        sp.code.toLowerCase().includes(q) ||
        (sp.email ?? "").toLowerCase().includes(q) ||
        (sp.phone ?? "").includes(q)
      );
    });
  }, [salesPersons, search, matchBranch, branchFilter]);

  const columns = useMemo<EnterpriseColumnDef<DBSalesPerson>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (sp) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{sp.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (sp) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{sp.name}</span>
        ),
      },
      {
        id: "phone",
        header: "Phone",
        cell: (sp) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{sp.phone || "—"}</span>
        ),
      },
      {
        id: "email",
        header: "Email",
        cell: (sp) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{sp.email || "—"}</span>
        ),
      },
      {
        id: "commission",
        header: "Comm. %",
        align: "right",
        financial: true,
        cell: (sp) =>
          sp.commissionRate != null ? (
            <span className="inline-flex items-center justify-end gap-1 font-mono text-[12px]">
              {sp.commissionRate}
              <Percent className="w-3 h-3 text-[var(--ds-text-subtle)]" />
            </span>
          ) : (
            <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (sp) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              sp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {sp.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
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
          branchId:
            (salesPersons.find((s) => s.id === editingId) as { branchId?: string } | undefined)
              ?.branchId ||
            readActiveBranchId() ||
            undefined,
        } as any);
        toast.success("Sales person updated successfully.");
      } else {
        await addSalesPerson({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          commissionRate: Number(form.commissionRate),
          isActive: form.isActive,
          branchId: readActiveBranchId() || undefined,
        } as any);
        toast.success("Sales person added successfully.");
      }
      resetForm();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sp: DBSalesPerson) => {
    const snapshot = { ...sp };
    try {
      await deleteSalesPerson(sp.id);
      toast.undo(`"${sp.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addSalesPerson({ ...rest, id } as any);
        } catch {
          toast.error("Failed to restore sales person.");
        }
      });
    } catch {
      toast.error("Failed to delete sales person.");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Sales Persons"
            description="Manage your sales team members and commission rates"
            meta={
              <PageMeta>
                {filtered.length} of {salesPersons.length} sales persons
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New sales person
              </Button>
            }
            secondaryActions={[
              ...(branchOptions.length > 0
                ? [
                    <select
                      key="branch"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      aria-label="Branch"
                    >
                      <option value="all">All branches</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.code || b.id}
                        </option>
                      ))}
                    </select>,
                  ]
                : []),
            ]}
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
            <input
              placeholder="Search sales persons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filtered}
            getRowId={(sp) => sp.id}
            loading={
              salesPersons == null || initLifecycle === "loading" || initLifecycle === "initializing"
            }
            emptyTitle={search ? "No sales persons match your search" : "No sales persons found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "New sales person" to add your first team member.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New sales person
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(sp) => [
              { label: "Edit", onSelect: () => handleOpenEdit(sp) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(sp) },
            ]}
            caption="Sales persons"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
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
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
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

    </div>
  );
}
