// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { DBWarehouse } from "../lib/db";
import { Plus, Pencil, Trash2, X, Save, CheckCircle, XCircle, Building2, Star } from "lucide-react";

export default function Warehouses() {
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loadWarehouses } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<DBWarehouse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    // Check duplicate code
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
      setShowForm(false);
      setEditingWarehouse(null);
      setFormData(emptyForm as any);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save warehouse.");
    }
  };

  const handleDeleteRequest = (warehouse: DBWarehouse) => {
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

  const handleSetDefault = async (warehouse: DBWarehouse) => {
    try {
      // Remove default from all others, then set this one
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
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Warehouses / Go-downs</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage stock locations and go-downs for inventory tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Warehouse
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Code
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Address
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Default
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Neg. Stock
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
            {warehouses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-500 text-[12px]">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No warehouses found. Create your first warehouse.
                </td>
              </tr>
            ) : (
              warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-700">
                    {warehouse.code || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{warehouse.name}</span>
                      {warehouse.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                          Default
                        </span>
                      )}
                      {warehouse.isMainBranch && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold">
                          Main
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {warehouse.address || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {warehouse.isDefault ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(warehouse)}
                        title="Set as default"
                        className="text-gray-400 hover:text-green-600 transition-colors mx-auto block"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {warehouse.allowNegativeStock ? (
                      <CheckCircle className="h-4 w-4 text-amber-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        warehouse.isActive !== false
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {warehouse.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(warehouse)}
                        title="Edit"
                        className="text-gray-400 hover:text-[#1557b0] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(warehouse)}
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

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingWarehouse ? "Edit Warehouse" : "New Warehouse"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingWarehouse(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Code *</label>
                  <input
                    type="text"
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. WH-01"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-600">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Main Warehouse"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Address</label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Kathmandu, Nepal"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-3 py-2 bg-gray-50 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={!!formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Set as Default</span>
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
                  <span className="text-[12px] font-medium text-gray-700">Main Branch</span>
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
                  <span className="text-[12px] font-medium text-gray-700">
                    Allow Negative Stock
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingWarehouse(null);
                  }}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingWarehouse ? "Save Changes" : "Add Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-gray-800">Delete Warehouse</h2>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-gray-700 mb-4">
                Are you sure you want to delete <strong>"{warehouseToDelete?.name}"</strong>? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
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
