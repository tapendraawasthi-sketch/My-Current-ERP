import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const ReorderLevelMaster: React.FC = () => {
  const {
    reorderLevels,
    addReorderLevel,
    updateReorderLevel,
    deleteReorderLevel,
    items,
    warehouses,
    parties,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    itemId: "",
    godownId: "",
    reorderQty: 0,
    minOrderQty: 0,
    leadTimeDays: 0,
    criteria: "higher",
    preferredSupplierId: "",
    isActive: true,
  });

  const filteredLevels = (reorderLevels || []).filter((level) => {
    if (!matchBranch((level as any).branchId)) return false;
    const item = (items || []).find((i) => i.id === level.itemId);
    const warehouse = (warehouses || []).find((w) => w.id === level.godownId);
    return (
      item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warehouse?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const resetForm = () => {
    setForm({
      itemId: "",
      godownId: "",
      reorderQty: 0,
      minOrderQty: 0,
      leadTimeDays: 0,
      criteria: "higher",
      preferredSupplierId: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (level: any) => {
    setForm({
      itemId: level.itemId || "",
      godownId: level.godownId || "",
      reorderQty: level.reorderQty || 0,
      minOrderQty: level.minOrderQty || 0,
      leadTimeDays: level.leadTimeDays || 0,
      criteria: level.criteria || "higher",
      preferredSupplierId: level.preferredSupplierId || "",
      isActive: level.isActive ?? true,
    });
    setSelected(level);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.itemId) {
      toast.error("Stock Item is required");
      return;
    }
    if (form.reorderQty <= 0) {
      toast.error("Reorder Quantity must be greater than 0");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updateReorderLevel(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addReorderLevel(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this reorder level?")) return;
    const row = (reorderLevels || []).find((l) => l.id === id);
    if (!row) return;
    const snapshot = { ...row };
    const item = (items || []).find((i) => i.id === row.itemId);
    const label = item?.name || "Reorder level";
    try {
      await deleteReorderLevel(id);
      if (selected && selected.id === id) {
        resetForm();
      }
      toast.undo(`"${label}" deleted`, async () => {
        try {
          await addReorderLevel({ ...snapshot });
        } catch (error) {
          console.error("Restore error:", error);
          toast.error("An error occurred while restoring.");
        }
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting.");
    }
  };

  const supplierOptions = (parties || []).filter(
    (party) =>
      party.type?.toLowerCase().includes("supplier") ||
      party.partyType?.toLowerCase().includes("supplier") ||
      party.type?.toLowerCase() === "both",
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">Reorder Level Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage stock item reorder levels and minimum quantities
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <Plus size={14} />
                Add New
              </button>
            </div>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search reorder levels..."
              className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Item Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Godown
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Reorder Qty
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Min Order Qty
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Lead Time (Days)
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLevels.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No reorder levels found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredLevels.map((level, index) => {
                    const item = (items || []).find((i) => i.id === level.itemId);
                    const warehouse = level.godownId
                      ? (warehouses || []).find((w) => w.id === level.godownId)
                      : null;
                    return (
                      <tr key={level.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {item?.name || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {warehouse?.name || "All Godowns"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right pr-6">
                          {level.reorderQty}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right pr-6">
                          {level.minOrderQty}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-center">
                          {level.leadTimeDays}
                        </td>
                        <td className="px-3 py-2.5 text-[12px]">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${level.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          >
                            {level.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(level)}
                              className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(level.id)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="w-full lg:w-96 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-700">
              {selected ? "Alter Reorder Level" : "Create Reorder Level"}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Stock Item <span className="text-red-500">*</span>
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                autoFocus
              >
                <option value="">-- Select Item --</option>
                {(items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Godown / Location
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.godownId}
                onChange={(e) => setForm({ ...form, godownId: e.target.value })}
              >
                <option value="">All Godowns</option>
                {(warehouses || []).map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Reorder Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.reorderQty}
                  onChange={(e) =>
                    setForm({ ...form, reorderQty: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Min Order Quantity
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.minOrderQty}
                  onChange={(e) =>
                    setForm({ ...form, minOrderQty: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.leadTimeDays}
                  onChange={(e) =>
                    setForm({ ...form, leadTimeDays: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Criteria</label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.criteria}
                  onChange={(e) => setForm({ ...form, criteria: e.target.value })}
                >
                  <option value="higher">Higher of Reorder/Min</option>
                  <option value="lower">Lower of Reorder/Min</option>
                  <option value="fixed">Fixed Reorder Qty</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Preferred Supplier
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.preferredSupplierId}
                onChange={(e) => setForm({ ...form, preferredSupplierId: e.target.value })}
              >
                <option value="">-- None --</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] h-3.5 w-3.5 cursor-pointer"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label
                  htmlFor="isActive"
                  className="text-[12px] text-gray-700 cursor-pointer select-none"
                >
                  Is Active
                </label>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
              onClick={handleSubmit}
            >
              <Save size={14} />
              {selected ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReorderLevelMaster;
