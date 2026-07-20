import React, { useState } from "react";
import { useStore } from "../store";
import { generateId } from "../lib/db";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const StockCategoryMaster: React.FC = () => {
  const { stockCategories, addStockCategory, updateStockCategory, deleteStockCategory } =
    useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    name: "",
    alias: "",
    underCategoryId: "",
    description: "",
    isActive: true,
  });

  const filteredCategories = (stockCategories || []).filter(
    (cat) =>
      matchBranch((cat as any).branchId) &&
      (cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.alias?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const resetForm = () => {
    setForm({ name: "", alias: "", underCategoryId: "", description: "", isActive: true });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (category: any) => {
    setForm({
      name: category.name || "",
      alias: category.alias || "",
      underCategoryId: category.underCategoryId || "",
      description: category.description || "",
      isActive: category.isActive ?? true,
    });
    setSelected(category);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updateStockCategory(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addStockCategory(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this record?")) return;
    const row = (stockCategories || []).find((c) => c.id === id);
    if (!row) return;
    const snapshot = { ...row };
    try {
      await deleteStockCategory(id);
      if (selected && selected.id === id) {
        resetForm();
      }
      toast.undo(`"${row.name}" deleted`, async () => {
        try {
          await addStockCategory({ ...snapshot });
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

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">Stock Category Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage stock categories and hierarchies
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
              placeholder="Search categories..."
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
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Alias
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Parent Category
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
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No categories found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category, index) => {
                    const parentCat = (stockCategories || []).find(
                      (c) => c.id === category.underCategoryId,
                    );
                    return (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {category.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {category.alias || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {parentCat?.name || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px]">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${category.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          >
                            {category.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(category)}
                              className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(category.id)}
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
              {selected ? "Alter Stock Category" : "Create Stock Category"}
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
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Alias</label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder="Enter alias"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Under Category
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.underCategoryId}
                onChange={(e) => setForm({ ...form, underCategoryId: e.target.value })}
              >
                <option value="">-- None (Top Level) --</option>
                {(stockCategories || [])
                  .filter((cat) => !selected || cat.id !== selected.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Description
              </label>
              <textarea
                className="px-2.5 py-2 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full min-h-[80px] resize-y"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="isActive"
                className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] h-3.5 w-3.5"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <label htmlFor="isActive" className="text-[12px] text-gray-700 cursor-pointer">
                Is Active
              </label>
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

export default StockCategoryMaster;
