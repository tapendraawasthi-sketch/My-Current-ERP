import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save, Minus } from "lucide-react";
import toast from "react-hot-toast";

const CostCentreClassMaster: React.FC = () => {
  const { costCentreClasses, addCostCentreClass, updateCostCentreClass, deleteCostCentreClass, costCenters } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    name: "",
    applicableVoucherTypes: [] as string[],
    allocations: [] as { costCentreId: string; percentage: number }[],
    isActive: true,
  });

  const filteredClasses = (costCentreClasses || []).filter(
    (cls) =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      name: "",
      applicableVoucherTypes: [],
      allocations: [],
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (cls: any) => {
    setForm({
      name: cls.name || "",
      applicableVoucherTypes: Array.isArray(cls.applicableVoucherTypes) ? [...cls.applicableVoucherTypes] : [],
      allocations: Array.isArray(cls.allocations) ? [...cls.allocations] : [],
      isActive: cls.isActive ?? true,
    });
    setSelected(cls);
    setShowForm(true);
  };

  const toggleVoucherType = (type: string) => {
    setForm(prev => {
      const currentTypes = prev.applicableVoucherTypes;
      if (currentTypes.includes(type)) {
        return { ...prev, applicableVoucherTypes: currentTypes.filter(t => t !== type) };
      } else {
        return { ...prev, applicableVoucherTypes: [...currentTypes, type] };
      }
    });
  };

  const addAllocationRow = () => {
    setForm(prev => ({
      ...prev,
      allocations: [...prev.allocations, { costCentreId: "", percentage: 0 }]
    }));
  };

  const removeAllocationRow = (index: number) => {
    setForm(prev => {
      const newAllocations = [...prev.allocations];
      newAllocations.splice(index, 1);
      return { ...prev, allocations: newAllocations };
    });
  };

  const updateAllocationRow = (index: number, field: string, value: string | number) => {
    setForm(prev => {
      const newAllocations = [...prev.allocations];
      if (field === 'percentage') {
        newAllocations[index] = { ...newAllocations[index], [field]: parseFloat(value as string) || 0 };
      } else {
        newAllocations[index] = { ...newAllocations[index], [field]: value };
      }
      return { ...prev, allocations: newAllocations };
    });
  };

  const totalPercentage = form.allocations.reduce((sum, alloc) => sum + (alloc.percentage || 0), 0);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Class name is required");
      return;
    }

    // Validate percentages if there are allocations
    if (form.allocations.length > 0) {
      const invalidIndex = form.allocations.findIndex(a => !a.costCentreId || a.percentage <= 0);
      if (invalidIndex >= 0) {
        toast.error(`Allocation row ${invalidIndex + 1} has invalid values.`);
        return;
      }
    }

    try {
      if (selected) {
        await updateCostCentreClass(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addCostCentreClass(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this cost centre class?")) {
      try {
        await deleteCostCentreClass(id);
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

  const getVoucherTypeLabels = (types: string[]) => {
    return types.map(t => {
      switch(t) {
        case "sales": return "Sales";
        case "purchase": return "Purchase";
        case "payment": return "Payment";
        case "receipt": return "Receipt";
        case "journal": return "Journal";
        default: return t;
      }
    }).join(", ");
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Cost Centre Class Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage cost centre classes and allocation rules</p>
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
              placeholder="Search classes..."
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
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Voucher Types</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Allocations Count</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No cost centre classes found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((cls, index) => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{cls.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getVoucherTypeLabels(cls.applicableVoucherTypes || [])}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{cls.allocations?.length || 0}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${cls.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {cls.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(cls)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(cls.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter Cost Centre Class" : "Create Cost Centre Class"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Class Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter class name"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Applicable Voucher Types</label>
              <div className="space-y-2 border border-gray-200 rounded-md p-3 bg-gray-50">
                {[
                  { value: "sales", label: "Sales" },
                  { value: "purchase", label: "Purchase" },
                  { value: "payment", label: "Payment" },
                  { value: "receipt", label: "Receipt" },
                  { value: "journal", label: "Journal" },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`vt-${opt.value}`}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                      checked={form.applicableVoucherTypes.includes(opt.value)}
                      onChange={() => toggleVoucherType(opt.value)}
                    />
                    <label htmlFor={`vt-${opt.value}`} className="text-[12px] text-gray-700 cursor-pointer select-none">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-medium text-gray-600">Allocations</label>
                <button
                  className="h-6 px-2 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[10px] font-medium rounded flex items-center gap-1"
                  onClick={addAllocationRow}
                >
                  <Plus size={10} />
                  Add Row
                </button>
              </div>
              
              {form.allocations.length > 0 ? (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Cost Centre</th>
                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-20">%</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.allocations.map((alloc, idx) => (
                        <tr key={idx} className="bg-white hover:bg-gray-50">
                          <td className="px-1.5 py-1">
                            <select
                              className="w-full h-7 px-1.5 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                              value={alloc.costCentreId}
                              onChange={(e) => updateAllocationRow(idx, 'costCentreId', e.target.value)}
                            >
                              <option value="">-- Select --</option>
                              {(costCenters || []).map(cc => (
                                <option key={cc.id} value={cc.id}>{cc.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1.5 py-1">
                            <input
                              type="number"
                              className="w-full h-7 px-1.5 text-[11px] text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                              value={alloc.percentage}
                              onChange={(e) => updateAllocationRow(idx, 'percentage', e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-1.5 py-1 text-center">
                            <button
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              onClick={() => removeAllocationRow(idx)}
                              title="Remove"
                            >
                              <Minus size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic my-2">No allocations added yet.</p>
              )}
              
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-700">
                  Total: {totalPercentage.toFixed(2)}%
                </span>
                {totalPercentage !== 100 && totalPercentage > 0 && (
                  <span className="text-[10px] text-amber-600 font-medium">Should ideally sum to 100%</span>
                )}
              </div>
            </div>

            <div className="mt-2 pt-4 border-t border-gray-100">
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

export default CostCentreClassMaster;
