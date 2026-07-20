// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBUnit } from "../lib/db";
import { Plus, X, Save, Search } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const DECIMAL_OPTIONS = [
  { value: 0, label: "0 (whole numbers)" },
  { value: 1, label: "1 decimal place" },
  { value: 2, label: "2 decimal places" },
  { value: 3, label: "3 decimal places" },
  { value: 4, label: "4 decimal places" },
];

export default function Units() {
  const { units, addUnit, updateUnit, deleteUnit, initLifecycle } = useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = "units";

  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DBUnit | null>(null);
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
    return units.filter((u) => {
      if (!matchBranch((u as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.code?.toLowerCase().includes(q) ||
        u.symbol?.toLowerCase().includes(q)
      );
    });
  }, [units, search, matchBranch, branchFilter]);

  const columns = useMemo<EnterpriseColumnDef<DBUnit>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (unit) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{unit.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (unit) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{unit.name}</span>
        ),
      },
      {
        id: "symbol",
        header: "Symbol",
        cell: (unit) => (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700 font-mono">
            {unit.symbol || "—"}
          </span>
        ),
      },
      {
        id: "decimalPlaces",
        header: "Decimal places",
        align: "center",
        cell: (unit) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{unit.decimalPlaces ?? 2}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (unit) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              unit.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {unit.isActive !== false ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const resetForm = () => {
    setShowForm(false);
    setEditingUnit(null);
    setFormData(emptyForm as any);
    clearEntity(pageId);
  };

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormData(emptyForm as any);
    setShowForm(true);
    openEntity(pageId, "new");
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
    openEntity(pageId, unit.id);
  };

  // Deep link: /app/units/:id | /app/units/new
  useEffect(() => {
    if (route.pageId !== pageId) return;
    if (route.entityId === "new") {
      setEditingUnit(null);
      setFormData(emptyForm as any);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const unit = units.find((u) => u.id === route.entityId);
      if (unit) {
        setEditingUnit(unit);
        setFormData({
          code: unit.code || "",
          name: unit.name || "",
          symbol: unit.symbol || "",
          decimalPlaces: unit.decimalPlaces ?? 2,
          isActive: unit.isActive !== false,
        });
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, units]);

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
          branchId:
            (editingUnit as { branchId?: string }).branchId ||
            readActiveBranchId() ||
            undefined,
        });
        toast.success("Unit updated successfully.");
      } else {
        await addUnit({
          ...formData,
          code: formData.code?.trim(),
          name: formData.name?.trim(),
          symbol: formData.symbol?.trim(),
          decimalPlaces: Number(formData.decimalPlaces) || 0,
          branchId: readActiveBranchId() || undefined,
        });
        toast.success("Unit added successfully.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save unit.");
    }
  };

  const handleDelete = async (unit: DBUnit) => {
    const snapshot = { ...unit };
    try {
      await deleteUnit(unit.id);
      toast.undo(`"${unit.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addUnit({ ...rest, id } as any);
        } catch (err: any) {
          toast.error(err?.message || "Failed to restore unit.");
        }
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete unit.");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Units of Measure"
            description="Manage measurement units used for stock items (kg, pcs, ltr, etc.)"
            meta={
              <PageMeta>
                {filtered.length} of {units.length} units
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New unit
              </Button>
            }
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search units..."
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
            getRowId={(unit) => unit.id}
            loading={units == null || initLifecycle === "loading"}
            emptyTitle={search ? "No units match your search" : "No units found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "New unit" to create your first unit of measure.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New unit
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(unit) => [
              { label: "Edit", onSelect: () => handleOpenEdit(unit) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(unit) },
            ]}
            caption="Units of measure"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
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
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
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
    </div>
  );
}
