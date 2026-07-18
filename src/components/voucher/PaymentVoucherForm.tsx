// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Payment Voucher Form — records money going OUT (expenses, supplier payments,
 * bank transfers). Auto-builds a balanced double-entry journal:
 *   Expense / Liability A/C ........ Dr
 *       Cash / Bank A/C ............ Cr (net paid)
 *       TDS Payable A/C ........... Cr (tds withheld)
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
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
} from "../ui";
import {
  Wallet,
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
import { formatNumber } from "@/lib/utils";
import { ADToBSString } from "@/lib/nepaliDate";
import { generateSerialNumber } from "@/lib/accounting";
import { generateVoucherPDF } from "@/lib/printUtils";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  InvoiceStatus,
  AccountType,
  PaymentStatus,
} from "@/lib/types";
import { calculateNepalTds, getApplicableNepalTdsRates } from "@/lib/tdsNepal";
import toast from "@/lib/appToast";
import { postPaymentTransaction } from "@/domains/settlement/postPaymentTransaction";
import { getOrCreateDocumentSettlementState } from "@/domains/settlement/settlementState";
import { getDB, generateId } from "@/lib/db";
import { usePersistedToggle } from "@/hooks/usePersistedToggle";

interface PaymentVoucherFormProps {
  voucherId?: string;
  onSave?: (v: any) => void;
  onCancel?: () => void;
}

const MAX_ROWS = 100;

const NARRATION_TEMPLATES = [
  "Being expenses paid",
  "Being payment made to supplier",
  "Being rent paid",
  "Being salary disbursed",
  "Being utility bill paid",
  "Being advance paid",
  "Being bank charges paid",
  "Being amount transferred",
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

const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({ voucherId, onSave, onCancel }) => {
  const {
    vouchers,
    accounts,
    parties,
    invoices,
    bankAccounts,
    costCenters,
    companySettings,
    currentFiscalYear,
    currentUser,
    addVoucher,
    updateVoucher,
    addBillAllocation,
    updateInvoice,
    getBillAllocationsForInvoice,
  } = useStore();

  const isEdit = !!voucherId;
  const existing = useMemo(() => vouchers.find((v) => v.id === voucherId), [vouchers, voucherId]);
  const isCancelled = existing?.status === VoucherStatus.CANCELLED;
  const readOnly = isCancelled;

  const enableCostCenter = !!companySettings?.enableCostCenter;
  const enableBillWise = !!companySettings?.enableBillWiseTracking;
  const symbol = companySettings?.currencySymbol || "Rs.";
  const [showOptionalCols, setShowOptionalCols] = usePersistedToggle(
    "orbix_txn_payment_optional",
    false,
  );
  const showCostCenterCol = enableCostCenter && showOptionalCols;
  const showBillRefCol = enableBillWise && showOptionalCols;
  const [allocOpen, setAllocOpen] = useState(false);

  // Identify the cash & bank ledgers + special accounts
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
  const tdsPayableId = useMemo(
    () =>
      accounts.find(
        (a) => a.name?.toLowerCase().includes("tds") && a.type === AccountType.LIABILITY,
      )?.id || "acc-tds-payable",
    [accounts],
  );

  // ---- header state ----
  const [date, setDate] = useState(() => existing?.date || new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState(existing?.referenceNo || "");
  const [narration, setNarration] = useState(existing?.narration || "");

  // ---- payment details ----
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

  // ---- paid-to ----
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const party = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId]);

  // ---- TDS ----
  const [tdsSection, setTdsSection] = useState("");

  const tdsOptions = useMemo(() => {
    return getApplicableNepalTdsRates({
      personType: party?.personType || "entity",
      residency: party?.residency || "resident",
    }).map((r) => ({
      value: r.id,
      label: `${r.sectionCode} - ${r.description} (${r.rate ?? "Slab"}%)`,
    }));
  }, [party]);

  // ---- outstanding invoices for the selected party ----
  const outstandingInvoices = useMemo(() => {
    if (!partyId) return [];
    return invoices
      .filter(
        (inv) =>
          inv.partyId === partyId &&
          inv.type === VoucherType.PURCHASE_INVOICE &&
          inv.status === "posted" &&
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
    setAllocOpen(false);
  }, [partyId]);

  useEffect(() => {
    if (partyId && outstandingInvoices.length > 0) {
      setAllocOpen(true);
    }
  }, [partyId, outstandingInvoices.length]);

  const updateAllocation = (invId: string, amount: number) => {
    setInvoiceAllocations((prev) => ({ ...prev, [invId]: amount }));
    markDirty();
  };

  const toggleInvoice = (inv: any) => {
    setSelectedInvoiceIds((prev) => {
      if (prev.includes(inv.id)) {
        const { [inv.id]: _, ...rest } = invoiceAllocations;
        setInvoiceAllocations(rest);
        return prev.filter((id) => id !== inv.id);
      } else {
        setInvoiceAllocations((prev) => ({ ...prev, [inv.id]: inv.balance }));
        return [...prev, inv.id];
      }
    });
    markDirty();
  };

  const selectedInvoiceTotal = useMemo(
    () => round2(Object.values(invoiceAllocations).reduce((s, amt) => s + amt, 0)),
    [invoiceAllocations],
  );

  // ---- lines ----
  const [lines, setLines] = useState<any[]>(() => {
    if (existing?.lines?.length) {
      // reconstruct payment lines from the debit legs of the stored journal
      const debits = existing?.lines?.filter((l) => Number(l.debit) > 0) || [];
      if (debits.length) {
        return debits.map((l) => ({
          key: Math.random().toString(36).slice(2),
          accountId: l.accountId,
          costCenterId: l.costCenterId || "",
          narration: l.narration || "",
          billRefNo: l.billRefNo || "",
          amount: Number(l.debit) || 0,
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

  const [voucherNoPreview, setVoucherNoPreview] = useState(existing?.voucherNo || "Loading...");

  useEffect(() => {
    if (existing?.voucherNo) {
      setVoucherNoPreview(existing.voucherNo);
      return;
    }
    let isActive = true;
    generateSerialNumber(
      VoucherType.PAYMENT,
      undefined,
      currentFiscalYear?.fiscalYearBS || "",
      true,
    )
      .then((num) => {
        if (isActive) setVoucherNoPreview(num);
      })
      .catch(() => {
        if (isActive) setVoucherNoPreview("PV-XXXX");
      });
    return () => {
      isActive = false;
    };
  }, [existing, currentFiscalYear]);

  // ---- totals ----
  const totals = useMemo(() => {
    const gross = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));

    let tds = 0;
    let net = gross;

    if (party?.subjectToTds && tdsSection) {
      const breakdown = calculateNepalTds({
        sectionId: tdsSection,
        grossAmount: gross,
        personType: party.personType || "entity",
        residency: party.residency || "resident",
      });
      if (breakdown.applicable) {
        tds = breakdown.tdsAmount;
        net = breakdown.netPayable;
      }
    }

    return { gross, tds, net };
  }, [lines, party, tdsSection]);

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
    if (filled.length < 1) return "At least one payment line is required.";
    for (const l of filled) {
      if (!l.accountId) return "Each line must have an account selected.";
      if (!(Number(l.amount) > 0)) return "Each line must have an amount greater than zero.";
    }
    if (totals.gross <= 0) return "Total payment amount must be greater than zero.";

    // Validate bill allocations if any invoices are selected
    if (selectedInvoiceIds.length > 0) {
      const totalAllocated = selectedInvoiceTotal;
      if (Math.abs(totalAllocated - totals.gross) > 0.01) {
        return `Bill allocations (${symbol}${formatNumber(totalAllocated)}) must equal total payment amount (${symbol}${formatNumber(totals.gross)})`;
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
    if (!date) return "Payment date is required.";
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
      return "Cheque number is required for cheque payments.";
    if (tdsEnabled && !tdsPayableId) return "TDS Payable ledger not found in chart of accounts.";
    if (forPost) {
      const inactive = filled.find((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return acc && acc.isActive === false;
      });
      if (inactive) return "Cannot post: one or more selected accounts are inactive.";
    }
    return null;
  };

  const creditLedgerId = payMode === "cash" ? cashAccount?.id : bankAccountId;
  const creditLedgerName = useMemo(
    () => accounts.find((a) => a.id === creditLedgerId)?.name || "",
    [accounts, creditLedgerId],
  );

  const buildPayload = (status: VoucherStatus) => {
    const debitLines = lines
      .filter((l) => l.accountId || Number(l.amount))
      .map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountId: l.accountId,
          accountName: acc?.name || "",
          debit: round2(l.amount),
          credit: 0,
          narration: l.narration?.trim() || undefined,
          costCenterId: l.costCenterId || undefined,
          billRefNo: l.billRefNo?.trim() || undefined,
        };
      });

    const creditLines: any[] = [
      {
        accountId: creditLedgerId,
        accountName: creditLedgerName,
        debit: 0,
        credit: totals.net,
        narration: payMode === "cheque" ? `Cheque No. ${chequeNo}` : undefined,
      },
    ];
    if (party?.subjectToTds && totals.tds > 0) {
      const breakdown = calculateNepalTds({
        sectionId: tdsSection,
        grossAmount: totals.gross,
        personType: party.personType || "entity",
        residency: party.residency || "resident",
      });

      creditLines.push({
        accountId: tdsPayableId,
        accountName: "TDS Payable A/C",
        debit: 0,
        credit: totals.tds,
        narration: `TDS @ ${breakdown.rate}%`,
      });
    }

    const payloadTdsRate =
      party?.subjectToTds && tdsSection
        ? calculateNepalTds({
            sectionId: tdsSection,
            grossAmount: totals.gross,
            personType: party.personType || "entity",
            residency: party.residency || "resident",
          }).rate
        : 0;

    return {
      date,
      dateNepali: ADToBSString(date) || "",
      type: VoucherType.PAYMENT,
      narration: narration.trim() || `Payment ${voucherNoPreview}`,
      referenceNo: referenceNo.trim() || undefined,
      partyId: partyId || undefined,
      partyName: party?.name || undefined,
      partyPan: party?.pan || undefined,
      lines: [...debitLines, ...creditLines],
      status,
      // payment-specific metadata (persisted for edit reconstruction)
      paymentModeUI: payMode,
      bankLedgerId: payMode === "cash" ? undefined : bankAccountId,
      chequeNo: payMode === "cheque" ? chequeNo.trim() : undefined,
      chequeDate: payMode === "cheque" ? chequeDate : undefined,
      tdsRate: party?.subjectToTds ? payloadTdsRate : undefined,
      tdsAmount: party?.subjectToTds ? totals.tds : undefined,
      tdsSection: party?.subjectToTds ? tdsSection : undefined,
      grossAmount: totals.gross,
      netPayable: totals.net,
      tdsDeductedFrom: party?.subjectToTds ? partyId : undefined,
    };
  };

  const settleInvoices = async (savedVoucherId: string) => {
    if (!selectedInvoiceIds.length) return;
    for (const invId of selectedInvoiceIds) {
      const inv = outstandingInvoices.find((i) => i.id === invId);
      if (!inv) continue;

      const allocatedAmount = invoiceAllocations[invId] || 0;
      if (allocatedAmount <= 0) continue;

      const newPaidAmount = round2((inv.paidAmount || 0) + allocatedAmount);
      const balance = round2(inv.grandTotal - newPaidAmount);

      await addBillAllocation({
        voucherId: savedVoucherId,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        partyId: inv.partyId,
        originalAmount: inv.grandTotal,
        allocatedAmount,
        balanceLeft: balance,
        allocationDate: date,
      });

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
      // Phase 9: new posted payments go through authoritative settlement engine
      if (!isEdit && status === VoucherStatus.POSTED) {
        const creditLedgerId = payMode === "cash" ? cashAccount?.id : bankAccountId;
        if (!creditLedgerId) {
          toast.error("Cash/Bank ledger is required.");
          return;
        }
        const companyId = String(
          (companySettings as any)?.companyId || (companySettings as any)?.id || "main",
        );
        const db = getDB();
        const allocations = [];
        for (const invId of selectedInvoiceIds) {
          const allocatedAmount = invoiceAllocations[invId] || 0;
          if (allocatedAmount <= 0) continue;
          const state = await getOrCreateDocumentSettlementState(db, companyId, invId);
          allocations.push({
            document_id: invId,
            amount: allocatedAmount.toFixed(2),
            expected_settlement_version: state.settlementVersion,
          });
        }
        const result = await postPaymentTransaction({
          commandId: generateId(),
          requestId: generateId(),
          idempotencyKey: `manual-payment-${generateId()}`,
          companyId,
          financialYearId: currentFiscalYear?.id || null,
          userId: currentUser?.id || "manual-user",
          userRole: currentUser?.role || "accountant",
          source: "manual_form",
          payment: {
            paymentType: allocations.length
              ? "supplier_payment"
              : partyId
                ? "supplier_advance_payment"
                : "expense_payment",
            transactionDate: date,
            partyId: partyId || null,
            cashOrBankAccountId: creditLedgerId,
            amount: totals.net.toFixed(2),
            withholding: totals.tds > 0 ? totals.tds.toFixed(2) : null,
            currency: "NPR",
            narration: narration.trim() || `Payment ${voucherNoPreview}`,
            instrument: {
              instrument_type:
                payMode === "cheque" ? "cheque" : payMode === "bank" ? "bank_transfer" : "cash",
              instrument_no: payMode === "cheque" ? chequeNo.trim() : undefined,
              instrument_date: payMode === "cheque" ? chequeDate : undefined,
            },
            allocations,
          },
        });
        if (result.type !== "posting_completed") {
          toast.error(result.payload.safe_message || "Failed to post payment.");
          return;
        }
        toast.success("Payment voucher posted.");
        setDirty(false);
        setSavedVoucher({
          id: result.payload.voucher_id,
          voucherNo: result.payload.voucher_number,
          status: VoucherStatus.POSTED,
        });
        return;
      }

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
          status === VoucherStatus.POSTED ? "Payment voucher updated & posted." : "Draft updated.",
        );
      } else {
        result = await addVoucher(payload);
        toast.success(status === VoucherStatus.POSTED ? "Payment voucher posted." : "Draft saved.");
      }
      if (status === VoucherStatus.POSTED) {
        await settleInvoices(result.id);
      }
      setDirty(false);
      setSavedVoucher(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to save payment voucher.");
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
          <CheckCircle2 className="h-8 w-8 text-[var(--ds-status-success)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--ds-text-default)]">Pay money saved</h2>
          <p className="text-xs text-[var(--ds-text-default)] mt-1">
            {savedVoucher.voucherNo} · {symbol} {formatNumber(totals.net)} paid via{" "}
            {payMode ? payMode.toUpperCase() : "CASH"}
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

      {/* Compact doc toolbar — title lives on TransactionWorkspace */}
      <div className="flex items-center justify-between py-2 px-3 bg-white border-b border-[var(--ds-border-default)] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="p-2 rounded-md hover:bg-[var(--ds-surface-muted)] text-[var(--ds-text-default)]"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[12px] font-medium text-[var(--ds-text-default)]">
            {voucherNoPreview}
          </span>
        </div>
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
          {existing?.status === VoucherStatus.POSTED
            ? "Posted"
            : existing?.status === VoucherStatus.CANCELLED
              ? "Cancelled"
              : existing?.status === VoucherStatus.DRAFT
                ? "Draft"
                : "New"}
        </Badge>
      </div>

      {/* Top: voucher meta + payment details */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--ds-text-default)] w-32 shrink-0">Voucher No</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--ds-surface-muted)] border border-[var(--ds-border-default)] font-mono font-bold text-[var(--ds-text-default)]">
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
              placeholder="Optional reference / bill no"
              disabled={readOnly}
            />
            <div>
              <NepaliDatePicker
                label="Payment Date (BS)"
                value={date}
                onChange={(v) => {
                  setDate(v);
                  markDirty();
                }}
                required
                disabled={readOnly}
              />
              <p className="text-[12px] text-[var(--ds-text-default)] mt-1 font-semibold">AD: {date}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--ds-text-default)] mb-1.5 block">
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
                        ? "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md bg-[var(--ds-action-primary)] text-white transition-colors"
                        : "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md bg-[var(--ds-surface-muted)] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)] transition-colors"
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

        {/* Paid to */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-[var(--ds-border-default)]">
          <PartySelect
            label="Paid To (Party)"
            value={partyId}
            onChange={(v) => {
              setPartyId(v);
              markDirty();
            }}
            placeholder="Optional — supplier / payee"
            disabled={readOnly}
          />
          {party?.subjectToTds && (
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 h-9 text-xs font-semibold text-[var(--ds-text-default)]">
                <input
                  type="checkbox"
                  checked={tdsEnabled}
                  disabled={readOnly}
                  onChange={(e) => {
                    setTdsEnabled(e.target.checked);
                    markDirty();
                  }}
                  className="h-4 w-4 accent-red-600"
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
            <label className="text-xs font-semibold text-[var(--ds-text-default)]">Narration</label>
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
            placeholder="Describe this payment…"
            className="w-full text-xs font-medium p-3 border border-[var(--ds-border-default)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-border-default)] bg-white disabled:bg-[var(--ds-surface-muted)]"
          />
        </div>
      </Card>

      {/* Outstanding invoice settlement — collapsed chrome until party has bills */}
      {!readOnly && partyId && outstandingInvoices.length > 0 && (
        <div
          className="rounded-[var(--ds-radius-md)] border border-amber-200 bg-[var(--ds-surface)]"
          data-testid="payment-bill-allocation"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-amber-50/50"
            aria-expanded={allocOpen}
            onClick={() => setAllocOpen(!allocOpen)}
          >
            <span>
              <span className="text-[13px] font-semibold text-[var(--ds-text-default)]">
                Bill allocation — {party?.name || "party"}
              </span>
              <span className="mt-0.5 block text-[12px] text-amber-800">
                {outstandingInvoices.length} outstanding invoice
                {outstandingInvoices.length === 1 ? "" : "s"}
              </span>
            </span>
            <span className="text-[12px] font-medium text-[var(--ds-action-primary)]">
              {allocOpen ? "Hide" : "Show"}
            </span>
          </button>
          {allocOpen ? (
            <>
              <div className="overflow-x-auto border-t border-amber-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-amber-50 border-b border-amber-200 text-amber-700 uppercase tracking-wider font-bold">
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
                              className="h-4 w-4 accent-red-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-[var(--ds-text-default)]">
                            {inv.invoiceNo}
                          </td>
                          <td className="px-3 py-2">{inv.dateNepali || inv.date}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {symbol} {formatNumber(inv.grandTotal || 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[var(--ds-text-default)]">
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
                              <span className="text-[var(--ds-text-default)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-3 border-t border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]/50">
                <span className="text-[12px] text-[var(--ds-text-default)] font-semibold">
                  Tick invoices and enter allocation amount. Total allocations must equal payment
                  amount.
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-amber-700">
                    Total Allocated: {symbol} {formatNumber(selectedInvoiceTotal)}
                  </span>
                  <span className="font-mono font-bold text-red-700">
                    Payment: {symbol} {formatNumber(totals.gross)}
                  </span>
                  {Math.abs(selectedInvoiceTotal - totals.gross) < 0.01 ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--ds-status-success)]" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Payment lines */}
      <Card title="Payment For (Debit Accounts)" padding="none">
        {(enableCostCenter || enableBillWise) && (
          <div className="flex items-center justify-end gap-2 border-b border-[var(--ds-border-default)] px-3 py-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowOptionalCols(!showOptionalCols)}
              aria-pressed={showOptionalCols}
            >
              {showOptionalCols ? "Hide optional columns" : "Optional columns"}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[var(--ds-surface-muted)] border-y border-[var(--ds-border-default)] text-[var(--ds-text-default)] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center">#</th>
                <th className="px-2 py-2.5 min-w-[240px]">Account</th>
                {showCostCenterCol && <th className="px-2 py-2.5 min-w-[140px]">Cost Center</th>}
                {showBillRefCol && <th className="px-2 py-2.5 min-w-[110px]">Bill Ref</th>}
                <th className="px-2 py-2.5 min-w-[160px]">Narration</th>
                <th className="px-2 py-2.5 w-36 text-right">Amount</th>
                <th className="px-2 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {lines.map((line, idx) => (
                <tr key={line.key} className="hover:bg-[var(--ds-surface-muted)]/40 align-top">
                  <td className="px-2 py-2 text-center text-[var(--ds-text-default)] font-bold">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <AccountSelect
                      value={line.accountId}
                      onChange={(v) => updateLine(idx, "accountId", v)}
                      filterTypes={[AccountType.EXPENSE, AccountType.LIABILITY, AccountType.ASSET]}
                      placeholder="Expense / liability / asset…"
                      disabled={readOnly}
                    />
                  </td>
                  {showCostCenterCol && (
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
                  {showBillRefCol && (
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
                      type="number"
                      value={line.amount === 0 ? "" : line.amount}
                      onChange={(e) => updateLine(idx, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      disabled={readOnly}
                      className="w-full h-9 px-2 text-right font-mono border border-[var(--ds-border-default)] rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-[var(--ds-surface-muted)]"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        title="Remove row"
                        className="p-1 rounded text-[var(--ds-text-default)] hover:text-red-600 hover:bg-red-50"
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
          <div className="flex items-center justify-between p-3 border-t border-[var(--ds-border-default)]">
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 text-xs text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
            <span className="text-[12px] text-[var(--ds-text-default)] font-semibold">F12 save · Esc cancel</span>
          </div>
        )}
      </Card>

      {/* Totals & auto-journal preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card border padding="md">
          <h4 className="text-[12px] uppercase tracking-wider text-[var(--ds-text-default)] font-bold mb-3">
            Summary
          </h4>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-[var(--ds-text-default)] font-semibold">Total Payment Amount</span>
              <span className="font-mono font-bold text-[var(--ds-text-default)]">
                {symbol} {formatNumber(totals.gross)}
              </span>
            </div>
            {party?.subjectToTds && (
              <>
                <div className="mt-2 mb-2">
                  <label className="text-[12px] font-semibold text-[var(--ds-text-default)] uppercase">
                    TDS Section
                  </label>
                  <select
                    value={tdsSection}
                    onChange={(e) => {
                      setTdsSection(e.target.value);
                      markDirty();
                    }}
                    disabled={readOnly}
                    className="w-full mt-1 h-7 px-2 border border-[var(--ds-border-default)] rounded text-[var(--ds-text-default)] bg-white"
                  >
                    <option value="">-- Select TDS Section --</option>
                    {tdsOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {totals.tds > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span className="font-semibold">Less: TDS Deducted</span>
                    <span className="font-mono font-bold">
                      - {symbol} {formatNumber(totals.tds)}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t border-[var(--ds-border-default)] pt-2 mt-1">
              <span className="text-[var(--ds-text-default)] font-bold">Net Amount Paid</span>
              <span className="font-mono font-bold text-red-600 text-sm">
                {symbol} {formatNumber(totals.net)}
              </span>
            </div>
          </div>
        </Card>

        <Card border padding="md">
          <h4 className="text-[12px] uppercase tracking-wider text-[var(--ds-text-default)] font-bold mb-3">
            Auto Journal Entry
          </h4>
          <div className="flex flex-col gap-1.5 font-mono text-[12px]">
            {lines
              .filter((l) => l.accountId && Number(l.amount) > 0)
              .map((l, i) => {
                const acc = accounts.find((a) => a.id === l.accountId);
                return (
                  <div key={i} className="flex justify-between">
                    <span className="text-[var(--ds-text-default)]">{acc?.name || "—"}</span>
                    <span className="text-[var(--ds-text-default)]">Dr {formatNumber(l.amount)}</span>
                  </div>
                );
              })}
            <div className="flex justify-between">
              <span className="text-[var(--ds-text-default)] pl-4">
                {creditLedgerName || (payMode === "cash" ? "Cash A/C" : "Bank A/C")}
              </span>
              <span className="text-amber-700">Cr {formatNumber(totals.net)}</span>
            </div>
            {totals.tds > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--ds-text-default)] pl-4">TDS Payable A/C</span>
                <span className="text-amber-700">Cr {formatNumber(totals.tds)}</span>
              </div>
            )}
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
              Post Payment
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

export default PaymentVoucherForm;
