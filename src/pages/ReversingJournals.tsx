// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import {
  Calendar,
  Plus,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  BookOpen,
  FileText,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const ReversingJournals: React.FC = () => {
  const { vouchers, addVoucher, currentFiscalYear, accounts } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [reversingSchedules, setReversingSchedules] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    reversalDate: "",
    narration: "",
    lines: [{ id: generateId(), accountId: "", debit: 0, credit: 0 }],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load reversing schedules from DB
  useEffect(() => {
    const db = getDB();
    db.table("reversingSchedules")
      .toArray()
      .then(setReversingSchedules)
      .catch(() => setReversingSchedules([]));
  }, []);

  // Auto-check for reversals
  useEffect(() => {
    const checkAndProcessReversals = async () => {
      const db = getDB();
      const today = new Date().toISOString().split("T")[0];
      const schedules = await db
        .table("reversingSchedules")
        .where("status")
        .equals("pending")
        .toArray()
        .catch(() => []);

      for (const schedule of schedules) {
        if (schedule.reversalDate <= today) {
          // Find original voucher
          const original = vouchers.find((v) => v.id === schedule.originalVoucherId);
          if (original) {
            // Create mirror voucher (Dr/Cr swapped)
            const reversalLines = (original.lines || []).map((l) => ({
              ...l,
              debit: l.credit || 0,
              credit: l.debit || 0,
              accountId: l.accountId,
            }));

            const reversedVoucher = await addVoucher({
              id: generateId(),
              type: "reversing-journal-reversal",
              status: "posted",
              date: schedule.reversalDate,
              narration: "Auto-reversal of " + (original.voucherNo || original.id),
              lines: reversalLines,
              branchId: original.branchId || readActiveBranchId() || undefined,
            });

            // Mark schedule as processed
            await db
              .table("reversingSchedules")
              .update(schedule.id, {
                status: "processed",
                reversedVoucherId: reversedVoucher.id,
              })
              .catch(() => {});

            toast.success(`Auto-reversed voucher ${original.voucherNo || original.id}`);
          }
        }
      }
    };

    checkAndProcessReversals();
  }, [vouchers, addVoucher]);

  // Filter reversing journals
  const reversingJournals = useMemo(() => {
    return vouchers.filter(
      (v) => v.type === "reversing-journal" && matchBranch(v.branchId),
    );
  }, [vouchers, matchBranch, branchFilter]);

  // Get status info for a schedule
  const getStatusInfo = (schedule: any) => {
    if (schedule.status === "cancelled") {
      return { status: "Cancelled", class: "bg-gray-100 text-gray-600" };
    }

    const today = new Date().toISOString().split("T")[0];
    if (schedule.status === "processed") {
      return { status: "Reversed", class: "bg-blue-100 text-blue-700" };
    }

    if (schedule.reversalDate <= today) {
      return { status: "Active", class: "bg-green-100 text-green-700" };
    }

    return { status: "Active", class: "bg-green-100 text-green-700" };
  };

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

    if (!form.date) {
      newErrors.date = "Date is required";
    }

    if (!form.reversalDate) {
      newErrors.reversalDate = "Reversal date is required";
    } else if (new Date(form.reversalDate) <= new Date(form.date)) {
      newErrors.reversalDate = "Reversal date must be after voucher date";
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save voucher
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Create original voucher
      const newVoucher = await addVoucher({
        id: editingVoucher?.id || generateId(),
        type: "reversing-journal",
        status: "posted",
        date: form.date,
        narration: form.narration,
        lines: form.lines,
        totalDebit: form.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
        totalCredit: form.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
        branchId: editingVoucher?.branchId || readActiveBranchId() || undefined,
      });

      // Save schedule
      const db = getDB();
      await db
        .table("reversingSchedules")
        .add({
          id: generateId(),
          originalVoucherId: newVoucher.id,
          reversalDate: form.reversalDate,
          status: "pending",
        })
        .catch(() => {});

      toast.success("Reversing journal created successfully");
      setShowForm(false);
      setEditingVoucher(null);
      setForm({
        date: new Date().toISOString().split("T")[0],
        reversalDate: "",
        narration: "",
        lines: [{ id: generateId(), accountId: "", debit: 0, credit: 0 }],
      });
    } catch (error) {
      toast.error("Failed to save reversing journal");
    }
  };

  // Cancel voucher (status-only — safe to undo; does not use cancelVoucher reversal)
  const handleCancel = async (voucherId: string) => {
    if (!window.confirm("Are you sure you want to cancel this reversing journal?")) return;
    try {
      const db = getDB();
      const original = await db.vouchers.get(voucherId);
      const prevStatus = original?.status || "draft";
      const schedule = reversingSchedules.find((s) => s.originalVoucherId === voucherId);
      const prevScheduleStatus = schedule?.status;
      await db.vouchers.update(voucherId, { status: "cancelled" });
      if (schedule) {
        await db.table("reversingSchedules").update(schedule.id, { status: "cancelled" });
      }
      toast.undo("Reversing journal cancelled", async () => {
        try {
          await db.vouchers.update(voucherId, { status: prevStatus });
          if (schedule && prevScheduleStatus != null) {
            await db.table("reversingSchedules").update(schedule.id, { status: prevScheduleStatus });
          }
        } catch {
          toast.error("Failed to restore reversing journal");
        }
      });
    } catch {
      toast.error("Failed to cancel reversing journal");
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
    <div className="min-h-screen bg-[var(--ds-canvas)] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Reversing journals</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Journals that auto-reverse.</p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Manage and automate reversing journal entries
            </p>
          </div>
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
        </div>

        {/* List Section */}
        {!showForm && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-700">
                Existing Reversing journals
              </h2>
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={() => {
                  setEditingVoucher(null);
                  setForm({
                    date: new Date().toISOString().split("T")[0],
                    reversalDate: "",
                    narration: "",
                    lines: [{ id: generateId(), accountId: "", debit: 0, credit: 0 }],
                  });
                  setErrors({});
                  setShowForm(true);
                }}
              >
                <Plus size={14} />
                Add Reversing Journal
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Voucher No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Original Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Reversal Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Narration
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Reversed Voucher No
                    </th>
                    <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reversingJournals.map((voucher) => {
                    const schedule = reversingSchedules.find(
                      (s) => s.originalVoucherId === voucher.id,
                    );
                    const statusInfo = schedule
                      ? getStatusInfo(schedule)
                      : { status: "Unknown", class: "bg-gray-100 text-gray-500" };

                    return (
                      <tr key={voucher.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">
                          {voucher.voucherNo}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.date}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {schedule?.reversalDate || "N/A"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 truncate max-w-xs">
                          {voucher.narration}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                          {money(voucher.totalDebit)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`${statusInfo.class} px-2 py-0.5 rounded text-[12px] font-semibold uppercase tracking-wide`}
                          >
                            {statusInfo.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                          {schedule?.reversedVoucherId || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center flex items-center justify-center gap-3">
                          <button
                            className="text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)] transition-colors"
                            onClick={() => {
                              setEditingVoucher(voucher);
                              setForm({
                                date: voucher.date,
                                reversalDate: schedule?.reversalDate || "",
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
                          <button
                            className="text-red-600 hover:text-red-700 transition-colors"
                            onClick={() => handleCancel(voucher.id)}
                            title="Cancel Reversing Journal"
                            disabled={
                              schedule?.status === "cancelled" || schedule?.status === "processed"
                            }
                          >
                            <XCircle
                              size={14}
                              className={
                                schedule?.status === "cancelled" || schedule?.status === "processed"
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {reversingJournals.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No reversing journals found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Form Section */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 max-w-4xl">
            <h2 className="text-[14px] font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-100">
              {editingVoucher ? "View/Edit Reversing Journal" : "Create Reversing Journal"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Voucher Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleFormChange("date", e.target.value)}
                  className={`h-8 px-2.5 text-[12px] border ${errors.date ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
                />
                {errors.date && <div className="text-[12px] text-red-500 mt-1">{errors.date}</div>}
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Reversal Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.reversalDate}
                  onChange={(e) => handleFormChange("reversalDate", e.target.value)}
                  className={`h-8 px-2.5 text-[12px] border ${errors.reversalDate ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
                />
                {errors.reversalDate && (
                  <div className="text-[12px] text-red-500 mt-1">{errors.reversalDate}</div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[12px] font-medium text-gray-600 mb-1">
                Narration <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.narration}
                onChange={(e) => handleFormChange("narration", e.target.value)}
                className={`p-2 text-[12px] border ${errors.narration ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full h-16 resize-none`}
              />
              {errors.narration && (
                <div className="text-[12px] text-red-500 mt-1">{errors.narration}</div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[12px] font-semibold text-gray-700">Journal Lines</label>
                <button
                  type="button"
                  className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  onClick={addLine}
                >
                  Add Line
                </button>
              </div>

              {errors.lines && (
                <div className="text-[12px] text-red-500 mb-2 p-1.5 bg-red-50 rounded border border-red-100">
                  {errors.lines}
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                        Account <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide w-32">
                        Dr Amount
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide w-32">
                        Cr Amount
                      </th>
                      <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-400 uppercase tracking-wide w-12">
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
                            className={`h-8 px-2.5 text-[12px] border ${errors[`account-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white focus:outline-none focus:ring-2 w-full`}
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
                            <div className="text-[12px] text-red-500 mt-1">
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
                            className={`h-8 px-2.5 text-[12px] border ${errors[`debit-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white text-right focus:outline-none focus:ring-2 w-full`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            step="0.01"
                            value={line.credit}
                            onChange={(e) => handleLineChange(index, "credit", e.target.value)}
                            className={`h-8 px-2.5 text-[12px] border ${errors[`credit-${index}`] ? "border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"} rounded-md bg-white text-right focus:outline-none focus:ring-2 w-full`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-center">
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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

              <div className="flex justify-end mt-3 p-3 bg-[var(--ds-canvas)] border border-gray-200 rounded-lg">
                <div className="flex items-center gap-6 text-[12px] font-semibold text-gray-700">
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
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowForm(false);
                  setEditingVoucher(null);
                }}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-lg transition-colors shadow-sm"
                onClick={handleSave}
              >
                Save Reversing Journal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReversingJournals;
