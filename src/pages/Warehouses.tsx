// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import toast from "@/lib/appToast";
import { DBWarehouse } from "../lib/db";
import { Plus, Edit2, Trash2, X, Save, CheckCircle, XCircle, Star, Search } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

export default function Warehouses() {
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loadWarehouses } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<DBWarehouse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    if (!q) return warehouses;
    return warehouses.filter(
      (w) =>
        w.code?.toLowerCase().includes(q) ||
        w.name?.toLowerCase().includes(q) ||
        w.address?.toLowerCase().includes(q),
    );
  }, [warehouses, search]);

  const resetForm = () => {
    setShowForm(false);
    setEditingWarehouse(null);
    setFormData(emptyForm as any);
  };

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormData(emptyForm as any);
    setShowForm(true);
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
  };

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
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, formData);
        toast.success("Warehouse updated successfully.");
      } else {
        await addWarehouse(formData);
        toast.success("Warehouse added successfully.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save warehouse.");
    }
  };

  const handleDeleteRequest = (warehouse: DBWarehouse, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (warehouse.isDefault) {
      toast.error("Cannot delete the default warehouse. Set another warehouse as default first.");
      return;
    }
    setConfirmDeleteId(warehouse.id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteWarehouse(confirmDeleteId);
      toast.success("Warehouse deleted successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete warehouse.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

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

  const warehouseToDelete = warehouses.find((w) => w.id === confirmDeleteId);

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Warehouses / Go-downs</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage stock locations and go-downs for inventory tracking
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5" />
              New warehouse
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search warehouses..."
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
                message={search ? "No warehouses match your search" : "No warehouses found"}
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "New warehouse" to create your first go-down.'
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
                    <th className={th}>Address</th>
                    <th className={`${th} text-center`}>Default</th>
                    <th className={`${th} text-center`}>Neg. stock</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => handleOpenEdit(warehouse)}
                    >
                      <td className={`${td} font-mono`}>{warehouse.code || "—"}</td>
                      <td className={`${td} font-medium text-gray-800`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{warehouse.name}</span>
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
                      </td>
                      <td className={td}>{warehouse.address || "—"}</td>
                      <td className={`${td} text-center`}>
                        {warehouse.isDefault ? (
                          <CheckCircle className="h-4 w-4 text-[#059669] mx-auto" />
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleSetDefault(warehouse, e)}
                            title="Set as default"
                            className="text-gray-400 hover:text-[#1557b0] transition-colors mx-auto block"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                      <td className={`${td} text-center`}>
                        {warehouse.allowNegativeStock ? (
                          <CheckCircle className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            warehouse.isActive !== false
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {warehouse.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(warehouse);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteRequest(warehouse, e)}
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
                {filtered.length} warehouse{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
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
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                <span className="text-[12px] font-medium text-gray-700">Set as default</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                <span className="text-[12px] font-medium text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.isMainBranch}
                  onChange={(e) => setFormData({ ...formData, isMainBranch: e.target.checked })}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                <span className="text-[12px] font-medium text-gray-700">Main branch</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={!!formData.allowNegativeStock}
                  onChange={(e) =>
                    setFormData({ ...formData, allowNegativeStock: e.target.checked })
                  }
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
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

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <h2 className="text-[13px] font-semibold text-gray-800">Delete warehouse</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete <strong>"{warehouseToDelete?.name}"</strong>? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => setConfirmDeleteId(null)}
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
