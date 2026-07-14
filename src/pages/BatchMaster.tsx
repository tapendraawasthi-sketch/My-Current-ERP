import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";

const BatchMaster: React.FC = () => {
  const { batches, addBatch, updateBatch, deleteBatch, items, warehouses } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    batchName: "",
    itemId: "",
    mfgDate: "",
    expiryDate: "",
    mrp: "",
    purchaseRate: "",
    salesRate: "",
    godownId: "",
    openingQty: 0,
    isActive: true,
  });

  const filteredBatches = (batches || []).filter((batch) => {
    const item = (items || []).find((i) => i.id === batch.itemId);
    return (
      batch.batchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const resetForm = () => {
    setForm({
      batchName: "",
      itemId: "",
      mfgDate: "",
      expiryDate: "",
      mrp: "",
      purchaseRate: "",
      salesRate: "",
      godownId: "",
      openingQty: 0,
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (batch: any) => {
    setForm({
      batchName: batch.batchName || "",
      itemId: batch.itemId || "",
      mfgDate: batch.mfgDate || "",
      expiryDate: batch.expiryDate || "",
      mrp: batch.mrp || "",
      purchaseRate: batch.purchaseRate || "",
      salesRate: batch.salesRate || "",
      godownId: batch.godownId || "",
      openingQty: batch.openingQty || 0,
      isActive: batch.isActive ?? true,
    });
    setSelected(batch);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.batchName.trim()) {
      toast.error("Batch Name is required");
      return;
    }
    if (!form.itemId) {
      toast.error("Stock Item is required");
      return;
    }

    try {
      if (selected) {
        await updateBatch(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addBatch(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this batch?")) {
      try {
        await deleteBatch(id);
        toast.success("Deleted");
        if (selected && selected.id === id) {
          resetForm();
        }
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("An error occurred while deleting.");
      }
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const openingValue =
    (parseFloat(form.openingQty as any) || 0) * (parseFloat(form.purchaseRate as any) || 0);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-1/2 xl:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Batch Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage item batches, manufacturing and expiry dates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
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
              placeholder="Search batches..."
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Batch Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Mfg Date
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Expiry Date
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    MRP (NPR)
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No batches found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch, index) => {
                    const item = (items || []).find((i) => i.id === batch.itemId);
                    const isExpired = batch.expiryDate && batch.expiryDate < today;
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {batch.batchName}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {item?.name || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {batch.mfgDate || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {batch.expiryDate || "-"}
                          {isExpired && (
                            <span className="text-amber-600 text-[10px] ml-1.5 font-semibold">
                              ⚠ Expired
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {batch.mrp ? parseFloat(batch.mrp).toFixed(2) : "0.00"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${batch.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          >
                            {batch.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(batch)}
                              className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(batch.id)}
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
        <div className="w-full lg:w-[400px] xl:w-[450px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter Batch" : "Create Batch"}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Batch Name / Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.batchName}
                onChange={(e) => setForm({ ...form, batchName: e.target.value })}
                placeholder="Enter batch name/number"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Stock Item <span className="text-red-500">*</span>
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              >
                <option value="">-- Select Item --</option>
                {(items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Mfg Date (AD)
                </label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.mfgDate}
                  onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Expiry Date (AD)
                </label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {form.expiryDate && form.mfgDate && form.expiryDate < form.mfgDate && (
              <div className="text-red-600 text-[11px] font-medium italic -mt-2">
                ⚠ Batch expiry is before manufacture date!
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  MRP (NPR)
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.mrp}
                  onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Purchase Rate (NPR)
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.purchaseRate}
                  onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })}
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Sales Rate (NPR)
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.salesRate}
                  onChange={(e) => setForm({ ...form, salesRate: e.target.value })}
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Godown</label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.godownId}
                  onChange={(e) => setForm({ ...form, godownId: e.target.value })}
                >
                  <option value="">-- All Godowns --</option>
                  {(warehouses || []).map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Opening Quantity
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.openingQty}
                  onChange={(e) =>
                    setForm({ ...form, openingQty: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Opening Value (NPR) <span className="text-red-500">*</span>
                </label>
                <div className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-100 flex items-center justify-end text-gray-600">
                  {openingValue.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
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
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
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

export default BatchMaster;
