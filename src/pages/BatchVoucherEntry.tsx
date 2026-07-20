// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { Play, CheckCircle, RefreshCw, Plus } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const BatchVoucherEntry: React.FC = () => {
  const { accounts, addVoucher, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions } = useBranchFilter();

  interface BatchRow {
    id: string;
    date: string;
    voucherNo: string;
    drAccountId: string;
    crAccountId: string;
    amount: number;
    narration: string;
    costCenterId: string;
    isValid: boolean | null; // null means not yet validated
    error: string;
  }

  const createEmptyRow = (): BatchRow => ({
    id: generateId(),
    date: currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
    voucherNo: "",
    drAccountId: "",
    crAccountId: "",
    amount: 0,
    narration: "",
    costCenterId: "",
    isValid: null,
    error: "",
  });

  const [rows, setRows] = useState<BatchRow[]>(() =>
    Array.from({ length: 20 }, () => createEmptyRow()),
  );
  const [postingProgress, setPostingProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [validationResult, setValidationResult] = useState<{
    validCount: number;
    errorCount: number;
  }>({ validCount: 0, errorCount: 0 });

  const accountOptions = useMemo(() => {
    return accounts
      .filter((a) => a.isActive)
      .map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
      }));
  }, [accounts]);

  const handleAddRows = () => {
    setRows((prev) => [...prev, ...Array.from({ length: 10 }, () => createEmptyRow())]);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all rows?")) {
      setRows(Array.from({ length: 20 }, () => createEmptyRow()));
      setValidationResult({ validCount: 0, errorCount: 0 });
    }
  };

  const validateRow = (row: BatchRow): { isValid: boolean; error: string } => {
    // Skip completely empty rows that haven't been touched
    if (!row.drAccountId && !row.crAccountId && row.amount === 0 && !row.narration) {
      return { isValid: false, error: "Empty row" };
    }

    if (!row.drAccountId) {
      return { isValid: false, error: "Debit account required" };
    }
    if (!row.crAccountId) {
      return { isValid: false, error: "Credit account required" };
    }
    if (row.amount <= 0) {
      return { isValid: false, error: "Amount must be > 0" };
    }
    if (row.drAccountId === row.crAccountId) {
      return { isValid: false, error: "Dr and Cr accounts must differ" };
    }
    return { isValid: true, error: "" };
  };

  const handleValidateAll = () => {
    let validCount = 0;
    let errorCount = 0;

    const validatedRows = rows.map((row) => {
      // Don't flag completely empty rows as errors unless they have partial data
      const isEmpty = !row.drAccountId && !row.crAccountId && row.amount === 0 && !row.narration;

      if (isEmpty) {
        return { ...row, isValid: null, error: "" };
      }

      const result = validateRow(row);
      if (result.isValid) {
        validCount++;
      } else {
        errorCount++;
      }
      return { ...row, isValid: result.isValid, error: result.error };
    });

    setRows(validatedRows);
    setValidationResult({ validCount, errorCount });
  };

  const handlePostAll = async () => {
    // Force validation first
    let validCount = 0;
    const validatedRows = rows.map((row) => {
      const isEmpty = !row.drAccountId && !row.crAccountId && row.amount === 0 && !row.narration;
      if (isEmpty) return { ...row, isValid: null, error: "" };

      const result = validateRow(row);
      if (result.isValid) validCount++;
      return { ...row, isValid: result.isValid, error: result.error };
    });

    setRows(validatedRows);

    const validRows = validatedRows.filter((r) => r.isValid === true);
    if (validRows.length === 0) {
      toast.error("No valid entries to post");
      return;
    }

    if (!window.confirm(`Are you sure you want to post ${validRows.length} valid vouchers?`)) {
      return;
    }

    setPostingProgress({ current: 0, total: validRows.length });
    const errors = [];
    const successfulRowIds = new Set<string>();

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setPostingProgress({ current: i + 1, total: validRows.length });

      try {
        await addVoucher({
          id: generateId(),
          type: "journal",
          status: "posted",
          date: row.date,
          narration: row.narration,
          branchId: readActiveBranchId() || undefined,
          lines: [
            {
              id: generateId(),
              accountId: row.drAccountId,
              debit: row.amount,
              credit: 0,
              narration: row.narration,
            },
            {
              id: generateId(),
              accountId: row.crAccountId,
              debit: 0,
              credit: row.amount,
              narration: row.narration,
            },
          ],
          totalDebit: row.amount,
          totalCredit: row.amount,
        });
        successfulRowIds.add(row.id);
      } catch (error) {
        errors.push(`Row ${rows.indexOf(row) + 1}: ${error?.message || "Failed to post"}`);
      }
    }

    setPostingProgress(null);

    // Clear successfully posted rows
    setRows((prev) =>
      prev.map((row) => {
        if (successfulRowIds.has(row.id)) {
          return createEmptyRow();
        }
        return row;
      }),
    );

    if (errors.length === 0) {
      toast.success(`Successfully posted ${validRows.length} entries`);
      setValidationResult({
        validCount: 0,
        errorCount: validatedRows.filter((r) => r.isValid === false).length,
      });
    } else {
      toast.error(`Posted ${validRows.length - errors.length} entries. ${errors.length} failed.`);
      console.error(errors);
    }
  };

  const handleCellChange = (rowIndex: number, field: keyof BatchRow, value: any) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [field]: value, isValid: null, error: "" };
    setRows(newRows);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Batch Voucher Entry</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Rapid data entry for multiple journal vouchers
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

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                onClick={handlePostAll}
                disabled={postingProgress !== null}
              >
                {postingProgress ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Posting {postingProgress.current} of {postingProgress.total}
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Post All Valid
                  </>
                )}
              </button>
              <button
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={handleValidateAll}
              >
                <CheckCircle size={14} className="text-gray-500" />
                Validate All
              </button>
              <button
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={handleClearAll}
              >
                Clear All
              </button>
            </div>
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
              onClick={handleAddRows}
            >
              <Plus size={14} className="text-gray-500" />
              Add 10 More Rows
            </button>
          </div>

          {(validationResult.validCount > 0 || validationResult.errorCount > 0) && (
            <div className="mb-4 flex gap-4 text-[12px] font-medium p-2 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-gray-700">Valid: {validationResult.validCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-gray-700">Errors: {validationResult.errorCount}</span>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-4">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-36">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Dr Account
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Cr Account
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-32">
                    Amount
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Narration
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-48">
                    Validation
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  let rowClass = "bg-white border-b border-gray-100";
                  if (row.isValid === false) {
                    rowClass = "bg-red-50 border-b border-red-100";
                  } else if (row.isValid === true) {
                    rowClass = "bg-green-50 border-b border-green-100";
                  }

                  return (
                    <tr key={row.id} className={`${rowClass} hover:opacity-90`}>
                      <td className="px-3 py-2 align-top text-[10px] text-gray-400 font-medium pt-3.5">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => handleCellChange(index, "date", e.target.value)}
                          className={`h-8 px-2.5 text-[12px] border ${row.isValid === false ? "border-red-300" : "border-gray-300"} rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.drAccountId}
                          onChange={(e) => handleCellChange(index, "drAccountId", e.target.value)}
                          className={`h-8 px-2.5 text-[12px] border ${row.isValid === false && !row.drAccountId ? "border-red-500" : row.isValid === false ? "border-red-300" : "border-gray-300"} rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full`}
                        >
                          <option value="">Select Account</option>
                          {accountOptions.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.crAccountId}
                          onChange={(e) => handleCellChange(index, "crAccountId", e.target.value)}
                          className={`h-8 px-2.5 text-[12px] border ${row.isValid === false && (!row.crAccountId || row.drAccountId === row.crAccountId) ? "border-red-500" : row.isValid === false ? "border-red-300" : "border-gray-300"} rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full`}
                        >
                          <option value="">Select Account</option>
                          {accountOptions.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount || ""}
                          placeholder="0.00"
                          onChange={(e) =>
                            handleCellChange(index, "amount", Number(e.target.value) || 0)
                          }
                          className={`h-8 px-2.5 text-[12px] border ${row.isValid === false && row.amount <= 0 ? "border-red-500" : row.isValid === false ? "border-red-300" : "border-gray-300"} rounded-md bg-white text-right focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={row.narration}
                          onChange={(e) => handleCellChange(index, "narration", e.target.value)}
                          className={`h-8 px-2.5 text-[12px] border ${row.isValid === false ? "border-red-300" : "border-gray-300"} rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top pt-3.5">
                        {row.error && (
                          <div className="text-[10px] font-medium text-red-600">{row.error}</div>
                        )}
                        {row.isValid === true && (
                          <div className="text-[10px] font-medium text-green-600 flex items-center gap-1">
                            <CheckCircle size={10} /> Valid
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchVoucherEntry;
