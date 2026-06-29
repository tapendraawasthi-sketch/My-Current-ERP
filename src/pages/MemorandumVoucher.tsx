// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  Badge,
  ActionToolbar,
  AmountInput,
} from "../components/ui";
import {
  Plus,
  X,
  Save,
  Printer,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { generateSerialNumber } from "../lib/accounting";
import { VoucherType, VoucherStatus } from "../lib/types";
import {
  calculateVoucherTotals,
  validateVoucherDate,
  formatVoucherDisplayDate,
} from "../lib/voucherUtils";
import toast from "react-hot-toast";

const MemorandumVoucher: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, addVoucher } = useStore();

  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [voucherNumber, setVoucherNumber] = useState<string>("Loading...");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [lines, setLines] = useState<Array<any>>([
    {
      key: Math.random().toString(36).substring(7),
      accountId: "",
      debit: 0,
      credit: 0,
      narration: "",
      costCenterId: "",
    },
  ]);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState<boolean>(false);

  useEffect(() => {
    const generateNumber = async () => {
      try {
        const number = await generateSerialNumber(
          VoucherType.MEMORANDUM,
          undefined,
          currentFiscalYear?.fiscalYearBS,
        );
        setVoucherNumber(number);
      } catch (error) {
        setVoucherNumber("MV-" + Date.now());
      }
    };
    generateNumber();
  }, []);

  const accountOptions = useMemo(() => {
    return accounts.map((acc) => ({ value: acc.id, label: acc.name }));
  }, [accounts]);

  const costCenterOptions = useMemo(() => {
    return []; // Placeholder - would come from store if cost centers exist
  }, []);

  const totals = useMemo(() => {
    const mappedLines = lines.map((line) => ({
      debit: line.debit || 0,
      credit: line.credit || 0,
      amount: Math.max(line.debit || 0, line.credit || 0),
      taxAmount: 0,
    }));
    return calculateVoucherTotals(mappedLines);
  }, [lines]);

  const handleSave = async () => {
    const validation = validateVoucherDate(date, currentFiscalYear);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const validLines = lines.filter((line) => line.accountId);
    if (validLines.length < 2) {
      toast.error("At least 2 ledger entries required");
      return;
    }

    if (!totals.isBalanced) {
      toast.error("Debit and Credit totals must match");
      return;
    }

    if (totals.totalDebit === 0) {
      toast.error("Voucher amount cannot be zero");
      return;
    }

    setSaving(true);

    try {
      const voucher = {
        id: "memo-" + Date.now(),
        type: VoucherType.MEMORANDUM,
        voucherNo: voucherNumber,
        date: date,
        dateNepali: ADToBSString(date),
        lines: lines.map(({ key, ...rest }) => rest),
        narration: narration,
        status: VoucherStatus.DRAFT, // Memos are typically draft until converted
        isOptional: true,
        isPostDated: false,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        grandTotal: totals.totalAmount,
        paidAmount: 0,
        paymentStatus: "non-accounting",
        isNonAccounting: true,
        createdAt: new Date().toISOString(),
      };

      await addVoucher(voucher);
      toast.success(`Memorandum saved — ${voucherNumber} (not posted to books)`);

      // Reset form
      resetForm();

      // Generate new voucher number
      const newNumber = await generateSerialNumber(
        VoucherType.MEMORANDUM,
        undefined,
        currentFiscalYear?.fiscalYearBS,
      );
      setVoucherNumber(newNumber);
    } catch (error) {
      toast.error(error.message || "Failed to save memorandum");
    } finally {
      setSaving(false);
      setDirty(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setReferenceNo("");
    setNarration("");
    setLines([
      {
        key: Math.random().toString(36).substring(7),
        accountId: "",
        debit: 0,
        credit: 0,
        narration: "",
        costCenterId: "",
      },
    ]);
    setDirty(false);
  };

  const handleCancel = () => {
    if (dirty) {
      setShowConfirmCancel(true);
    } else {
      resetForm();
    }
  };

  const confirmCancel = () => {
    resetForm();
    setShowConfirmCancel(false);
  };

  const updateLine = useCallback((index: number, field: string, value: any) => {
    setLines((prev) => {
      const newLines = [...prev];
      const line = { ...newLines[index] };
      line[field] = value;
      newLines[index] = line;
      setDirty(true);
      return newLines;
    });
  }, []);

  const addLine = useCallback(() => {
    if (lines.length >= 50) {
      toast.error("Maximum 50 lines allowed");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).substring(7),
        accountId: "",
        debit: 0,
        credit: 0,
        narration: "",
        costCenterId: "",
      },
    ]);
    setDirty(true);
  }, [lines.length]);

  const removeLine = useCallback(
    (index: number) => {
      if (lines.length <= 1) {
        toast.error("At least one line is required");
        return;
      }
      setLines((prev) => prev.filter((_, i) => i !== index));
      setDirty(true);
    },
    [lines.length],
  );

  const swapDrCr = useCallback((index: number) => {
    setLines((prev) => {
      const newLines = [...prev];
      const line = { ...newLines[index] };
      const temp = line.debit;
      line.debit = line.credit;
      line.credit = temp;
      newLines[index] = line;
      setDirty(true);
      return newLines;
    });
  }, []);

  return (
    <div className="p-4 pr-32">
      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-md mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            ⚠ Memorandum vouchers do not affect books of accounts. They can be converted to regular
            vouchers later.
          </p>
        </div>
      </div>

      {/* Top Bar */}
      <ActionToolbar className="mb-4 sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-amber-700">Memorandum Voucher</h1>
          <Badge variant="outline" className="bg-amber-100 text-amber-700">
            Non-Accounting
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">No: {voucherNumber}</div>
          <NepaliDatePicker value={date} onChange={setDate} className="w-36" />
          <Input
            placeholder="Ref No."
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-32"
          />
        </div>

        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Record Memo (Ctrl+A)
            </>
          )}
        </Button>
      </ActionToolbar>

      {/* Lines Table */}
      <Card className="mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ledger
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Narration
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Swap
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Del
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line, index) => (
                <tr key={line.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Select
                      value={line.accountId}
                      onChange={(value) => updateLine(index, "accountId", value)}
                      options={accountOptions}
                      placeholder="Select ledger"
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.debit}
                      onChange={(value) => updateLine(index, "debit", value)}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.credit}
                      onChange={(value) => updateLine(index, "credit", value)}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Input
                      value={line.narration}
                      onChange={(e) => updateLine(index, "narration", e.target.value)}
                      placeholder="Narration"
                      className="w-40"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => swapDrCr(index)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-4 h-4 rotate-45" />
                    </Button>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4">
          <Button
            variant="outline"
            onClick={addLine}
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Line
          </Button>
        </div>
      </Card>

      {/* Totals Section */}
      <Card className="mb-4 w-80 ml-auto">
        <div className="p-4 space-y-2">
          <div className="flex justify-between">
            <span>Total Debit:</span>
            <span className="font-medium text-green-600">{formatNumber(totals.totalDebit)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Credit:</span>
            <span className="font-medium text-green-600">{formatNumber(totals.totalCredit)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span>Status:</span>
            <span
              className={`font-medium ${totals.isBalanced ? "text-green-600" : "text-red-600"}`}
            >
              {totals.isBalanced ? "Balanced" : `Unbalanced (${formatNumber(totals.difference)})`}
            </span>
          </div>
        </div>
      </Card>

      {/* Narration Section */}
      <Card className="mb-4">
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Narration</label>
          <textarea
            value={narration}
            onChange={(e) => {
              setNarration(e.target.value);
              setDirty(true);
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
            placeholder="Enter narration..."
          />
        </div>
      </Card>

      {/* Bottom Buttons */}
      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          className="text-red-600 border-red-600 hover:bg-red-50"
        >
          Discard
        </Button>

        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Record Memo (Ctrl+A)
            </>
          )}
        </Button>
      </div>

      {/* Confirm Cancel Dialog */}
      {showConfirmCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold">Confirm Discard</h3>
            </div>
            <p className="text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to discard them?
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowConfirmCancel(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmCancel}>
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemorandumVoucher;
