/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Receipt Voucher Form — records money coming IN (customer payments, income,
 * deposits). Mirror image of the Payment Voucher. Auto-builds a balanced
 * double-entry journal:
 *   Cash / Bank A/C ............. Dr (net received)
 *   TDS Receivable A/C .......... Dr (tds deducted at source by payer)
 *       Income / Asset A/C ...... Cr (source of money)
 *
 * Invoice settlement: outstanding sales invoices for the selected party can be
 * ticked and are marked paid on save.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "../../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  AccountSelect,
  PartySelect,
  NepaliDatePicker,
  ConfirmDialog,
  NarrationInput,
} from "../ui";
import {
  Download,
  Plus,
  X,
  Save,
  CheckCircle2,
  ArrowLeft,
  Banknote,
  Landmark,
  FileCheck2,
  Printer,
  FileText,
} from "lucide-react";
import { formatNumber } from "../../lib/utils";
import { ADToBSString } from "../../lib/nepaliDate";
import { generateVoucherNo } from "../../lib/accounting";
import { generateVoucherPDF } from "../../lib/printUtils";
import { VoucherType, VoucherStatus, AccountType, PaymentStatus } from "../../lib/types";
import toast from "react-hot-toast";

interface ReceiptVoucherFormProps {
  voucherId?: string;
  onSave?: (v: any) => void;
  onCancel?: () => void;
}

const MAX_ROWS = 100;

const NARRATION_TEMPLATES = [
  "Being payment received",
  "Being amount received from customer",
  "Being income received",
  "Being advance received",
  "Being deposit received",
  "Being interest received",
  "Being rent received",
  "Being amount received against invoice",
];

const emptyLine = () => ({
  key: Math.random().toString(36).slice(2),
  accountId: "",
  costCenterId: "",
  narration: "",
  billRefNo: "",
  amount: 0,
});

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const ReceiptVoucherForm: React.FC<ReceiptVoucherFormProps> = ({ voucherId, onSave, onCancel }) => {
  const {
    vouchers,
    accounts,
    parties,
    invoices,
    costCenters,
    companySettings,
    currentFiscalYear,
    addVoucher,
    updateVoucher,
    updateInvoice,
    addBillAllocation,
    getBillAllocationsForInvoice,
  } = useStore();

  const isEdit = !!voucherId;
  const existing = useMemo(() => vouchers.find((v) => v.id === voucherId), [vouchers, voucherId]);
  const isCancelled = existing?.status === VoucherStatus.CANCELLED;
  const readOnly = isCancelled;

  const enableCostCenter = !!companySettings?.enableCostCenter;
  const enableBillWise = !!companySettings?.enableBillWiseTracking;
  const symbol = companySettings?.currencySymbol || "Rs.";

  // Cash & bank ledgers + special accounts
  const cashAccount = useMemo(
    () =>
      accounts.find((a) => a.id === "acc-cash") ||
      accounts.find((a) => a.group === "Cash-in-Hand" && !a.isGroup),
    [accounts],
  );
  const bankLedgers = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isGroup &&
          a.isActive &&
          (a.parentId === "grp-bank-accounts" || a.group === "Bank Accounts"),
      ),
    [accounts],
  );
  const tdsReceivableId = useMemo(
    () =>
      accounts.find((a) => a.id === "acc-tds-receivable")?.id ||
      accounts.find((a) => a.id === "acc-tds-payable")?.id ||
      "",
    [accounts],
  );

  // ---- header state ----
  const [date, setDate] = useState(() => existing?.date || new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState(existing?.referenceNo || "");
  const [narration, setNarration] = useState(existing?.narration || "");

  // ---- receipt details ----
  const [payMode, setPayMode] = useState<"cash" | "bank" | "cheque">(
    existing?.paymentModeUI || "cash",
  );
  const [bankAccountId, setBankAccountId] = useState(
    existing?.bankLedgerId || bankLedgers[0]?.id || "",
  );
  const [chequeNo, setChequeNo] = useState(existing?.chequeNo || "");
  const [chequeDate, setChequeDate] = useState(
    existing?.chequeDate || new Date().toISOString().split("T")[0],
  );

  // ---- received-from ----
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const party = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId]);

  // ---- TDS (deducted at source by payer) ----
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsRate, setTdsRate] = useState(0);

  useEffect(() => {
    if (party?.subjectToTds) {
      setTdsEnabled(true);
      setTdsRate(party.tdsRate || 0);
    } else {
      setTdsEnabled(false);
      setTdsRate(0);
    }
  }, [partyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- outstanding invoices for the selected party ----
  const outstandingInvoices = useMemo(() => {
    if (!partyId) return [];
    return invoices
      .filter(
        (inv) =>
          inv.partyId === partyId &&
          inv.type === VoucherType.SALES_INVOICE &&
          inv.status === VoucherStatus.POSTED &&
          inv.paymentStatus !== PaymentStatus.PAID,
      )
      .map((inv) => {
        const allocations = getBillAllocationsForInvoice(inv.id);
        const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
        const balance = inv.grandTotal - (inv.paidAmount || 0);
        return { ...inv, balance, totalAllocated };
      });
  }, [invoices, partyId, getBillAllocationsForInvoice]);

  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<string, number>>({});

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  // reset invoice selection and allocations when party changes
  useEffect(() => {
    setSelectedInvoiceIds([]);
    setInvoiceAllocations({});
  }, [partyId]);

  const dueOf = (inv: any) => round2((inv.grandTotal || 0) - (inv.paidAmount || 0));

  const updateAllocation = (invId: string, amount: number) => {
    setInvoiceAllocations((prev) => ({ ...prev, [invId]: amount }));
    markDirty();
  };

  const toggleInvoice = (inv: any) => {
    setSelectedInvoiceIds((prev) => {
      if (prev.includes(inv.id)) {
        // Remove allocation when unchecking
        const { [inv.id]: _, ...rest } = invoiceAllocations;
        setInvoiceAllocations(rest);
        return prev.filter((id) => id !== inv.id);
      } else {
        // Auto-fill with balance when checking
        setInvoiceAllocations((prev) => ({ ...prev, [inv.id]: inv.balance }));
        return [...prev, inv.id];
      }
    });
    markDirty();
  };

  // ---- lines ----
  const [lines, setLines] = useState<any[]>(() => {
    if (existing?.lines?.length) {
      // reconstruct receipt lines from the credit legs of the stored journal
      const credits = existing?.lines?.filter((l) => Number(l.credit) > 0) || [];
      if (credits.length) {
        return credits.map((l) => ({
          key: Math.random().toString(36).slice(2),
          accountId: l.accountId,
          costCenterId: l.costCenterId || "",
          narration: l.narration || "",
          billRefNo: l.billRefNo || "",
          amount: Number(l.credit) || 0,
        }));
      }
    }
    return [emptyLine()];
  });

  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState<any | null>(null);

  const markDirty = () => setDirty(true);

  const [overrideVoucherNo, setOverrideVoucherNo] = useState(false);
  const [customVoucherNo, setCustomVoucherNo] = useState("");

  const autoVoucherNo = useMemo(() => {
    if (existing?.voucherNo) return existing.voucherNo;
    const fyShort = currentFiscalYear?.name
      ? currentFiscalYear.name.split("/").pop()?.slice(-2) || "81"
      : "81";
    const prefix = `RV-${fyShort}-`;
    const matchingVouchers = vouchers.filter(
      (v) => v.type === VoucherType.RECEIPT && v.voucherNo.startsWith(prefix),
    );
    let maxSeq = 0;
    for (const v of matchingVouchers) {
      const seqStr = v.voucherNo.slice(prefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(4, "0");
    return `${prefix}${nextSeq}`;
  }, [existing, currentFiscalYear, vouchers]);

  useEffect(() => {
    if (!overrideVoucherNo && !isEdit) {
      setCustomVoucherNo(autoVoucherNo);
    }
  }, [autoVoucherNo, overrideVoucherNo, isEdit]);

  useEffect(() => {
    if (existing?.voucherNo) {
      setCustomVoucherNo(existing.voucherNo);
    }
  }, [existing]);

  const activeVoucherNo = overrideVoucherNo ? customVoucherNo : autoVoucherNo;

  // ---- totals ----
  const selectedInvoiceTotal = useMemo(
    () => round2(Object.values(invoiceAllocations).reduce((s, amt) => s + amt, 0)),
    [invoiceAllocations],
  );

  const totals = useMemo(() => {
    const gross = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const tds = tdsEnabled ? round2((gross * (Number(tdsRate) || 0)) / 100) : 0;
    const net = round2(gross - tds);
    return { gross, tds, net };
  }, [lines, tdsEnabled, tdsRate]);

  // ---- line helpers ----
  const updateLine = (idx: number, field: string, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
    markDirty();
  };
  const addRow = useCallback(() => {
    setLines((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, emptyLine()]));
    markDirty();
  }, []);
  const removeRow = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
    markDirty();
  };

  const costCenterOptions = useMemo(
    () =>
      costCenters
        .filter((c) => c.isActive && c.level !== "group")
        .map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
    [costCenters],
  );

  // ---- validation ----
  const validate = (forPost: boolean): string | null => {
    const filled = lines.filter((l) => l.accountId || Number(l.amount));
    if (filled.length < 1) return "At least one receipt line is required.";
    for (const l of filled) {
      if (!l.accountId) return "Each line must have an account selected.";
      if (!(Number(l.amount) > 0)) return "Each line must have an amount greater than zero.";
    }
    if (totals.gross <= 0) return "Total received amount must be greater than zero.";

    // Validate bill allocations if any invoices are selected
    if (selectedInvoiceIds.length > 0) {
      const totalAllocated = selectedInvoiceTotal;
      if (Math.abs(totalAllocated - totals.gross) > 0.01) {
        return `Bill allocations (${symbol}${formatNumber(totalAllocated)}) must equal total receipt amount (${symbol}${formatNumber(totals.gross)})`;
      }
      for (const invId of selectedInvoiceIds) {
        const amount = invoiceAllocations[invId] || 0;
        if (amount <= 0) {
          return "All selected invoices must have allocation amount greater than zero.";
        }
        const inv = outstandingInvoices.find((i) => i.id === invId);
        if (inv && amount > inv.balance) {
          return `Allocation for ${inv.invoiceNo} (${symbol}${formatNumber(amount)}) exceeds balance due (${symbol}${formatNumber(inv.balance)})`;
        }
      }
    }

    if (!date) return "Receipt date is required.";
    const today = new Date().toISOString().split("T")[0];
    if (date > today) return "Date cannot be in the future.";
    if (
      currentFiscalYear &&
      (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate)
    ) {
      return `Date must be within the current fiscal year (${currentFiscalYear.name}).`;
    }
    if (payMode === "cash" && !cashAccount) return "No Cash ledger configured.";
    if ((payMode === "bank" || payMode === "cheque") && !bankAccountId)
      return "Select a bank account.";
    if (payMode === "cheque" && !chequeNo.trim())
      return "Cheque number is required for cheque receipts.";
    if (tdsEnabled && !tdsReceivableId)
      return "TDS Receivable ledger not found in chart of accounts.";
    if (forPost) {
      const inactive = filled.find((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return acc && acc.isActive === false;
      });
      if (inactive) return "Cannot post: one or more selected accounts are inactive.";
    }
    return null;
  };

  const debitLedgerId = payMode === "cash" ? cashAccount?.id : bankAccountId;
  const debitLedgerName = useMemo(
    () => accounts.find((a) => a.id === debitLedgerId)?.name || "",
    [accounts, debitLedgerId],
  );

  const buildPayload = (status: VoucherStatus) => {
    const creditLines = lines
      .filter((l) => l.accountId || Number(l.amount))
      .map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountId: l.accountId,
          accountName: acc?.name || "",
          debit: 0,
          credit: round2(l.amount),
          narration: l.narration?.trim() || undefined,
          costCenterId: l.costCenterId || undefined,
          billRefNo: l.billRefNo?.trim() || undefined,
        };
      });

    const debitLines: any[] = [
      {
        accountId: debitLedgerId,
        accountName: debitLedgerName,
        debit: totals.net,
        credit: 0,
        narration: payMode === "cheque" ? `Cheque No. ${chequeNo}` : undefined,
      },
    ];
    if (tdsEnabled && totals.tds > 0) {
      debitLines.push({
        accountId: tdsReceivableId,
        accountName: "TDS Receivable A/C",
        debit: totals.tds,
        credit: 0,
        narration: `TDS @ ${tdsRate}% deducted at source`,
      });
    }

    return {
      date,
      dateNepali: ADToBSString(date) || "",
      type: VoucherType.RECEIPT,
      voucherNo: activeVoucherNo,
      narration: narration.trim() || `Receipt ${activeVoucherNo}`,
      referenceNo: referenceNo.trim() || undefined,
      partyId: partyId || undefined,
      partyName: party?.name || undefined,
      partyPan: party?.pan || undefined,
      lines: [...debitLines, ...creditLines],
      status,
      // receipt-specific metadata (persisted for edit reconstruction)
      paymentModeUI: payMode,
      bankLedgerId: payMode === "cash" ? undefined : bankAccountId,
      chequeNo: payMode === "cheque" ? chequeNo.trim() : undefined,
      chequeDate: payMode === "cheque" ? chequeDate : undefined,
      tdsRate: tdsEnabled ? tdsRate : undefined,
      tdsAmount: tdsEnabled ? totals.tds : undefined,
      settledInvoiceIds: selectedInvoiceIds.length ? [...selectedInvoiceIds] : undefined,
    };
  };

  const settleInvoices = async (voucherId: string) => {
    if (!selectedInvoiceIds.length) return;
    for (const invId of selectedInvoiceIds) {
      const inv = outstandingInvoices.find((i) => i.id === invId);
      if (!inv) continue;

      const allocatedAmount = invoiceAllocations[invId] || 0;
      if (allocatedAmount <= 0) continue;

      const newPaidAmount = round2((inv.paidAmount || 0) + allocatedAmount);
      const balance = round2(inv.grandTotal - newPaidAmount);

      // Create bill allocation record
      await addBillAllocation({
        voucherId,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        partyId: inv.partyId,
        originalAmount: inv.grandTotal,
        allocatedAmount,
        balanceLeft: balance,
        allocationDate: date,
      });

      // Update invoice payment status
      let newStatus = inv.paymentStatus;
      if (Math.abs(balance) < 0.01) {
        newStatus = PaymentStatus.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.UNPAID;
      }

      await updateInvoice(inv.id, {
        paidAmount: newPaidAmount,
        paymentStatus: newStatus,
      });
    }
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
          totalDebit: round2(totalDr),
          totalCredit: round2(totalCr),
        });
        result = { ...existing, ...payload, id: voucherId };
        toast.success(
          status === VoucherStatus.POSTED ? "Receipt voucher updated & posted." : "Draft updated.",
        );
      } else {
        result = await addVoucher(payload);
        toast.success(status === VoucherStatus.POSTED ? "Receipt voucher posted." : "Draft saved.");
      }
      if (status === VoucherStatus.POSTED) {
        await settleInvoices(result.id);
      }
      setDirty(false);
      setSavedVoucher(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to save receipt voucher.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!savedVoucher) return;
    try {
      const blob = generateVoucherPDF(savedVoucher, companySettings, accounts);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  const handleCancel = () => {
    if (dirty && !readOnly) setConfirmCancel(true);
    else onCancel?.();
  };

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        readOnly ? onCancel?.() : handleCancel();
      } else if (!readOnly && e.key === "F12") {
        e.preventDefault();
        handleSave(VoucherStatus.POSTED);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lines,
    dirty,
    readOnly,
    date,
    referenceNo,
    narration,
    payMode,
    bankAccountId,
    chequeNo,
    partyId,
    tdsEnabled,
    tdsRate,
    selectedInvoiceIds,
  ]);

  const modeButtons: { id: "cash" | "bank" | "cheque"; label: string; icon: any }[] = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "bank", label: "Bank", icon: Landmark },
    { id: "cheque", label: "Cheque", icon: FileCheck2 },
  ];

  // ---- Post-save success screen ----
  if (savedVoucher) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 animate-fadeIn text-center">
        <div className="h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Receipt Voucher Saved</h2>
          <p className="text-xs text-gray-500 mt-1">
            {savedVoucher.voucherNo} · {symbol} {formatNumber(totals.net)} received via{" "}
            {payMode.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            icon={<Printer className="h-4 w-4" />}
          >
            Print Voucher
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSave?.(savedVoucher)}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs select-none relative">
      {isCancelled && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 rotate-[-12deg] pointer-events-none">
          <span className="text-5xl font-bold text-red-500/30 border-4 border-red-500/30 rounded-xl px-8 py-3 tracking-widest">
            CANCELLED
          </span>
        </div>
      )}

      {/* Header */}
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
            <h1 className="text-[13px] font-semibold text-gray-800">Receipt Voucher</h1>
            {isEdit && <p className="text-[11px] text-gray-500 mt-0.5">{activeVoucherNo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            RECEIPT
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

      {/* Top: voucher meta + receipt details */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 w-32 shrink-0">Voucher No</span>
              <input
                type="text"
                value={activeVoucherNo}
                onChange={(e) => setCustomVoucherNo(e.target.value)}
                disabled={!overrideVoucherNo || readOnly}
                className={`h-8 px-2.5 text-[12px] border font-mono font-bold rounded-md w-48 ${
                  overrideVoucherNo
                    ? "border-yellow-450 bg-yellow-50 text-yellow-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-500"
                    : "border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                }`}
              />
              {!readOnly && !isEdit && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideVoucherNo}
                    onChange={(e) => {
                      setOverrideVoucherNo(e.target.checked);
                      if (!e.target.checked) {
                        setCustomVoucherNo(autoVoucherNo);
                      }
                      markDirty();
                    }}
                    className="h-3.5 w-3.5 accent-[#1557b0]"
                  />
                  Override
                </label>
              )}
            </div>
            <Input
              label="Reference No"
              value={referenceNo}
              onChange={(v) => {
                setReferenceNo(v);
                markDirty();
              }}
              placeholder="Optional reference / bill no"
              disabled={readOnly}
            />
            <div>
              <NepaliDatePicker
                label="Receipt Date (BS)"
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

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Payment Mode
              </label>
              <div className="flex gap-2">
                {modeButtons.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setPayMode(id);
                      markDirty();
                    }}
                    className={
                      payMode === id
                        ? "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-[#1557b0] text-white transition-colors"
                        : "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    }
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {payMode === "cash" ? (
              <Input
                label="Cash Account"
                value={cashAccount?.name || "Cash A/C"}
                onChange={() => {}}
                disabled
              />
            ) : (
              <Select
                label="Bank Account"
                options={bankLedgers.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                value={bankAccountId}
                onChange={(v) => {
                  setBankAccountId(v);
                  markDirty();
                }}
                placeholder="Select bank account"
                searchable
                disabled={readOnly}
              />
            )}

            {payMode === "cheque" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cheque No"
                  value={chequeNo}
                  onChange={(v) => {
                    setChequeNo(v);
                    markDirty();
                  }}
                  placeholder="e.g. 000123"
                  disabled={readOnly}
                />
                <div>
                  <NepaliDatePicker
                    label="Cheque Date"
                    value={chequeDate}
                    onChange={(v) => {
                      setChequeDate(v);
                      markDirty();
                    }}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Received from */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-gray-200">
          <PartySelect
            label="Received From (Party) (Optional)"
            value={partyId}
            onChange={(v) => {
              setPartyId(v);
              markDirty();
            }}
            placeholder="Optional — customer / payer"
            disabled={readOnly}
          />
          {party?.subjectToTds && (
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 h-9 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={tdsEnabled}
                  disabled={readOnly}
                  onChange={(e) => {
                    setTdsEnabled(e.target.checked);
                    markDirty();
                  }}
                  className="h-4 w-4 accent-green-600"
                />
                Apply TDS
              </label>
              {tdsEnabled && (
                <div className="w-32">
                  <Input
                    label="TDS Rate %"
                    type="number"
                    value={tdsRate}
                    onChange={(v) => {
                      setTdsRate(parseFloat(v) || 0);
                      markDirty();
                    }}
                    align="right"
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>
          )}
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
          <NarrationInput
            value={narration}
            onChange={(v) => {
              setNarration(v);
              markDirty();
            }}
            disabled={readOnly}
            voucherType="receipt"
            rows={2}
          />
        </div>
      </Card>

      {/* Outstanding invoice settlement */}
      {!readOnly && enableBillWise && partyId && outstandingInvoices.length > 0 && (
        <Card title={`Outstanding Invoices — ${party?.name || ""}`} padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-amber-50 border-y border-amber-200 text-amber-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">✓</th>
                  <th className="px-3 py-2.5">Invoice No</th>
                  <th className="px-3 py-2.5">Date (BS)</th>
                  <th className="px-3 py-2.5 text-right">Grand Total</th>
                  <th className="px-3 py-2.5 text-right">Already Paid</th>
                  <th className="px-3 py-2.5 text-right">Balance Due</th>
                  <th className="px-3 py-2.5 text-right w-32">Allocate Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {outstandingInvoices.map((inv) => {
                  const checked = selectedInvoiceIds.includes(inv.id);
                  return (
                    <tr
                      key={inv.id}
                      className={`cursor-pointer hover:bg-amber-50/40 ${checked ? "bg-amber-50/60" : ""}`}
                      onClick={() => toggleInvoice(inv)}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInvoice(inv)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 accent-green-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-700">
                        <FileText className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
                        {inv.invoiceNo}
                      </td>
                      <td className="px-3 py-2">{inv.dateNepali || inv.date}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {symbol} {formatNumber(inv.grandTotal || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {symbol} {formatNumber(inv.paidAmount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                        {symbol} {formatNumber(inv.balance)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {checked ? (
                          <input
                            type="number"
                            value={invoiceAllocations[inv.id] || 0}
                            onChange={(e) =>
                              updateAllocation(inv.id, parseFloat(e.target.value) || 0)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full h-8 px-2 text-right font-mono border border-amber-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50"
                            max={inv.balance}
                            min={0}
                            step="0.01"
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50/50">
            <span className="text-[11px] text-gray-500 font-semibold">
              Tick invoices and enter allocation amount. Total allocations must equal receipt
              amount.
            </span>
            <div className="flex items-center gap-4">
              <span
                className={`font-mono font-bold ${Math.abs(selectedInvoiceTotal - totals.gross) < 0.01 ? "text-green-700" : "text-red-600"}`}
              >
                Total Allocated: {symbol} {formatNumber(selectedInvoiceTotal)}
              </span>
              <span className="font-mono font-bold text-green-700">
                Receipt: {symbol} {formatNumber(totals.gross)}
              </span>
              {Math.abs(selectedInvoiceTotal - totals.gross) < 0.01 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Receipt lines */}
      <Card title="Received Into (Credit Accounts)" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-50 border-y border-gray-200 text-gray-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center">#</th>
                <th className="px-2 py-2.5 min-w-[240px]">Account</th>
                {enableCostCenter && <th className="px-2 py-2.5 min-w-[140px]">Cost Center</th>}
                {enableBillWise && <th className="px-2 py-2.5 min-w-[110px]">Bill Ref</th>}
                <th className="px-2 py-2.5 min-w-[160px]">Narration</th>
                <th className="px-2 py-2.5 w-36 text-right">Amount</th>
                <th className="px-2 py-2.5 w-10"></th>
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
                      filterTypes={[AccountType.INCOME, AccountType.ASSET, AccountType.LIABILITY]}
                      placeholder="Income / asset / liability…"
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
                    <NarrationInput
                      value={line.narration}
                      onChange={(v) => updateLine(idx, "narration", v)}
                      disabled={readOnly}
                      voucherType="receipt"
                      rows={1}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={line.amount === 0 ? "" : line.amount}
                      onChange={(e) => updateLine(idx, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      disabled={readOnly}
                      className="w-full h-9 px-2 text-right font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        title="Remove row"
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="flex items-center justify-between p-3 border-t border-gray-200">
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
            <span className="text-[11px] text-gray-400 font-semibold">F12 save · Esc cancel</span>
          </div>
        )}
      </Card>

      {/* Totals & auto-journal preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card border padding="md">
          <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-3">
            Summary
          </h4>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Gross Receipt</span>
              <span className="font-mono font-bold text-slate-700">
                {symbol} {formatNumber(totals.gross)}
              </span>
            </div>
            {tdsEnabled && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Less: TDS @ {tdsRate}%</span>
                <span className="font-mono font-bold text-amber-700">
                  - {symbol} {formatNumber(totals.tds)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
              <span className="text-slate-800 font-bold">Net Amount Received</span>
              <span className="font-mono font-bold text-green-600 text-sm">
                {symbol} {formatNumber(totals.net)}
              </span>
            </div>
          </div>
        </Card>

        <Card border padding="md">
          <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-3">
            Auto Journal Entry
          </h4>
          <div className="flex flex-col gap-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-700">
                {debitLedgerName || (payMode === "cash" ? "Cash A/C" : "Bank A/C")}
              </span>
              <span className="text-blue-700">Dr {formatNumber(totals.net)}</span>
            </div>
            {tdsEnabled && totals.tds > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-700">TDS Receivable A/C</span>
                <span className="text-blue-700">Dr {formatNumber(totals.tds)}</span>
              </div>
            )}
            {lines
              .filter((l) => l.accountId && Number(l.amount) > 0)
              .map((l, i) => {
                const acc = accounts.find((a) => a.id === l.accountId);
                return (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-700 pl-4">{acc?.name || "—"}</span>
                    <span className="text-amber-700">Cr {formatNumber(l.amount)}</span>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      {/* Actions */}
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
              onClick={() => handleSave(VoucherStatus.POSTED)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Post Receipt
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
  );
};

export default ReceiptVoucherForm;
