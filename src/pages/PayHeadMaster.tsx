import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save, Search } from "lucide-react";
import toast from "react-hot-toast";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = () => ({
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

const PayHeadMaster: React.FC = () => {
  const { payHeads, addPayHead, updatePayHead, deletePayHead, accounts } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if ((payHeads || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        {
          name: "Basic Salary",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "House Rent Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Transport Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Dashain Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "SSF Employee Contribution (11%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 11,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "SSF Employer Contribution (20%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 20,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Income Tax (TDS on Salary)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "formula",
          calculationPeriod: "monthly",
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "CIT Deduction",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: true,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "EPF Employee Contribution (10%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "EPF Employer Contribution (10%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "Provident Fund Employee (10%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "Provident Fund Employer (10%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
      ];

      seedData.forEach(async (item) => {
        await addPayHead(item);
      });
    }
  }, [payHeads, seedDone, addPayHead]);

  const filteredHeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = payHeads || [];
    if (!q) return list;
    return list.filter(
      (head) =>
        head.name.toLowerCase().includes(q) ||
        head.payHeadType.toLowerCase().includes(q),
    );
  }, [payHeads, searchTerm]);

  const resetForm = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(false);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(true);
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

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Delete this pay head?")) return;
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
  };

  const getPayHeadTypeLabel = (type: string) => {
    switch (type) {
      case "earnings":
        return "Earnings";
      case "deductions":
        return "Deductions";
      case "employer_contribution":
        return "Employer Contribution";
      case "reimbursement":
        return "Reimbursement";
      case "loans_advances":
        return "Loans & Advances";
      case "statutory":
        return "Statutory";
      default:
        return type;
    }
  };

  const getCalculationTypeLabel = (type: string) => {
    switch (type) {
      case "flat_rate":
        return "Flat Rate";
      case "pct_of_basic":
        return "% of Basic";
      case "pct_of_gross":
        return "% of Gross";
      case "attendance_based":
        return "Attendance Based";
      case "production_based":
        return "Production Based";
      case "formula":
        return "Formula";
      case "user_defined":
        return "User Defined";
      default:
        return type;
    }
  };

  const rateDisplay = (head: any) => {
    if (head.calculationType === "flat_rate" || head.calculationType === "attendance_based") {
      return `Rs. ${head.rate}`;
    }
    if (head.percentage) return `${head.percentage}%`;
    return "—";
  };

  const ledgerOptions = (accounts || []).filter((acc) => !acc.isGroup);

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Pay Head Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage earnings, deductions, and statutory pay components
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add pay head
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search pay heads..."
              className={`${inputCls} pl-8`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredHeads.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={
                  searchTerm ? "No pay heads match your search" : "No pay heads found"
                }
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Add pay head" to create your first pay head.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={th}>Type</th>
                    <th className={th}>Calc type</th>
                    <th className={`${th} text-right`}>Rate/%</th>
                    <th className={`${th} text-center`}>Affects net</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeads.map((head) => (
                    <tr
                      key={head.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => loadFormForEdit(head)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{head.name}</td>
                      <td className={td}>{getPayHeadTypeLabel(head.payHeadType)}</td>
                      <td className={td}>{getCalculationTypeLabel(head.calculationType)}</td>
                      <td className={`${td} text-right font-mono`}>{rateDisplay(head)}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            head.affectsNetSalary
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {head.affectsNetSalary ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            head.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {head.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadFormForEdit(head);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(head.id, e)}
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
                {filteredHeads.length} pay head{filteredHeads.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[min(560px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-800">
              {selected ? "Edit pay head" : "Add pay head"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Pay head name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter pay head name"
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>
                Pay head type <span className="text-red-500">*</span>
              </label>
              <select
                className={inputCls}
                value={form.payHeadType}
                onChange={(e) => setForm({ ...form, payHeadType: e.target.value })}
              >
                <option value="">— Select type —</option>
                <option value="earnings">Earnings</option>
                <option value="deductions">Deductions</option>
                <option value="employer_contribution">Employer Contribution</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="loans_advances">Loans & Advances</option>
                <option value="statutory">Statutory</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Linked ledger/account</label>
              <select
                className={inputCls}
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                <option value="">— None —</option>
                {ledgerOptions.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.affectsNetSalary}
                    onChange={(e) => setForm({ ...form, affectsNetSalary: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    Affects net salary
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.ssfApplicable}
                    onChange={(e) => setForm({ ...form, ssfApplicable: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    SSF applicable
                    <span className="block text-[10px] text-gray-500 font-normal">
                      Social Security Fund
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.citApplicable}
                    onChange={(e) => setForm({ ...form, citApplicable: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    CIT applicable
                    <span className="block text-[10px] text-gray-500 font-normal">
                      Citizen Investment Trust
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.incomeTaxApplicable}
                    onChange={(e) => setForm({ ...form, incomeTaxApplicable: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    Income tax (TDS) applicable
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.pfApplicable}
                    onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    PF applicable
                    <span className="block text-[10px] text-gray-500 font-normal">
                      Provident Fund
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] mt-0.5"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">
                    Active
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Calculation type</label>
                <select
                  className={inputCls}
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
                <label className={labelCls}>Calculation period</label>
                <select
                  className={inputCls}
                  value={form.calculationPeriod}
                  onChange={(e) => setForm({ ...form, calculationPeriod: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            {(form.calculationType === "flat_rate" ||
              form.calculationType === "attendance_based") && (
              <div>
                <label className={labelCls}>Rate (NPR)</label>
                <input
                  type="number"
                  className={`${inputCls} font-mono`}
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step="any"
                  placeholder="0.00"
                />
              </div>
            )}

            {(form.calculationType === "pct_of_basic" ||
              form.calculationType === "pct_of_gross") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Percentage</label>
                  <input
                    type="number"
                    className={`${inputCls} font-mono`}
                    value={form.percentage}
                    onChange={(e) =>
                      setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Based on pay head</label>
                  <select
                    className={inputCls}
                    value={form.basedOnPayHeadId}
                    onChange={(e) => setForm({ ...form, basedOnPayHeadId: e.target.value })}
                  >
                    <option value="">— Select pay head —</option>
                    {(payHeads || [])
                      .filter((ph) => ph.id !== selected?.id)
                      .map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {form.calculationType === "formula" && (
              <div>
                <label className={labelCls}>Formula</label>
                <textarea
                  className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none h-16"
                  value={form.formula}
                  onChange={(e) => setForm({ ...form, formula: e.target.value })}
                  placeholder="Enter formula..."
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Rounding method</label>
              <select
                className={inputCls}
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

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayHeadMaster;
