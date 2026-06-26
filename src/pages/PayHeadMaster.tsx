import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";
import { generateId } from "../lib/db";

const PayHeadMaster: React.FC = () => {
  const { payHeads, addPayHead, updatePayHead, deletePayHead, accounts } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    payHeadType: "",
    accountId: "",
    affectsNetSalary: true,
    calculationType: "flat_rate",
    calculationPeriod: "monthly",
    rate: 0,
    percentage: 0,
    basedOnPayHeadId: "",
    formula: "",
    roundingMethod: "normal",
    ssfApplicable: false,
    citApplicable: false,
    incomeTaxApplicable: false,
    pfApplicable: false,
    isActive: true,
  });

  // Seeding logic
  useEffect(() => {
    if ((payHeads || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        { name: "Basic Salary", payHeadType: "earnings", affectsNetSalary: true, calculationType: "flat_rate", calculationPeriod: "monthly", rate: 0, roundingMethod: "normal", ssfApplicable: true, citApplicable: false, incomeTaxApplicable: true, pfApplicable: false, isActive: true },
        { name: "House Rent Allowance", payHeadType: "earnings", affectsNetSalary: true, calculationType: "pct_of_basic", calculationPeriod: "monthly", percentage: 10, roundingMethod: "normal", ssfApplicable: false, citApplicable: false, incomeTaxApplicable: true, pfApplicable: false, isActive: true },
        { name: "Transport Allowance", payHeadType: "earnings", affectsNetSalary: true, calculationType: "flat_rate", calculationPeriod: "monthly", rate: 0, roundingMethod: "normal", ssfApplicable: false, citApplicable: false, incomeTaxApplicable: true, pfApplicable: false, isActive: true },
        { name: "Dashain Allowance", payHeadType: "earnings", affectsNetSalary: true, calculationType: "flat_rate", calculationPeriod: "monthly", rate: 0, roundingMethod: "normal", ssfApplicable: false, citApplicable: false, incomeTaxApplicable: true, pfApplicable: false, isActive: true },
        { name: "SSF Employee Contribution (11%)", payHeadType: "deductions", affectsNetSalary: true, calculationType: "pct_of_basic", calculationPeriod: "monthly", percentage: 11, roundingMethod: "normal", ssfApplicable: true, citApplicable: false, incomeTaxApplicable: false, pfApplicable: false, isActive: true },
        { name: "SSF Employer Contribution (20%)", payHeadType: "employer_contribution", affectsNetSalary: false, calculationType: "pct_of_basic", calculationPeriod: "monthly", percentage: 20, roundingMethod: "normal", ssfApplicable: true, citApplicable: false, incomeTaxApplicable: false, pfApplicable: false, isActive: true },
        { name: "Income Tax (TDS on Salary)", payHeadType: "deductions", affectsNetSalary: true, calculationType: "formula", calculationPeriod: "monthly", roundingMethod: "normal", ssfApplicable: false, citApplicable: false, incomeTaxApplicable: true, pfApplicable: false, isActive: true },
        { name: "CIT Deduction", payHeadType: "deductions", affectsNetSalary: true, calculationType: "pct_of_basic", calculationPeriod: "monthly", percentage: 10, roundingMethod: "normal", ssfApplicable: false, citApplicable: true, incomeTaxApplicable: false, pfApplicable: false, isActive: true },
      ];

      seedData.forEach(async (item) => {
        await addPayHead(item);
      });
      // toast.success("Default Pay Heads seeded.");
    }
  }, [payHeads, seedDone, addPayHead]);

  const filteredHeads = (payHeads || []).filter(
    (head) =>
      head.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      head.payHeadType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      name: "",
      payHeadType: "",
      accountId: "",
      affectsNetSalary: true,
      calculationType: "flat_rate",
      calculationPeriod: "monthly",
      rate: 0,
      percentage: 0,
      basedOnPayHeadId: "",
      formula: "",
      roundingMethod: "normal",
      ssfApplicable: false,
      citApplicable: false,
      incomeTaxApplicable: false,
      pfApplicable: false,
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (head: any) => {
    setForm({
      name: head.name || "",
      payHeadType: head.payHeadType || "",
      accountId: head.accountId || "",
      affectsNetSalary: head.affectsNetSalary ?? true,
      calculationType: head.calculationType || "flat_rate",
      calculationPeriod: head.calculationPeriod || "monthly",
      rate: head.rate || 0,
      percentage: head.percentage || 0,
      basedOnPayHeadId: head.basedOnPayHeadId || "",
      formula: head.formula || "",
      roundingMethod: head.roundingMethod || "normal",
      ssfApplicable: head.ssfApplicable ?? false,
      citApplicable: head.citApplicable ?? false,
      incomeTaxApplicable: head.incomeTaxApplicable ?? false,
      pfApplicable: head.pfApplicable ?? false,
      isActive: head.isActive ?? true,
    });
    setSelected(head);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Pay Head Name is required");
      return;
    }
    if (!form.payHeadType) {
      toast.error("Pay Head Type is required");
      return;
    }

    try {
      if (selected) {
        await updatePayHead(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addPayHead(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this pay head?")) {
      try {
        await deletePayHead(id);
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

  const getPayHeadTypeLabel = (type: string) => {
    switch(type) {
      case "earnings": return "Earnings";
      case "deductions": return "Deductions";
      case "employer_contribution": return "Employer Contribution";
      case "reimbursement": return "Reimbursement";
      case "loans_advances": return "Loans & Advances";
      case "statutory": return "Statutory";
      default: return type;
    }
  };

  const getCalculationTypeLabel = (type: string) => {
    switch(type) {
      case "flat_rate": return "Flat Rate";
      case "pct_of_basic": return "% of Basic";
      case "pct_of_gross": return "% of Gross";
      case "attendance_based": return "Attendance Based";
      case "production_based": return "Production Based";
      case "formula": return "Formula";
      case "user_defined": return "User Defined";
      default: return type;
    }
  };

  const ledgerOptions = (accounts || []).filter(acc => !acc.isGroup);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-1/2 xl:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Pay Head Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage earnings, deductions, and statutory pay components</p>
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
              placeholder="Search pay heads..."
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
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Calc Type</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate/%</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Affects Net</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No pay heads found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredHeads.map((head, index) => (
                    <tr key={head.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{head.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getPayHeadTypeLabel(head.payHeadType)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getCalculationTypeLabel(head.calculationType)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {head.calculationType === "flat_rate" || head.calculationType === "attendance_based" ? `Rs. ${head.rate}` : head.percentage ? `${head.percentage}%` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-center text-gray-700">
                        {head.affectsNetSalary ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${head.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {head.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(head)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(head.id)}
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
        <div className="w-full lg:w-[450px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter Pay Head" : "Create Pay Head"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Pay Head Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter pay head name"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Pay Head Type <span className="text-red-500">*</span></label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.payHeadType}
                onChange={(e) => setForm({ ...form, payHeadType: e.target.value })}
              >
                <option value="">-- Select Type --</option>
                <option value="earnings">Earnings</option>
                <option value="deductions">Deductions</option>
                <option value="employer_contribution">Employer Contribution</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="loans_advances">Loans & Advances</option>
                <option value="statutory">Statutory</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Linked Ledger/Account</label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                <option value="">-- None --</option>
                {ledgerOptions.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="affectsNetSalary"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.affectsNetSalary}
                    onChange={(e) => setForm({ ...form, affectsNetSalary: e.target.checked })}
                  />
                  <label htmlFor="affectsNetSalary" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    Affects Net Salary
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="ssfApplicable"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.ssfApplicable}
                    onChange={(e) => setForm({ ...form, ssfApplicable: e.target.checked })}
                  />
                  <label htmlFor="ssfApplicable" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    SSF Applicable<br/><span className="text-[10px] text-gray-500 font-normal">(Social Security Fund)</span>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="citApplicable"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.citApplicable}
                    onChange={(e) => setForm({ ...form, citApplicable: e.target.checked })}
                  />
                  <label htmlFor="citApplicable" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    CIT Applicable<br/><span className="text-[10px] text-gray-500 font-normal">(Citizen Invest Trust)</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="incomeTaxApplicable"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.incomeTaxApplicable}
                    onChange={(e) => setForm({ ...form, incomeTaxApplicable: e.target.checked })}
                  />
                  <label htmlFor="incomeTaxApplicable" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    Income Tax (TDS) Applicable
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="pfApplicable"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.pfApplicable}
                    onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })}
                  />
                  <label htmlFor="pfApplicable" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    PF Applicable<br/><span className="text-[10px] text-gray-500 font-normal">(Provident Fund)</span>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <label htmlFor="isActive" className="text-[11px] font-medium text-gray-700 cursor-pointer select-none leading-tight">
                    Is Active
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Calculation Type</label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.calculationType}
                  onChange={(e) => setForm({ ...form, calculationType: e.target.value })}
                >
                  <option value="flat_rate">Flat Rate</option>
                  <option value="pct_of_basic">% of Basic</option>
                  <option value="pct_of_gross">% of Gross</option>
                  <option value="attendance_based">Attendance Based</option>
                  <option value="production_based">Production Based</option>
                  <option value="formula">Formula</option>
                  <option value="user_defined">User Defined</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Calculation Period</label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.calculationPeriod}
                  onChange={(e) => setForm({ ...form, calculationPeriod: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            {(form.calculationType === "flat_rate" || form.calculationType === "attendance_based") && (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Rate (NPR)</label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
            )}

            {(form.calculationType === "pct_of_basic" || form.calculationType === "pct_of_gross") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">Percentage</label>
                  <input
                    type="number"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={form.percentage}
                    onChange={(e) => setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">Based On Pay Head</label>
                  <select
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={form.basedOnPayHeadId}
                    onChange={(e) => setForm({ ...form, basedOnPayHeadId: e.target.value })}
                  >
                    <option value="">-- Select Pay Head --</option>
                    {(payHeads || [])
                      .filter(ph => ph.id !== selected?.id)
                      .map(ph => (
                        <option key={ph.id} value={ph.id}>{ph.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {form.calculationType === "formula" && (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Formula</label>
                <textarea
                  className="px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full resize-none h-16"
                  value={form.formula}
                  onChange={(e) => setForm({ ...form, formula: e.target.value })}
                  placeholder="Enter formula..."
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Rounding Method</label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.roundingMethod}
                onChange={(e) => setForm({ ...form, roundingMethod: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="none">None</option>
              </select>
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

export default PayHeadMaster;
