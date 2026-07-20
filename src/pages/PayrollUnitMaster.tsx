import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { generateId } from "../lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const PayrollUnitMaster: React.FC = () => {
  const { payrollUnits, addPayrollUnit, updatePayrollUnit, deletePayrollUnit } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);

  const [form, setForm] = useState({
    symbol: "",
    formalName: "",
    isCompound: false,
    decimalPlaces: 0,
    firstUnit: "",
    conversionFactor: 0,
    secondUnit: "",
    isActive: true,
  });

  // Seeding logic
  useEffect(() => {
    if ((payrollUnits || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        { symbol: "Days", formalName: "Days", isCompound: false, decimalPlaces: 0, isActive: true },
        { symbol: "Hrs", formalName: "Hours", isCompound: false, decimalPlaces: 0, isActive: true },
        {
          symbol: "Pcs",
          formalName: "Pieces",
          isCompound: false,
          decimalPlaces: 0,
          isActive: true,
        },
      ];

      seedData.forEach(async (item) => {
        await addPayrollUnit(item);
      });
      // toast.success("Default Payroll Units seeded.");
    }
  }, [payrollUnits, seedDone, addPayrollUnit]);

  const filteredUnits = (payrollUnits || []).filter(
    (unit) =>
      matchBranch((unit as any).branchId) &&
      (unit.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.formalName.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const resetForm = () => {
    setForm({
      symbol: "",
      formalName: "",
      isCompound: false,
      decimalPlaces: 0,
      firstUnit: "",
      conversionFactor: 0,
      secondUnit: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (unit: any) => {
    setForm({
      symbol: unit.symbol || "",
      formalName: unit.formalName || "",
      isCompound: unit.isCompound ?? false,
      decimalPlaces: unit.decimalPlaces || 0,
      firstUnit: unit.firstUnit || "",
      conversionFactor: unit.conversionFactor || 0,
      secondUnit: unit.secondUnit || "",
      isActive: unit.isActive ?? true,
    });
    setSelected(unit);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.symbol.trim()) {
      toast.error("Symbol is required");
      return;
    }
    if (!form.formalName.trim()) {
      toast.error("Formal Name is required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updatePayrollUnit(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addPayrollUnit(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this payroll unit?")) return;
    const row = (payrollUnits || []).find((u) => u.id === id);
    if (!row) return;
    const snapshot = { ...row };
    try {
      await deletePayrollUnit(id);
      if (selected && selected.id === id) {
        resetForm();
      }
      toast.undo(`"${row.formalName || row.symbol}" deleted`, async () => {
        try {
          await addPayrollUnit({ ...snapshot });
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
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 xl:w-3/4 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">Payroll Unit Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage measurement units for attendance and production
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
              placeholder="Search units..."
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
                    Symbol
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Formal Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Decimals
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No payroll units found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit, index) => (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                        {unit.symbol}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{unit.formalName}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {unit.isCompound ? "Compound" : "Simple"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {unit.isCompound ? "-" : unit.decimalPlaces}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${unit.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                        >
                          {unit.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(unit)}
                            className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(unit.id)}
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
        <div className="w-full lg:w-[350px] xl:w-[400px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-700">
              {selected ? "Alter Payroll Unit" : "Create Payroll Unit"}
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
                Symbol <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                placeholder="Enter symbol (e.g. Days, Hrs)"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Formal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.formalName}
                onChange={(e) => setForm({ ...form, formalName: e.target.value })}
                placeholder="Enter formal name"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-2 block">Unit Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="isCompound"
                    className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] cursor-pointer"
                    checked={!form.isCompound}
                    onChange={() => setForm({ ...form, isCompound: false })}
                  />
                  Simple
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="isCompound"
                    className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] cursor-pointer"
                    checked={form.isCompound}
                    onChange={() => setForm({ ...form, isCompound: true })}
                  />
                  Compound
                </label>
              </div>
            </div>

            {!form.isCompound ? (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Decimal Places
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.decimalPlaces}
                  onChange={(e) =>
                    setForm({ ...form, decimalPlaces: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  max="4"
                />
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                      First Unit
                    </label>
                    <input
                      type="text"
                      className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                      value={form.firstUnit}
                      onChange={(e) => setForm({ ...form, firstUnit: e.target.value })}
                      placeholder="e.g. Day"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                      Second Unit
                    </label>
                    <input
                      type="text"
                      className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                      value={form.secondUnit}
                      onChange={(e) => setForm({ ...form, secondUnit: e.target.value })}
                      placeholder="e.g. Hours"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Conversion Factor
                  </label>
                  <input
                    type="number"
                    className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    value={form.conversionFactor}
                    onChange={(e) =>
                      setForm({ ...form, conversionFactor: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    step="any"
                    placeholder="e.g. 8"
                  />
                </div>

                <div className="text-center text-[11px] text-gray-600 bg-white border border-gray-200 rounded py-1.5 font-medium">
                  1 <span className="text-[var(--ds-action-primary)]">{form.firstUnit || "[Unit 1]"}</span> ={" "}
                  {form.conversionFactor || 0}{" "}
                  <span className="text-[var(--ds-action-primary)]">{form.secondUnit || "[Unit 2]"}</span>
                </div>
              </div>
            )}

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

export default PayrollUnitMaster;
