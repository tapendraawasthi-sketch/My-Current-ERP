import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save, Minus } from "lucide-react";
import toast from "@/lib/appToast";
import { generateId } from "../lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const SalaryDetailsMaster: React.FC = () => {
  const {
    salaryDetails,
    addSalaryDetail,
    updateSalaryDetail,
    deleteSalaryDetail,
    employees,
    employeeGroups,
    payHeads,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    appliesTo: "Employee",
    employeeId: "",
    employeeGroupId: "",
    effectiveFromDate: "",
    payHeadAllocations: [] as {
      payHeadId: string;
      calculationType: string;
      amount: number;
      percentage: number;
    }[],
    isActive: true,
  });

  const filteredDetails = (salaryDetails || []).filter((detail) => {
    const emp = (employees || []).find((e) => e.id === detail.employeeId);
    const grp = (employeeGroups || []).find((g) => g.id === detail.employeeGroupId);
    return (
      matchBranch((detail as any).branchId) &&
      (emp?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const resetForm = () => {
    setForm({
      appliesTo: "Employee",
      employeeId: "",
      employeeGroupId: "",
      effectiveFromDate: "",
      payHeadAllocations: [],
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (detail: any) => {
    setForm({
      appliesTo: detail.employeeId ? "Employee" : "Employee Group",
      employeeId: detail.employeeId || "",
      employeeGroupId: detail.employeeGroupId || "",
      effectiveFromDate: detail.effectiveFromDate || "",
      payHeadAllocations: Array.isArray(detail.payHeadAllocations)
        ? [...detail.payHeadAllocations]
        : [],
      isActive: detail.isActive ?? true,
    });
    setSelected(detail);
    setShowForm(true);
  };

  const addPayHeadRow = () => {
    setForm((prev) => ({
      ...prev,
      payHeadAllocations: [
        ...prev.payHeadAllocations,
        { payHeadId: "", calculationType: "flat_rate", amount: 0, percentage: 0 },
      ],
    }));
  };

  const removePayHeadRow = (index: number) => {
    setForm((prev) => {
      const newAllocations = [...prev.payHeadAllocations];
      newAllocations.splice(index, 1);
      return { ...prev, payHeadAllocations: newAllocations };
    });
  };

  const updatePayHeadRow = (index: number, field: string, value: string | number) => {
    setForm((prev) => {
      const newAllocations = [...prev.payHeadAllocations];
      newAllocations[index] = { ...newAllocations[index], [field]: value };
      return { ...prev, payHeadAllocations: newAllocations };
    });
  };

  const handlePayHeadSelection = (index: number, payHeadId: string) => {
    const payHead = (payHeads || []).find((ph) => ph.id === payHeadId);
    if (payHead) {
      updatePayHeadRow(index, "payHeadId", payHeadId);
      updatePayHeadRow(index, "calculationType", payHead.calculationType);

      if (payHead.calculationType === "flat_rate") {
        updatePayHeadRow(index, "amount", payHead.rate || 0);
        updatePayHeadRow(index, "percentage", 0);
      } else if (payHead.calculationType.startsWith("pct")) {
        updatePayHeadRow(index, "amount", 0);
        updatePayHeadRow(index, "percentage", payHead.percentage || 0);
      }
    }
  };

  const calculateGrossSalary = () => {
    let gross = 0;
    form.payHeadAllocations.forEach((alloc) => {
      const payHead = (payHeads || []).find((ph) => ph.id === alloc.payHeadId);
      if (payHead && payHead.payHeadType === "earnings" && payHead.affectsNetSalary) {
        if (payHead.calculationType === "flat_rate") {
          gross += alloc.amount || 0;
        } else if (payHead.calculationType.startsWith("pct")) {
          // Simplification for UI preview
        }
      }
    });
    return gross;
  };

  const handleSubmit = async () => {
    if (!form.effectiveFromDate) {
      toast.error("Effective From Date is required");
      return;
    }
    if (form.appliesTo === "Employee" && !form.employeeId) {
      toast.error("Employee is required when Applies To is Employee");
      return;
    }
    if (form.appliesTo === "Employee Group" && !form.employeeGroupId) {
      toast.error("Employee Group is required when Applies To is Employee Group");
      return;
    }
    if (form.payHeadAllocations.length === 0) {
      toast.error("At least one Pay Head allocation is required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updateSalaryDetail(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addSalaryDetail(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this salary detail record?")) {
      try {
        await deleteSalaryDetail(id);
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
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-1/2 xl:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">
                Salary Details / Structure Master
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage pay structures for employees and groups
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
              placeholder="Search salary structures..."
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
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
                    Applies To
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Employee / Group Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Effective From
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Pay Heads
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
                {filteredDetails.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No salary details found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredDetails.map((detail, index) => {
                    const emp = (employees || []).find((e) => e.id === detail.employeeId);
                    const grp = (employeeGroups || []).find((g) => g.id === detail.employeeGroupId);
                    return (
                      <tr key={detail.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {detail.appliesTo}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {detail.appliesTo === "Employee" ? emp?.name || "-" : grp?.name || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {detail.effectiveFromDate}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-center text-gray-700">
                          {detail.payHeadAllocations?.length || 0}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${detail.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          >
                            {detail.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(detail)}
                              className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(detail.id)}
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
        <div className="w-full lg:w-[450px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter Salary Detail" : "Create Salary Detail"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-2 block">Applies To</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="appliesTo"
                    className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] cursor-pointer"
                    checked={form.appliesTo === "Employee"}
                    onChange={() =>
                      setForm({
                        ...form,
                        appliesTo: "Employee",
                        employeeId: "",
                        employeeGroupId: "",
                      })
                    }
                  />
                  Employee
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="appliesTo"
                    className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] cursor-pointer"
                    checked={form.appliesTo === "Employee Group"}
                    onChange={() =>
                      setForm({
                        ...form,
                        appliesTo: "Employee Group",
                        employeeId: "",
                        employeeGroupId: "",
                      })
                    }
                  />
                  Employee Group
                </label>
              </div>
            </div>

            {form.appliesTo === "Employee" && (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                >
                  <option value="">-- Select Employee --</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.appliesTo === "Employee Group" && (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Employee Group <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.employeeGroupId}
                  onChange={(e) => setForm({ ...form, employeeGroupId: e.target.value })}
                >
                  <option value="">-- Select Group --</option>
                  {(employeeGroups || []).map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Effective From (AD) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.effectiveFromDate}
                onChange={(e) => setForm({ ...form, effectiveFromDate: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-gray-600">
                  Pay Head Allocations <span className="text-red-500">*</span>
                </label>
                <button
                  className="h-6 px-2 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[10px] font-medium rounded flex items-center gap-1"
                  onClick={addPayHeadRow}
                >
                  <Plus size={10} />
                  Add Pay Head
                </button>
              </div>

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase w-[40%]">
                        Pay Head
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase w-[25%]">
                        Calc Type
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase w-[20%] text-right">
                        Amt / %
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase w-[15%] text-center">
                        Act
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {form.payHeadAllocations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-4 text-center text-[11px] text-gray-500 italic"
                        >
                          No pay heads allocated. Click "Add Pay Head".
                        </td>
                      </tr>
                    ) : (
                      form.payHeadAllocations.map((alloc, idx) => {
                        const payHead = (payHeads || []).find((ph) => ph.id === alloc.payHeadId);
                        const isFlatRate = payHead?.calculationType === "flat_rate";
                        const isPct = payHead?.calculationType.startsWith("pct");

                        return (
                          <tr key={idx}>
                            <td className="px-2 py-1">
                              <select
                                className="w-full h-7 px-1.5 text-[11px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/50 focus:border-[var(--ds-action-primary)]"
                                value={alloc.payHeadId}
                                onChange={(e) => handlePayHeadSelection(idx, e.target.value)}
                              >
                                <option value="">-- Select --</option>
                                {(payHeads || []).map((ph) => (
                                  <option key={ph.id} value={ph.id}>
                                    {ph.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <select
                                className="w-full h-7 px-1.5 text-[11px] border border-gray-300 rounded bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/50 focus:border-[var(--ds-action-primary)]"
                                value={alloc.calculationType}
                                onChange={(e) =>
                                  updatePayHeadRow(idx, "calculationType", e.target.value)
                                }
                                disabled
                              >
                                <option value="flat_rate">Flat Rate</option>
                                <option value="pct_of_basic">% of Basic</option>
                                <option value="pct_of_gross">% of Gross</option>
                                <option value="attendance_based">Attendance</option>
                                <option value="production_based">Production</option>
                                <option value="formula">Formula</option>
                                <option value="user_defined">User Defined</option>
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              {isFlatRate ? (
                                <input
                                  type="number"
                                  className="w-full h-7 px-1.5 text-[11px] text-right border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/50 focus:border-[var(--ds-action-primary)]"
                                  value={alloc.amount}
                                  onChange={(e) =>
                                    updatePayHeadRow(idx, "amount", parseFloat(e.target.value) || 0)
                                  }
                                  min="0"
                                  step="any"
                                />
                              ) : isPct ? (
                                <div className="relative">
                                  <input
                                    type="number"
                                    className="w-full h-7 pl-1.5 pr-4 text-[11px] text-right border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/50 focus:border-[var(--ds-action-primary)]"
                                    value={alloc.percentage}
                                    onChange={(e) =>
                                      updatePayHeadRow(
                                        idx,
                                        "percentage",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    min="0"
                                    step="0.01"
                                  />
                                  <span className="absolute right-1 top-1.5 text-[10px] text-gray-500">
                                    %
                                  </span>
                                </div>
                              ) : (
                                <div className="text-center text-gray-400 text-[11px]">-</div>
                              )}
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button
                                className="w-6 h-6 inline-flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                onClick={() => removePayHeadRow(idx)}
                                title="Remove"
                              >
                                <Minus size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex justify-between items-center">
              <span className="text-[12px] font-medium text-blue-800">
                Estimated Gross Earning:
              </span>
              <span className="text-[13px] font-bold text-blue-900 font-mono">
                {calculateGrossSalary().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] h-3.5 w-3.5 cursor-pointer"
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

export default SalaryDetailsMaster;
