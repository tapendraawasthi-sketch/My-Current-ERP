// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Journal Voucher Form — the core double-entry data entry screen.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStore } from "../../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  AccountSelect,
  NepaliDatePicker,
  ConfirmDialog,
} from "../ui";
import {
  BookOpen,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { formatNumber } from "../../lib/utils";
import { ADToBSString } from "../../lib/nepaliDate";
import { VoucherType, VoucherStatus } from "../../lib/types";
import { generateVoucherNo } from "../../lib/accounting";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../../components/BusyShell";

interface JournalVoucherFormProps {
  voucherId?: string;
  onSave?: (v: any) => void;
  onCancel?: () => void;
}

const MAX_ROWS = 100;

const NARRATION_TEMPLATES = [
  "Being payment received",
  "Being expenses paid",
  "Being amount transferred",
  "Being purchase recorded",
  "Being sales recorded",
  "Being adjustment entry passed",
  "Being depreciation provided",
  "Being opening balance brought forward",
  "Being bank charges debited",
  "Being interest accrued",
];

const emptyLine = () => ({
  key: Math.random().toString(36).slice(2),
  accountId: "",
  subledgerId: "",
  costCenterId: "",
  billRefNo: "",
  narration: "",
  debit: 0,
  credit: 0,
});

const JournalVoucherForm: React.FC<JournalVoucherFormProps> = ({ voucherId, onSave, onCancel }) => {
  const {
    vouchers,
    accounts,
    costCenters,
    companySettings,
    currentFiscalYear,
    addVoucher,
    updateVoucher,
  } = useStore();

  const isEdit = !!voucherId;
  const existing = useMemo(() => vouchers.find((v) => v.id === voucherId), [vouchers, voucherId]);
  const isCancelled = existing?.status === VoucherStatus.CANCELLED;
  const readOnly = isCancelled;

  const enableCostCenter = !!companySettings?.enableCostCenter;
  const enableBillWise = !!companySettings?.enableBillWiseTracking;
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [date, setDate] = useState(() => existing?.date || new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState(existing?.referenceNo || "");
  const [narration, setNarration] = useState(existing?.narration || "");
  const [lines, setLines] = useState<any[]>(() => {
    if (existing?.lines?.length) {
      return existing.lines.map((l) => ({ key: Math.random().toString(36).slice(2), ...l }));
    }
    return [emptyLine(), emptyLine()];
  });
  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);

  const debitRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const creditRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const markDirty = () => setDirty(true);

  // Auto-generated voucher number preview
  const voucherNoPreview = useMemo(() => {
    if (existing?.voucherNo) return existing.voucherNo;
    try {
      const { voucherNo } = generateVoucherNo(
        VoucherType.JOURNAL,
        companySettings?.voucherSeries || {},
        vouchers,
      );
      return voucherNo;
    } catch {
      return "JV-XXXX";
    }
  }, [existing, companySettings, vouchers]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const diff = debit - credit;
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      diff: Math.round(diff * 100) / 100,
      balanced: Math.abs(diff) < 0.01,
    };
  }, [lines]);

  const updateLine = (idx: number, field: string, value: any) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, [field]: value };
        if (field === "debit" && Number(value) > 0) next.credit = 0;
        if (field === "credit" && Number(value) > 0) next.debit = 0;
        return next;
      }),
    );
    markDirty();
  };

  const addRow = useCallback(() => {
    setLines((prev) => {
      if (prev.length >= MAX_ROWS) {
        toast.error(`Maximum ${MAX_ROWS} rows allowed.`);
        return prev;
      }
      return [...prev, emptyLine()];
    });
    markDirty();
  }, []);

  const removeRow = (idx: number) => {
    setLines((prev) => {
      if (prev.length <= 2) {
        toast.error("A journal voucher requires at least 2 lines.");
        return prev;
      }
      return prev.filter((_, i) => i !== idx);
    });
    markDirty();
  };

  const duplicateRow = (idx: number) => {
    setLines((prev) => {
      if (prev.length >= MAX_ROWS) return prev;
      const copy = { ...prev[idx], key: Math.random().toString(36).slice(2) };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    markDirty();
  };

  const focusDebit = (idx: number) => {
    const k = lines[idx]?.key;
    if (k && debitRefs.current[k]) debitRefs.current[k]!.focus();
  };

  // ---- Validation ----
  const validate = (forPost: boolean): string | null => {
    const filled = lines.filter((l) => l.accountId || Number(l.debit) || Number(l.credit));
    if (filled.length < 2) return "At least 2 lines with accounts are required.";
    for (const l of filled) {
      if (!l.accountId) return "Each line must have an account selected.";
    }
    if (!date) return "Posting date is required.";
    const today = new Date().toISOString().split("T")[0];
    if (date > today) return "Date cannot be in the future.";
    if (currentFiscalYear) {
      if (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate) {
        return `Date must be within the current fiscal year (${currentFiscalYear.name}).`;
      }
    }
    if (forPost) {
      if (!totals.balanced) return "Debit and Credit must be equal before posting.";
      const inactive = filled.find((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return acc && acc.isActive === false;
      });
      if (inactive) return "Cannot post: one or more selected accounts are inactive.";
    }
    return null;
  };

  const buildPayload = (status: VoucherStatus) => {
    const cleanLines = lines
      .filter((l) => l.accountId || Number(l.debit) || Number(l.credit))
      .map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountId: l.accountId,
          accountName: acc?.name || "",
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration?.trim() || undefined,
          subledgerId: l.subledgerId || undefined,
          costCenterId: l.costCenterId || undefined,
          billRefNo: l.billRefNo?.trim() || undefined,
        };
      });
    return {
      date,
      dateNepali: ADToBSString(date) || "",
      type: VoucherType.JOURNAL,
      narration: narration.trim(),
      referenceNo: referenceNo.trim() || undefined,
      lines: cleanLines,
      status,
    };
  };

  const handleSave = async (status: VoucherStatus) => {
    const err = validate(status === VoucherStatus.POSTED);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(status);
      let result;
      if (isEdit) {
        const totalDr = payload.lines.reduce((s, l) => s + l.debit, 0);
        const totalCr = payload.lines.reduce((s, l) => s + l.credit, 0);
        await updateVoucher(voucherId!, {
          ...payload,
          totalDebit: Math.round(totalDr * 100) / 100,
          totalCredit: Math.round(totalCr * 100) / 100,
        });
        result = { ...existing, ...payload };
        toast.success(
          status === VoucherStatus.POSTED ? "Voucher updated & posted." : "Draft updated.",
        );
      } else {
        result = await addVoucher(payload);
        toast.success(status === VoucherStatus.POSTED ? "Journal voucher posted." : "Draft saved.");
      }
      setDirty(false);
      onSave?.(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to save voucher.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !readOnly) {
      setConfirmCancel(true);
    } else {
      onCancel?.();
    }
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly) {
        if (e.key === "Escape") onCancel?.();
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        handleSave(VoucherStatus.POSTED);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        const active = document.activeElement as HTMLElement;
        const rowAttr = active?.getAttribute?.("data-row");
        const idx = rowAttr != null ? parseInt(rowAttr, 10) : lines.length - 1;
        duplicateRow(isNaN(idx) ? lines.length - 1 : idx);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, dirty, readOnly, date, referenceNo, narration]);

  const handleAmountKeyDown = (e: React.KeyboardEvent, idx: number, field: "debit" | "credit") => {
    const line = lines[idx];
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "debit") {
        if (Number(line.debit) > 0) {
          // move to next row account / debit
          if (idx === lines.length - 1) addRow();
          setTimeout(() => focusDebit(idx + 1), 0);
        } else {
          const k = line.key;
          creditRefs.current[k]?.focus();
        }
      } else {
        if (idx === lines.length - 1) addRow();
        setTimeout(() => focusDebit(idx + 1), 0);
      }
    } else if (e.key === "Backspace") {
      const empty =
        !line.accountId && !Number(line.debit) && !Number(line.credit) && !line.narration;
      if (empty && (e.target as HTMLInputElement).value === "") {
        e.preventDefault();
        removeRow(idx);
      }
    }
  };

  const costCenterOptions = useMemo(
    () =>
      costCenters
        .filter((c) => c.isActive && c.level !== "group")
        .map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
    [costCenters],
  );

  const colCount = 7 + (enableCostCenter ? 1 : 0) + (enableBillWise ? 1 : 0);

  return (


    <div style={{ background: "#fffbe6", padding: 12 }}>


      <PillTitle title="Add Journal Voucher" />


      <FormPanel>


        <div className="flex flex-col gap-5 animate-fadeIn text-xs select-none relative">
      {isCancelled && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 rotate-[-12deg] pointer-events-none">
          <span className="text-5xl font-bold text-red-500/30 border-4 border-red-500/30 rounded-xl px-8 py-3 tracking-widest">
            CANCELLED
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between py-3 px-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[13px] font-semibold text-gray-800">Journal Voucher</h1>
            {isEdit && <p className="text-[11px] text-gray-500 mt-0.5">{voucherNoPreview}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">
            JOURNAL
          </Badge>
          <Badge
            variant={
              existing?.status === VoucherStatus.POSTED
                ? "success"
                : existing?.status === VoucherStatus.CANCELLED
                  ? "danger"
                  : "default"
            }
            size="sm"
          >
            {(existing?.status || "NEW").toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Header section: 2 columns */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 w-32 shrink-0">
                Voucher Type
              </span>
              <Badge variant="info" size="md">
                Journal Voucher
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 w-32 shrink-0">Voucher No</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-700">
                {voucherNoPreview}
              </span>
            </div>
            <Input
              label="Reference No"
              value={referenceNo}
              onChange={(v) => {
                setReferenceNo(v);
                markDirty();
              }}
              placeholder="Optional reference / document no"
              disabled={readOnly}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <NepaliDatePicker
                label="Voucher Date (BS)"
                value={date}
                onChange={(v) => {
                  setDate(v);
                  markDirty();
                }}
                required
                disabled={readOnly}
              />
              <p className="text-[11px] text-gray-400 mt-1 font-semibold">AD: {date}</p>
            </div>
          </div>
        </div>

        {/* Narration */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Narration</label>
            {!readOnly && (
              <div className="w-56">
                <Select
                  options={NARRATION_TEMPLATES.map((t) => ({ value: t, label: t }))}
                  value=""
                  onChange={(v) => {
                    setNarration(v);
                    markDirty();
                  }}
                  placeholder="Insert template…"
                  searchable
                />
              </div>
            )}
          </div>
          <textarea
            rows={2}
            value={narration}
            onChange={(e) => {
              setNarration(e.target.value);
              markDirty();
            }}
            disabled={readOnly}
            placeholder="Describe this transaction…"
            className="w-full text-xs font-medium p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50"
          />
        </div>
      </Card>

      {/* Accounts grid */}
      <Card title="Account Postings" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-50 border-y border-gray-200 text-gray-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center">#</th>
                <th className="px-2 py-2.5 min-w-[220px]">Account</th>
                <th className="px-2 py-2.5 min-w-[160px]">Sub-Ledger</th>
                {enableCostCenter && <th className="px-2 py-2.5 min-w-[140px]">Cost Center</th>}
                {enableBillWise && <th className="px-2 py-2.5 min-w-[110px]">Bill Ref</th>}
                <th className="px-2 py-2.5 min-w-[140px]">Narration</th>
                <th className="text-right text-[10px] font-semibold text-[#1557b0] uppercase px-3 py-2 w-32">
                  Debit
                </th>
                <th className="text-right text-[10px] font-semibold text-red-600 uppercase px-3 py-2 w-32">
                  Credit
                </th>
                <th className="px-2 py-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {lines.map((line, idx) => (
                <tr key={line.key} className="hover:bg-gray-50/40 align-top">
                  <td className="px-2 py-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <AccountSelect
                      value={line.accountId}
                      onChange={(v) => updateLine(idx, "accountId", v)}
                      placeholder="Select account…"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <AccountSelect
                      value={line.subledgerId}
                      onChange={(v) => updateLine(idx, "subledgerId", v)}
                      placeholder="Optional"
                      disabled={readOnly}
                    />
                  </td>
                  {enableCostCenter && (
                    <td className="px-2 py-2">
                      <Select
                        options={costCenterOptions}
                        value={line.costCenterId}
                        onChange={(v) => updateLine(idx, "costCenterId", v)}
                        placeholder="Optional"
                        searchable
                        disabled={readOnly}
                      />
                    </td>
                  )}
                  {enableBillWise && (
                    <td className="px-2 py-2">
                      <Input
                        value={line.billRefNo}
                        onChange={(v) => updateLine(idx, "billRefNo", v)}
                        placeholder="Bill #"
                        disabled={readOnly}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2">
                    <Input
                      value={line.narration}
                      onChange={(v) => updateLine(idx, "narration", v)}
                      placeholder="Line memo"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      ref={(el) => {
                        debitRefs.current[line.key] = el;
                      }}
                      data-row={idx}
                      type="number"
                      value={line.debit === 0 ? "" : line.debit}
                      onChange={(e) => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleAmountKeyDown(e, idx, "debit")}
                      placeholder="0.00"
                      disabled={readOnly}
                      className="w-full h-9 px-2 text-right font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      ref={(el) => {
                        creditRefs.current[line.key] = el;
                      }}
                      data-row={idx}
                      type="number"
                      value={line.credit === 0 ? "" : line.credit}
                      onChange={(e) => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleAmountKeyDown(e, idx, "credit")}
                      placeholder="0.00"
                      disabled={readOnly}
                      className="w-full h-9 px-2 text-right font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {!readOnly && (
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => duplicateRow(idx)}
                          title="Duplicate (Ctrl+D)"
                          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          title="Remove row"
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-gray-200 font-bold">
              <tr>
                <td
                  colSpan={colCount - 2}
                  className="px-3 py-3 text-right uppercase tracking-wider text-slate-500 text-[11px]"
                >
                  Totals
                </td>
                <td className="px-2 py-3 text-right font-mono text-blue-700">
                  {symbol} {formatNumber(totals.debit)}
                </td>
                <td className="px-2 py-3 text-right font-mono text-amber-700">
                  {symbol} {formatNumber(totals.credit)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!readOnly && (
          <div className="flex items-center justify-between p-3 border-t border-gray-200">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-[11px] text-[#1557b0] hover:text-[#0f4a96] font-medium py-1"
            >
              <Plus className="h-3 w-3" /> Add Line
            </button>
            <span className="text-[11px] text-gray-400 font-semibold">
              {lines.length} rows · Shortcuts: Enter/Tab navigate · Ctrl+D duplicate · F12 save ·
              Esc cancel
            </span>
          </div>
        )}
      </Card>

      {/* Totals & status bar */}
      <Card border padding="md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                Total Debit
              </p>
              <p className="text-base font-bold text-blue-700 font-mono">
                {symbol} {formatNumber(totals.debit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                Total Credit
              </p>
              <p className="text-base font-bold text-amber-700 font-mono">
                {symbol} {formatNumber(totals.credit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                Difference
              </p>
              <p
                className={`text-base font-bold font-mono ${totals.balanced ? "text-green-600" : "text-red-600"}`}
              >
                {symbol} {formatNumber(Math.abs(totals.diff))}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            {totals.balanced ? (
              <div className="px-3 py-1.5 text-[12px] font-semibold rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1.5">
                ✓ Balanced
              </div>
            ) : (
              <div className="px-3 py-1.5 text-[12px] font-semibold rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
                ⚠ Difference: {symbol} {formatNumber(Math.abs(totals.diff))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2.5 pb-6">
        <Button variant="outline" size="sm" onClick={handleCancel} icon={<X className="h-4 w-4" />}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={saving}
              onClick={() => handleSave(VoucherStatus.DRAFT)}
              icon={<Save className="h-4 w-4" />}
            >
              {isEdit ? "Update Draft" : "Save as Draft"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!totals.balanced}
              onClick={() => handleSave(VoucherStatus.POSTED)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Post
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => onCancel?.()}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to leave? All changes will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        danger
      />
    </div>

      </FormPanel>

    </div>
  );
};

export default JournalVoucherForm;
