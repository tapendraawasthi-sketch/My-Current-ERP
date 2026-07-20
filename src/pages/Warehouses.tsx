// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBWarehouse } from "../lib/db";
import { Plus, X, Save, CheckCircle, XCircle, Star, Search } from "lucide-react";
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

export default function Warehouses() {
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loadWarehouses, initLifecycle } =
    useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = "warehouses";

  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<DBWarehouse | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loadWarehouses) {
      loadWarehouses();
    }
  }, [loadWarehouses]);

  const emptyForm = {
    code: "",
    name: "",
    address: "",
    isDefault: false,
    isActive: true,
    isMainBranch: false,
    allowNegativeStock: false,
  };

  const [formData, setFormData] = useState<Omit<DBWarehouse, "id">>(emptyForm as any);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return warehouses.filter((w) => {
      if (!matchBranch((w as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        w.code?.toLowerCase().includes(q) ||
        w.name?.toLowerCase().includes(q) ||
        w.address?.toLowerCase().includes(q)
      );
    });
  }, [warehouses, search, matchBranch, branchFilter]);

  const handleSetDefault = async (warehouse: DBWarehouse, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      for (const w of warehouses) {
        if (w.isDefault && w.id !== warehouse.id) {
          await updateWarehouse(w.id, { isDefault: false });
        }
      }
      await updateWarehouse(warehouse.id, { isDefault: true });
      toast.success(`"${warehouse.name}" set as default warehouse.`);
    } catch (err: any) {
      toast.error("Failed to update default warehouse.");
    }
  };

  const columns = useMemo<EnterpriseColumnDef<DBWarehouse>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (warehouse) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{warehouse.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (warehouse) => (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{warehouse.name}</span>
            {warehouse.isDefault && (
              <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                Default
              </span>
            )}
            {warehouse.isMainBranch && (
              <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                Main
              </span>
            )}
          </div>
        ),
      },
      {
        id: "address",
        header: "Address",
        cell: (warehouse) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{warehouse.address || "—"}</span>
        ),
      },
      {
        id: "default",
        header: "Default",
        align: "center",
        cell: (warehouse) =>
          warehouse.isDefault ? (
            <CheckCircle className="h-4 w-4 text-[#059669] mx-auto" />
          ) : (
            <button
              type="button"
              onClick={(e) => handleSetDefault(warehouse, e)}
              title="Set as default"
              className="text-gray-400 hover:text-[var(--ds-action-primary)] transition-colors mx-auto block"
            >
              <Star className="h-4 w-4" />
            </button>
          ),
      },
      {
        id: "negStock",
        header: "Neg. stock",
        align: "center",
        cell: (warehouse) =>
          warehouse.allowNegativeStock ? (
            <CheckCircle className="h-4 w-4 text-amber-500 mx-auto" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
          ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (warehouse) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              warehouse.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {warehouse.isActive !== false ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [warehouses],
  );

  const resetForm = () => {
    setShowForm(false);
    setEditingWarehouse(null);
    setFormData(emptyForm as any);
    clearEntity(pageId);
  };

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormData(emptyForm as any);
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleOpenEdit = (warehouse: DBWarehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      code: warehouse.code || "",
      name: warehouse.name || "",
      address: warehouse.address || "",
      isDefault: !!warehouse.isDefault,
      isActive: warehouse.isActive !== false,
      isMainBranch: !!warehouse.isMainBranch,
      allowNegativeStock: !!warehouse.allowNegativeStock,
      branchId: warehouse.branchId,
      branchName: warehouse.branchName,
      costCenterId: warehouse.costCenterId,
    });
    setShowForm(true);
    openEntity(pageId, warehouse.id);
  };

  // Deep link: /app/warehouses/:id | /app/warehouses/new
  useEffect(() => {
    if (route.pageId !== pageId) return;
    if (route.entityId === "new") {
      setEditingWarehouse(null);
      setFormData(emptyForm as any);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const warehouse = warehouses.find((w) => w.id === route.entityId);
      if (warehouse) {
        setEditingWarehouse(warehouse);
        setFormData({
          code: warehouse.code || "",
          name: warehouse.name || "",
          address: warehouse.address || "",
          isDefault: !!warehouse.isDefault,
          isActive: warehouse.isActive !== false,
          isMainBranch: !!warehouse.isMainBranch,
          allowNegativeStock: !!warehouse.allowNegativeStock,
          branchId: warehouse.branchId,
          branchName: warehouse.branchName,
          costCenterId: warehouse.costCenterId,
        });
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, warehouses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Warehouse name is required.");
      return;
    }
    if (!formData.code?.trim()) {
      toast.error("Warehouse code is required.");
      return;
    }
    const duplicate = warehouses.find(
      (w) => w.code === formData.code?.trim() && w.id !== editingWarehouse?.id,
    );
    if (duplicate) {
      toast.error(`Code "${formData.code}" is already used by "${duplicate.name}".`);
      return;
    }
    try {
      const payload = {
        ...formData,
        branchId: formData.branchId || readActiveBranchId() || undefined,
      };
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, payload);
        toast.success("Warehouse updated successfully.");
      } else {
        await addWarehouse(payload);
        toast.success("Warehouse added successfully.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save warehouse.");
    }
  };

  const handleDelete = async (warehouse: DBWarehouse) => {
    if (warehouse.isDefault) {
      toast.error("Cannot delete the default warehouse. Set another warehouse as default first.");
      return;
    }
    const snapshot = { ...warehouse };
    try {
      await deleteWarehouse(warehouse.id);
      toast.undo(`"${warehouse.name}" deleted`, async () => {
        try {
          const { id, ...rest } = snapshot;
          await addWarehouse({ ...rest, id } as any);
        } catch (err: any) {
          toast.error(err?.message || "Failed to restore warehouse.");
        }
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete warehouse.");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Warehouses / Go-downs"
            description="Manage stock locations and go-downs for inventory tracking"
            meta={
              <PageMeta>
                {filtered.length} of {warehouses.length} warehouses
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New warehouse
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
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search warehouses..."
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
            getRowId={(warehouse) => warehouse.id}
            loading={warehouses == null || initLifecycle === "loading" || initLifecycle === "initializing"}
            emptyTitle={search ? "No warehouses match your search" : "No warehouses found"}
            emptyDescription={
              search
                ? "Try a different search term."
                : 'Click "New warehouse" to create your first go-down.'
            }
            emptyAction={
              !search ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New warehouse
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(warehouse) => [
              { label: "Edit", onSelect: () => handleOpenEdit(warehouse) },
              {
                label: "Delete",
                destructive: true,
                hidden: warehouse.isDefault,
                onSelect: () => handleDelete(warehouse),
              },
            ]}
            caption="Warehouses and go-downs"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700">
              {editingWarehouse ? "Edit warehouse" : "New warehouse"}
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
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. WH-01"
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
                placeholder="e.g. Main Warehouse"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                type="text"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Kathmandu, Nepal"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                <span className="text-[12px] font-medium text-gray-700">Set as default</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                <span className="text-[12px] font-medium text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.isMainBranch}
                  onChange={(e) => setFormData({ ...formData, isMainBranch: e.target.checked })}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                <span className="text-[12px] font-medium text-gray-700">Main branch</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.allowNegativeStock}
                  onChange={(e) =>
                    setFormData({ ...formData, allowNegativeStock: e.target.checked })
                  }
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                <span className="text-[12px] font-medium text-gray-700">Allow negative stock</span>
              </label>
            </div>
          </form>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {editingWarehouse ? "Update" : "Save"}
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
