import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";

const PriceListMaster: React.FC = () => {
  const { priceLists, addPriceList, updatePriceList, deletePriceList, priceLevels, items } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    priceLevelId: "",
    itemId: "",
    effectiveFromDate: "",
    effectiveToDate: "",
    qtyFrom: "",
    qtyTo: "",
    rate: 0,
    discountPercent: 0,
    mrp: "",
    isActive: true,
  });

  const filteredLists = (priceLists || []).filter((list) => {
    const level = (priceLevels || []).find(l => l.id === list.priceLevelId);
    const item = (items || []).find(i => i.id === list.itemId);
    return (
      (level?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const resetForm = () => {
    setForm({
      priceLevelId: "",
      itemId: "",
      effectiveFromDate: "",
      effectiveToDate: "",
      qtyFrom: "",
      qtyTo: "",
      rate: 0,
      discountPercent: 0,
      mrp: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (list: any) => {
    setForm({
      priceLevelId: list.priceLevelId || "",
      itemId: list.itemId || "",
      effectiveFromDate: list.effectiveFromDate || "",
      effectiveToDate: list.effectiveToDate || "",
      qtyFrom: list.qtyFrom || "",
      qtyTo: list.qtyTo || "",
      rate: list.rate || 0,
      discountPercent: list.discountPercent || 0,
      mrp: list.mrp || "",
      isActive: list.isActive ?? true,
    });
    setSelected(list);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.priceLevelId) {
      toast.error("Price Level is required");
      return;
    }
    if (!form.itemId) {
      toast.error("Stock Item is required");
      return;
    }
    if (!form.effectiveFromDate) {
      toast.error("Effective From Date is required");
      return;
    }
    if (form.rate <= 0) {
      toast.error("Rate must be greater than 0");
      return;
    }

    try {
      if (selected) {
        await updatePriceList(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addPriceList(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this price list entry?")) {
      try {
        await deletePriceList(id);
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

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-1/2 xl:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Price List Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage item pricing by price levels and dates</p>
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
              placeholder="Search price lists..."
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Price Level</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Effective From</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate (NPR)</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Discount %</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLists.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No price lists found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredLists.map((list, index) => {
                    const level = (priceLevels || []).find(l => l.id === list.priceLevelId);
                    const item = (items || []).find(i => i.id === list.itemId);
                    return (
                      <tr key={list.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{level?.name || "-"}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{item?.name || "-"}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{list.effectiveFromDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{list.rate.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">{list.discountPercent}%</td>
                        <td className="px-3 py-2.5 text-[12px] text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${list.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {list.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(list)}
                              className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(list.id)}
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
              {selected ? "Alter Price List Entry" : "Create Price List Entry"}
            </h3>
            <button 
              onClick={resetForm} 
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Price Level <span className="text-red-500">*</span></label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.priceLevelId}
                  onChange={(e) => setForm({ ...form, priceLevelId: e.target.value })}
                  autoFocus
                >
                  <option value="">-- Select Price Level --</option>
                  {(priceLevels || []).map(level => (
                    <option key={level.id} value={level.id}>{level.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Stock Item <span className="text-red-500">*</span></label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                >
                  <option value="">-- Select Item --</option>
                  {(items || []).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Effective From Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.effectiveFromDate}
                  onChange={(e) => setForm({ ...form, effectiveFromDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Effective To Date</label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.effectiveToDate}
                  onChange={(e) => setForm({ ...form, effectiveToDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Quantity From</label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.qtyFrom}
                  onChange={(e) => setForm({ ...form, qtyFrom: e.target.value })}
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Quantity To</label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.qtyTo}
                  onChange={(e) => setForm({ ...form, qtyTo: e.target.value })}
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Rate (NPR) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Discount %</label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">MRP (NPR)</label>
              <input
                type="number"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                min="0"
                step="any"
              />
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
                <label htmlFor="isActive" className="text-[12px] text-gray-700 cursor-pointer select-none">
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

export default PriceListMaster;
