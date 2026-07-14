// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { FileText, Plus, Eye, CheckCircle, XCircle, Calendar, Trash2 } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const OptionalVouchers: React.FC = () => {
  const { vouchers, scenarios, addVoucher, updateVoucher, accounts, currentFiscalYear } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [form, setForm] = useState({
    scenarioId: "",
    referenceNo: "",
    date: new Date().toISOString().split("T")[0],
    narration: "",
    lines: [{ id: generateId(), accountId: "", debit: 0, credit: 0 }],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter optional vouchers (and converted ones for the register)
  const optionalVouchers = vouchers.filter(
    (v) => v.isOptional || v.status === "optional" || v.convertedDate,
  );

  // Handle form changes
  const handleFormChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Clear error when field is changed
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle line changes
  const handleLineChange = (index: number, field: string, value: any) => {
    setForm((prev) => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, lines: newLines };
    });
  };

  // Add new line
  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: generateId(), accountId: "", debit: 0, credit: 0 }],
    }));
  };

  // Remove line
  const removeLine = (index: number) => {
    if (form.lines.length > 1) {
      setForm((prev) => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index),
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.scenarioId) {
      newErrors.scenarioId = "Scenario is required";
    }

    if (!form.date) {
      newErrors.date = "Date is required";
    }

    if (!form.narration.trim()) {
      newErrors.narration = "Narration is required";
    }

    // Validate lines
    let totalDebit = 0;
    let totalCredit = 0;

    form.lines.forEach((line, index) => {
      if (!line.accountId) {
        newErrors[`account-${index}`] = "Account is required";
      }

      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (isNaN(debit) || debit < 0) {
        newErrors[`debit-${index}`] = "Invalid debit amount";
      }

      if (isNaN(credit) || credit < 0) {
        newErrors[`credit-${index}`] = "Invalid credit amount";
      }

      totalDebit += debit;
      totalCredit += credit;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      newErrors.lines = "Total debits must equal total credits";
    }

    if (totalDebit === 0) {
      newErrors.lines = "Amount must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save voucher
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await addVoucher({
        id: editingVoucher?.id || generateId(),
        isOptional: true,
        scenarioId: form.scenarioId,
        referenceNo: form.referenceNo,
        date: form.date,
        narration: form.narration,
        status: "optional",
        type: "journal",
        lines: form.lines,
        totalDebit: form.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
        totalCredit: form.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
      });

      toast.success("Optional voucher saved successfully");
      setShowForm(false);
      setEditingVoucher(null);
      setForm({
        scenarioId: "",
        referenceNo: "",
        date: new Date().toISOString().split("T")[0],
        narration: "",
        lines: [{ id: generateId(), accountId: "", debit: 0, credit: 0 }],
      });
      // Return to list tab if we were creating/editing from a modal approach
      if (activeTab === 1 && !editingVoucher) {
        setActiveTab(0);
      }
    } catch (error) {
      toast.error("Failed to save optional voucher");
    }
  };

  // Convert to actual voucher
  const handleConvert = async (voucherId: string) => {
    if (
      window.confirm("Are you sure you want to convert this optional voucher to an actual voucher?")
    ) {
      try {
        const voucher = await getDB().vouchers.get(voucherId);
        if (!voucher) throw new Error("Voucher not found");
        await updateVoucher(voucherId, {
          isOptional: false,
          status: "posted",
          convertedDate: new Date().toISOString(),
        });

        toast.success("Voucher converted to actual successfully");
        // We'd ideally need to update the store here for immediate UI reflection if the store doesn't auto-sync
        // Since we don't have a direct method to update a single voucher in store, relying on reload or store subscription
      } catch (error) {
        toast.error("Failed to convert voucher");
      }
    }
  };

  // Cancel voucher
  const handleCancel = async (voucherId: string) => {
    if (window.confirm("Are you sure you want to cancel this optional voucher?")) {
      try {
        const db = getDB();
        await db.vouchers.update(voucherId, { status: "cancelled" });

        toast.success("Optional voucher cancelled successfully");
      } catch (error) {
        toast.error("Failed to cancel voucher");
      }
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return form.lines.reduce(
      (acc, line) => {
        acc.debit += Number(line.debit) || 0;
        acc.credit += Number(line.credit) || 0;
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [form.lines]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Optional Vouchers</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage non-accounting vouchers and forecasting scenarios
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm">
          {["Optional Voucher Register", "Create Optional Voucher"].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === index && !showForm
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => {
                setActiveTab(index);
                setShowForm(false);
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && !showForm && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Optional Voucher Register</h2>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Voucher No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Narration
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Scenario Name
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {optionalVouchers.map((voucher) => {
                    const scenario = scenarios.find((s) => s.id === voucher.scenarioId);
                    const isConverted = voucher.status === "posted" || voucher.convertedDate;

                    return (
                      <tr key={voucher.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">
                          {voucher.voucherNo || "Draft"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.date}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                          {voucher.type}
                        </td>
                        <td
                          className="px-3 py-2.5 text-[12px] text-gray-700 truncate max-w-xs"
                          title={voucher.narration}
                        >
                          {voucher.narration}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                          {money(voucher.totalDebit)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {scenario?.name || "N/A"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${isConverted ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {isConverted ? "Converted" : "Optional"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {!isConverted && (
                              <button
                                className="text-green-600 hover:text-green-700 transition-colors"
                                onClick={() => handleConvert(voucher.id)}
                                title="Convert to Actual"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button
                              className="text-[#1557b0] hover:text-[#0f4a96] transition-colors"
                              onClick={() => {
                                setEditingVoucher(voucher);
                                setForm({
                                  scenarioId: voucher.scenarioId || "",
                                  referenceNo: voucher.referenceNo || "",
                                  date: voucher.date,
                                  narration: voucher.narration,
                                  lines: voucher.lines || [],
                                });
                                setErrors({});
                                setShowForm(true);
                              }}
                              title="View/Edit"
                            >
                              <Eye size={14} />
                            </button>
                            {!isConverted && (
                              <button
                                className="text-red-600 hover:text-red-700 transition-colors"
                                onClick={() => handleCancel(voucher.id)}
                                title="Cancel"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {optionalVouchers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No optional vouchers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 1 || showForm) && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 max-w-4xl">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
              {editingVoucher ? "View/Edit Optional Voucher" : "Create Optional Voucher"}
            </h2>

            <div className="flex items-center mb-6 p-2 bg-blue-50 border border-blue-100 rounded-md">
              <input
                type="checkbox"
                id="isOptional"
                checked={true}
                readOnly
                className="mr-2 h-4 w-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
              />
              <label htmlFor="isOptional" className="text-[12px] text-blue-800 font-medium">
                This is an Optional Voucher (will not affect regular accounting books)
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Scenario <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.scenarioId}
                  onChange={(e) => handleFormChange("scenarioId", e.target.value)}
                  className={`h-8 px-2.5 text-[12px] border ${errors.scenarioId ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
                >
                  <option value="">Select Scenario</option>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
                {errors.scenarioId && (
                  <div className="text-[10px] text-red-500 mt-1">{errors.scenarioId}</div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Reference/Quote No
                </label>
                <input
                  type="text"
                  value={form.referenceNo}
                  onChange={(e) => handleFormChange("referenceNo", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Voucher Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleFormChange("date", e.target.value)}
                  className={`h-8 px-2.5 text-[12px] border ${errors.date ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
                />
                {errors.date && <div className="text-[10px] text-red-500 mt-1">{errors.date}</div>}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Narration <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.narration}
                onChange={(e) => handleFormChange("narration", e.target.value)}
                className={`p-2 text-[12px] border ${errors.narration ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full h-16 resize-none`}
              />
              {errors.narration && (
                <div className="text-[10px] text-red-500 mt-1">{errors.narration}</div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[12px] font-semibold text-gray-800">Journal Lines</label>
                <button
                  type="button"
                  className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm"
                  onClick={addLine}
                >
                  Add Line
                </button>
              </div>

              {errors.lines && (
                <div className="text-[10px] text-red-500 mb-2 p-1.5 bg-red-50 rounded border border-red-100">
                  {errors.lines}
                </div>
              )}

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Account <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                        Dr Amount
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                        Cr Amount
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, index) => (
                      <tr key={line.id} className="border-b border-gray-100 bg-white">
                        <td className="px-3 py-2 align-top">
                          <select
                            value={line.accountId}
                            onChange={(e) => handleLineChange(index, "accountId", e.target.value)}
                            className={`h-8 px-2.5 text-[12px] border ${errors[`account-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
                          >
                            <option value="">Select Account</option>
                            {accounts
                              .filter((a) => a.isActive)
                              .map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                          </select>
                          {errors[`account-${index}`] && (
                            <div className="text-[10px] text-red-500 mt-1">
                              {errors[`account-${index}`]}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            step="0.01"
                            value={line.debit}
                            onChange={(e) => handleLineChange(index, "debit", e.target.value)}
                            className={`h-8 px-2.5 text-[12px] border ${errors[`debit-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white text-right focus:outline-none focus:ring-2 w-full`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            step="0.01"
                            value={line.credit}
                            onChange={(e) => handleLineChange(index, "credit", e.target.value)}
                            className={`h-8 px-2.5 text-[12px] border ${errors[`credit-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"} rounded-md bg-white text-right focus:outline-none focus:ring-2 w-full`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-center">
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            onClick={() => removeLine(index)}
                            disabled={form.lines.length <= 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-3 p-3 bg-[#f5f6fa] border border-gray-200 rounded-md">
                <div className="flex items-center gap-6 text-[12px] font-semibold text-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Total Debit:</span>
                    <span>{money(totals.debit)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Total Credit:</span>
                    <span>{money(totals.credit)}</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 ${Math.abs(totals.debit - totals.credit) > 0.01 ? "text-red-600" : "text-green-600"}`}
                  >
                    <span className="text-gray-500">Diff:</span>
                    <span>{money(Math.abs(totals.debit - totals.credit))}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowForm(false);
                  setEditingVoucher(null);
                  if (activeTab !== 1) {
                    setActiveTab(0);
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                onClick={handleSave}
              >
                Save Optional Voucher
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionalVouchers;
