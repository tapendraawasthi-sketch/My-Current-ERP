/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sales / Purchase Invoice (and Return) entry form.
 * VAT computation comes from taxUtils.computeVAT; posting hands the payload
 * to useStore.addInvoice() which auto-builds the linked journal and stock
 * movements.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "../../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  PartySelect,
  NepaliDatePicker,
  ConfirmDialog,
  AccountSelect,
  NarrationInput,
} from "../ui";
import {
  ArrowLeft,
  Plus,
  Save,
  CheckCircle2,
  Printer,
  Receipt,
  Banknote,
  Landmark,
  CreditCard,
  X,
  Trash2,
} from "lucide-react";
import { formatNumber, numberToWords } from "../../lib/utils";
import { ADToBSString } from "../../lib/nepaliDate";
import { generateInvoiceNo, getAccountRunningBalance } from "../../lib/accounting";
import { computeVAT } from "../../lib/taxUtils";
import { generateInvoicePDF } from "../../lib/printUtils";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  PaymentStatus,
  PartyType,
  TdsType,
  AccountType,
} from "../../lib/types";
import toast from "react-hot-toast";
import InvoiceLineItem, { InvoiceLineState } from "./InvoiceLineItem";
import AttachmentUploader from "../ui/AttachmentUploader";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 10);

const TYPE_MAP: Record<
  string,
  {
    vt: VoucherType;
    label: string;
    party: PartyType;
    color: string;
    isReturn: boolean;
    isSales: boolean;
  }
> = {
  sales: {
    vt: VoucherType.SALES_INVOICE,
    label: "SALES INVOICE",
    party: PartyType.CUSTOMER,
    color: "success",
    isReturn: false,
    isSales: true,
  },
  purchase: {
    vt: VoucherType.PURCHASE_INVOICE,
    label: "PURCHASE INVOICE",
    party: PartyType.SUPPLIER,
    color: "info",
    isReturn: false,
    isSales: false,
  },
  "sales-return": {
    vt: VoucherType.SALES_RETURN,
    label: "SALES RETURN",
    party: PartyType.CUSTOMER,
    color: "warning",
    isReturn: true,
    isSales: true,
  },
  "purchase-return": {
    vt: VoucherType.PURCHASE_RETURN,
    label: "PURCHASE RETURN",
    party: PartyType.SUPPLIER,
    color: "warning",
    isReturn: true,
    isSales: false,
  },
};

interface SalesInvoiceFormProps {
  invoiceId?: string;
  type: "sales" | "purchase" | "sales-return" | "purchase-return";
  onSave?: () => void;
  onCancel?: () => void;
}

const emptyLine = (): InvoiceLineState => ({
  id: uid(),
  itemId: "",
  itemName: "",
  itemCode: "",
  hsnCode: "",
  description: "",
  qty: 1,
  unit: "",
  rate: 0,
  discountPercent: 0,
  isTaxable: true,
  vatRate: 13,
  warehouseId: "",
});

const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({
  invoiceId,
  type,
  onSave,
  onCancel,
}) => {
  const {
    invoices,
    parties,
    accounts,
    warehouses,
    companySettings,
    currentFiscalYear,
    addInvoice,
    updateInvoice,
    items,
    vouchers,
    currencies,
    exchangeRates,
  } = useStore();

  const meta = TYPE_MAP[type];
  const symbol = companySettings?.currencySymbol || "Rs.";

  const existing = useMemo(() => invoices.find((i) => i.id === invoiceId), [invoices, invoiceId]);
  const isEdit = !!existing;
  const isCancelled = existing?.status === VoucherStatus.CANCELLED;
  const readOnly = isCancelled || existing?.status === VoucherStatus.POSTED;

  // bank accounts
  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isGroup &&
          a.isActive &&
          (a.parentId === "grp-bank-accounts" || a.group === "Bank Accounts"),
      ),
    [accounts],
  );

  // ---- header ----
  const [date, setDate] = useState(existing?.date || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(existing?.dueDate || "");
  const [referenceNo, setReferenceNo] = useState(existing?.referenceNo || "");
  const [orderRef, setOrderRef] = useState(existing?.orderRef || "");
  const [challanRef, setChallanRef] = useState(existing?.challanRef || "");
  const [narration, setNarration] = useState(existing?.narration || "");
  const [attachments, setAttachments] = useState<string[]>(existing?.attachments || []);

  // ---- party ----
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const party = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId]);
  const [billTo, setBillTo] = useState(existing?.billTo || party?.address || "");

  useEffect(() => {
    if (party && !isEdit) setBillTo(party.address || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // ---- TDS ----
  const [tdsEnabled, setTdsEnabled] = useState<boolean>(!!existing?.tdsAmount);
  const [tdsType, setTdsType] = useState<TdsType>(existing?.tdsType || TdsType.SERVICE_CONTRACT);
  const [tdsRate, setTdsRate] = useState<number>(existing?.tdsRate || 0);

  useEffect(() => {
    if (!isEdit && party?.subjectToTds) {
      setTdsEnabled(true);
      setTdsType((party.tdsType as TdsType) || TdsType.SERVICE_CONTRACT);
      setTdsRate(Number(party.tdsRate) || 1.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // ---- payment ----
  const [payMode, setPayMode] = useState<PaymentMode>(existing?.paymentMode || PaymentMode.CREDIT);
  const [bankAccountId, setBankAccountId] = useState(
    existing?.bankAccountId || bankAccounts[0]?.id || "",
  );
  const [chequeNo, setChequeNo] = useState(existing?.chequeNo || "");
  const [chequeDate, setChequeDate] = useState(existing?.chequeDate || date);
  const [paidAmount, setPaidAmount] = useState<number>(Number(existing?.paidAmount) || 0);

  // ---- Additional state for features ----
  const [additionalCharges, setAdditionalCharges] = useState<any[]>(() => {
    if (existing?.additionalCharges) return existing.additionalCharges;
    return [];
  });
  const [enableRoundOff, setEnableRoundOff] = useState(
    existing?.roundOff !== undefined ? existing.roundOff !== 0 : true,
  );
  const [currencyCode, setCurrencyCode] = useState(existing?.currencyCode || "NPR");
  const [exchangeRate, setExchangeRate] = useState<number>(existing?.exchangeRate || 1.0);

  const activeCurrencies = useMemo(() => currencies?.filter((c) => c.isActive) || [], [currencies]);

  useEffect(() => {
    if (currencyCode === "NPR") {
      setExchangeRate(1.0);
      return;
    }
    const todayStr = date;
    const rateMatch = exchangeRates?.find(
      (r) => r.currencyCode === currencyCode && r.date <= todayStr,
    );
    if (rateMatch) {
      setExchangeRate(rateMatch.rateToBase);
    } else {
      setExchangeRate(1.0);
    }
  }, [currencyCode, date, exchangeRates]);

  const partyOutstanding = useMemo(() => {
    if (!partyId || !party?.accountId) return 0;
    return getAccountRunningBalance(party.accountId, vouchers);
  }, [partyId, party, vouchers]);

  const addAdditionalCharge = () => {
    setAdditionalCharges((prev) => [
      ...prev,
      { id: uid(), description: "", amount: 0, taxApplicable: false, accountId: "" },
    ]);
    markDirty();
  };

  const updateAdditionalCharge = (id: string, field: string, value: any) => {
    setAdditionalCharges((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    markDirty();
  };

  const removeAdditionalCharge = (id: string) => {
    setAdditionalCharges((prev) => prev.filter((c) => c.id !== id));
    markDirty();
  };

  // ---- lines ----
  const [lines, setLines] = useState<InvoiceLineState[]>(() => {
    if (existing?.lines?.length) {
      return existing.lines.map((l: any) => ({
        id: uid(),
        itemId: l.itemId || "",
        itemName: l.itemName || "",
        itemCode: l.itemCode || "",
        hsnCode: l.hsnCode || "",
        description: l.description || "",
        qty: Number(l.qty) || 0,
        unit: l.unit || "",
        rate: Number(l.rate) || 0,
        discountPercent: Number(l.discountPercent ?? l.discount) || 0,
        discountAmount: Number(l.discountAmount) || 0,
        isTaxable: l.isTaxable ?? true,
        vatRate: Number(l.vatRate ?? 13),
        warehouseId: l.warehouseId || "",
      }));
    }
    const blank = emptyLine();
    blank.discountAmount = 0;
    return [blank];
  });

  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  const markDirty = () => setDirty(true);

  // ---- totals via taxUtils.computeVAT ----
  const computation = useMemo(() => {
    let subTotal = 0;
    let taxableTotal = 0;
    let exemptTotal = 0;
    let vatAmountTotal = 0;
    const computedLines = [];

    const activeLines = lines.filter((l) => l.itemId && Number(l.qty) > 0);
    for (const l of activeLines) {
      const grossVal = round2((Number(l.qty) || 0) * (Number(l.rate) || 0));
      const discAmt = Number(l.discountAmount) || 0;
      const netAmt = round2(grossVal - discAmt);

      subTotal = round2(subTotal + grossVal);

      if (l.isTaxable) {
        const vatVal = round2(netAmt * ((Number(l.vatRate) || 0) / 100));
        taxableTotal = round2(taxableTotal + netAmt);
        vatAmountTotal = round2(vatAmountTotal + vatVal);
        computedLines.push({
          ...l,
          taxableAmount: netAmt,
          exemptAmount: 0,
          vatAmount: vatVal,
          netAmount: round2(netAmt + vatVal),
        });
      } else {
        exemptTotal = round2(exemptTotal + netAmt);
        computedLines.push({
          ...l,
          taxableAmount: 0,
          exemptAmount: netAmt,
          vatAmount: 0,
          netAmount: netAmt,
        });
      }
    }

    const chargesTaxable = additionalCharges
      .filter((c) => c.taxApplicable)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const chargesExempt = additionalCharges
      .filter((c) => !c.taxApplicable)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const chargesVat = round2(chargesTaxable * 0.13);

    const totalTaxableIncludingCharges = round2(taxableTotal + chargesTaxable);
    const totalExemptIncludingCharges = round2(exemptTotal + chargesExempt);
    const totalVatIncludingCharges = round2(vatAmountTotal + chargesVat);

    const grandTotalBeforeRoundOff = round2(
      totalTaxableIncludingCharges + totalVatIncludingCharges + totalExemptIncludingCharges,
    );
    const roundedGrandTotal = enableRoundOff
      ? Math.round(grandTotalBeforeRoundOff)
      : grandTotalBeforeRoundOff;
    const roundOff = enableRoundOff ? round2(roundedGrandTotal - grandTotalBeforeRoundOff) : 0;

    return {
      lines: computedLines,
      subTotal,
      taxableTotal: totalTaxableIncludingCharges,
      exemptTotal: totalExemptIncludingCharges,
      vatAmount: totalVatIncludingCharges,
      grandTotal: roundedGrandTotal,
      roundOff,
    };
  }, [lines, additionalCharges, enableRoundOff]);

  const discountAmount = useMemo(
    () => round2(lines.reduce((s, l) => s + (Number(l.discountAmount) || 0), 0)),
    [lines],
  );

  const tdsAmount = useMemo(
    () => (tdsEnabled ? round2(computation.taxableTotal * ((Number(tdsRate) || 0) / 100)) : 0),
    [tdsEnabled, tdsRate, computation.taxableTotal],
  );

  const grandTotal = computation.grandTotal;
  const netPayable = round2(grandTotal - tdsAmount);
  const balance = round2(grandTotal - (Number(paidAmount) || 0));

  const words = useMemo(() => numberToWords(grandTotal, "Rupees"), [grandTotal]);

  // ---- voucher no preview ----
  const invoiceNoPreview = useMemo(() => {
    if (existing?.invoiceNo) return existing.invoiceNo;
    try {
      return generateInvoiceNo(meta.vt as any, companySettings?.voucherSeries || {}, invoices)
        .invoiceNo;
    } catch {
      return "INV-XXXX";
    }
  }, [existing, meta.vt, companySettings, invoices]);

  // ---- line helpers ----
  const updateLine = (id: string, updates: Partial<InvoiceLineState>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    markDirty();
  };
  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    markDirty();
  };
  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
    markDirty();
  };

  // ---- validation ----
  const validate = (forPost: boolean): string | null => {
    if (!partyId) return `Select a ${meta.isSales ? "customer" : "supplier"}.`;
    const valid = lines.filter((l) => l.itemId);
    if (!valid.length) return "At least one line item is required.";
    for (const l of valid) {
      if (!(Number(l.qty) > 0)) return "Each line must have a quantity greater than zero.";
      if (!(Number(l.rate) >= 0)) return "Rate cannot be negative.";
    }
    if (!date) return "Invoice date is required.";
    const today = new Date().toISOString().split("T")[0];
    if (date > today) return "Date cannot be in the future.";
    if (
      currentFiscalYear &&
      (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate)
    ) {
      return `Date must be within fiscal year ${currentFiscalYear.name}.`;
    }
    if (grandTotal <= 0) return "Grand total must be greater than zero.";
    if (payMode === PaymentMode.BANK_TRANSFER && !bankAccountId) return "Select a bank account.";
    if (Number(paidAmount) > grandTotal) return "Paid amount cannot exceed grand total.";
    if (forPost) {
      const inactive = valid.find((l) => {
        const acc = accounts.find((a) => a.id === party?.accountId);
        return acc && acc.isActive === false;
      });
      if (inactive) return "Cannot post: party ledger is inactive.";
    }
    return null;
  };

  const buildPayload = (status: VoucherStatus) => {
    const validLines = lines.filter((l) => l.itemId && Number(l.qty) > 0);
    const payloadLines = validLines.map((l) => {
      const taxable = round2((l.qty || 0) * (l.rate || 0) * (1 - (l.discountPercent || 0) / 100));
      const vat = l.isTaxable ? round2(taxable * ((l.vatRate || 0) / 100)) : 0;
      return {
        itemId: l.itemId,
        itemName: l.itemName,
        itemCode: l.itemCode,
        unit: l.unit,
        qty: l.qty,
        rate: l.rate,
        discountPercent: l.discountPercent,
        discount: l.discountPercent,
        discountAmount: round2((l.qty || 0) * (l.rate || 0) * ((l.discountPercent || 0) / 100)),
        isTaxable: l.isTaxable,
        vatRate: l.vatRate,
        taxableAmount: l.isTaxable ? taxable : 0,
        exemptAmount: l.isTaxable ? 0 : taxable,
        vatAmount: vat,
        netAmount: round2(taxable + vat),
        totalAmount: round2(taxable + vat),
        warehouseId: l.warehouseId || undefined,
        hsnCode: l.hsnCode,
        description: l.description,
      };
    });

    const ps: PaymentStatus =
      paidAmount >= grandTotal
        ? PaymentStatus.PAID
        : paidAmount > 0
          ? PaymentStatus.PARTIAL
          : payMode === PaymentMode.CREDIT
            ? PaymentStatus.UNPAID
            : PaymentStatus.PAID;

    const baseGrandTotal = round2(grandTotal * exchangeRate);

    return {
      type: meta.vt,
      date,
      dateNepali: ADToBSString(date) || "",
      dueDate: dueDate || undefined,
      partyId,
      partyName: party?.name || "",
      partyPan: party?.pan,
      partyVat: party?.vatNo,
      subTotal: computation.subTotal,
      discountAmount,
      taxableAmount: computation.taxableTotal,
      exemptAmount: computation.exemptTotal,
      vatAmount: computation.vatAmount,
      taxAmount: computation.vatAmount,
      tdsAmount: tdsEnabled ? tdsAmount : undefined,
      tdsRate: tdsEnabled ? tdsRate : undefined,
      tdsType: tdsEnabled ? tdsType : undefined,
      roundOff: computation.roundOff,
      grandTotal: baseGrandTotal,
      lines: payloadLines,
      paymentMode: payMode,
      paymentStatus: ps,
      paidAmount:
        payMode === PaymentMode.CREDIT ? round2((paidAmount || 0) * exchangeRate) : baseGrandTotal,
      bankAccountId: payMode === PaymentMode.BANK_TRANSFER ? bankAccountId : undefined,
      chequeNo: chequeNo || undefined,
      chequeDate: chequeNo ? chequeDate : undefined,
      narration: narration.trim() || `${meta.label} ${invoiceNoPreview}`,
      referenceNo: referenceNo || undefined,
      orderRef: orderRef || undefined,
      challanRef: challanRef || undefined,
      billTo: billTo || undefined,
      attachments,
      status,
      // multi-currency and additional charges
      currencyCode,
      exchangeRate,
      foreignAmount: grandTotal,
      additionalCharges: additionalCharges.map((c) => ({
        description: c.description,
        amount: c.amount,
        taxApplicable: c.taxApplicable,
        accountId: c.accountId,
      })),
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
      let result: any;
      if (isEdit) {
        await updateInvoice(invoiceId!, payload as any);
        result = { ...existing, ...payload };
      } else {
        result = await addInvoice(payload as any);
      }
      setDirty(false);

      if (status === VoucherStatus.POSTED) {
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-3`}
            >
              <div className="flex-1 w-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">
                      Invoice posted successfully
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono">{result.invoiceNo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-gray-100 pl-3 ml-3">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      handlePrint(result);
                    }}
                    className="text-[11px] font-bold text-[#1557b0] hover:text-[#0f4a96] hover:underline cursor-pointer"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ),
          { duration: 5000 },
        );
      } else {
        toast.success(isEdit ? "Draft updated." : "Draft saved.");
      }

      setSavedInvoice(result);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (inv?: any) => {
    const target = inv || savedInvoice;
    if (!target) return;
    try {
      const invoiceParty = parties.find((p) => p.id === target.partyId);
      if (!invoiceParty) {
        toast.error("Customer/Supplier details not found for PDF generation.");
        return;
      }
      const blob = await generateInvoicePDF(target, companySettings, invoiceParty, items);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  const handleBack = () => {
    if (dirty && !readOnly) setConfirmCancel(true);
    else onCancel?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      } else if (!readOnly && e.key === "F12") {
        e.preventDefault();
        handleSave(VoucherStatus.POSTED);
      } else if (!readOnly && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave(existing?.status || VoucherStatus.DRAFT);
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
    partyId,
    payMode,
    paidAmount,
    narration,
    tdsEnabled,
    tdsRate,
    additionalCharges,
    enableRoundOff,
    currencyCode,
    exchangeRate,
  ]);

  // ---- success screen ----
  if (savedInvoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 animate-fadeIn text-center">
        <div className="h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{meta.label} Saved</h2>
          <p className="text-xs text-gray-500 mt-1">
            {savedInvoice.invoiceNo} · {currencyCode === "NPR" ? symbol : currencyCode}{" "}
            {formatNumber(grandTotal)} · {party?.name}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handlePrint(savedInvoice)}
            icon={<Printer className="h-4 w-4" />}
          >
            Print Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const showWarehouse =
    warehouses.filter((w) => w.isActive).length > 0 && (type === "sales" || type === "purchase");

  const colspan = 15 + (showWarehouse ? 1 : 0);

  const itemList = items.filter((i) => i.isActive);

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
          <button onClick={handleBack} className="p-2 rounded-md hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[13px] font-semibold text-gray-800">{meta.label}</h1>
            {isEdit && <p className="text-[11px] text-gray-500 mt-0.5">{invoiceNoPreview}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={meta.color as any} size="sm">
            {meta.label}
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
          {currentFiscalYear && (
            <Badge variant="default" size="sm">
              FY {currentFiscalYear.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Header & Party details (3-column grid card) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-white border border-gray-200 rounded-md mb-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-600">Invoice No</span>
          <span className="inline-flex items-center h-8 px-2.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-700 text-[12px]">
            {invoiceNoPreview}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <PartySelect
            label={meta.isSales ? "Customer" : "Supplier"}
            partyType={meta.party}
            value={partyId}
            onChange={(v) => {
              setPartyId(v);
              markDirty();
            }}
            required
            disabled={readOnly}
          />
          {partyId && party?.accountId && (
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                  partyOutstanding > 0
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                Outstanding: {symbol} {formatNumber(Math.abs(partyOutstanding))}
                {partyOutstanding > 0 ? " Dr" : " Cr"}
              </span>
            </div>
          )}
        </div>
        <NepaliDatePicker
          label="Invoice Date"
          value={date}
          onChange={(v) => {
            setDate(v);
            markDirty();
          }}
          required
          disabled={readOnly}
        />

        <NepaliDatePicker
          label="Due Date"
          value={dueDate}
          onChange={(v) => {
            setDueDate(v);
            markDirty();
          }}
          disabled={readOnly}
        />
        <Input
          label="Reference No"
          value={referenceNo}
          onChange={(v) => {
            setReferenceNo(v);
            markDirty();
          }}
          placeholder="Optional"
          disabled={readOnly}
        />
        <Input label="PAN" value={party?.pan || ""} onChange={() => {}} disabled placeholder="—" />

        <Input
          label="VAT No"
          value={party?.vatNo || ""}
          onChange={() => {}}
          disabled
          placeholder="—"
        />
        <div className="md:col-span-2">
          <Input
            label="Bill To Address"
            value={billTo}
            onChange={(v) => {
              setBillTo(v);
              markDirty();
            }}
            placeholder="Auto-filled from party"
            disabled={readOnly}
          />
        </div>

        <Input
          label="Sales Order Ref"
          value={orderRef}
          onChange={(v) => {
            setOrderRef(v);
            markDirty();
          }}
          placeholder="Optional"
          disabled={readOnly}
        />
        <div className="md:col-span-2">
          <Input
            label="Delivery Challan Ref"
            value={challanRef}
            onChange={(v) => {
              setChallanRef(v);
              markDirty();
            }}
            placeholder="Optional"
            disabled={readOnly}
          />
        </div>

        {/* FEATURE-4: Multi-currency section */}
        {activeCurrencies.length > 1 && (
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-dashed border-gray-200 pt-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-700">Currency</label>
              <select
                value={currencyCode}
                onChange={(e) => {
                  setCurrencyCode(e.target.value);
                  markDirty();
                }}
                disabled={readOnly}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              >
                {activeCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            {currencyCode !== "NPR" && (
              <Input
                type="number"
                label={`Exchange Rate (1 ${currencyCode} = NPR)`}
                value={exchangeRate || ""}
                onChange={(v) => {
                  setExchangeRate(Number(v) || 1.0);
                  markDirty();
                }}
                disabled={readOnly}
                step={0.0001}
              />
            )}
          </div>
        )}
      </div>

      {/* Line items */}
      <Card border padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Line Items
          </h3>
          <Button
            variant="outline"
            size="xs"
            onClick={addLine}
            disabled={readOnly}
            icon={<Plus className="h-3 w-3" />}
          >
            Add Line
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-xs data-table">
            <thead className="bg-[#eef1f8] border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  #
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Item
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  HSN
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Qty
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Unit
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Rate
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Disc%
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Disc Amt
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Taxable
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Tax?
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  VAT%
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  VAT Amt
                </th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide th-right">
                  Total
                </th>
                {showWarehouse && (
                  <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Warehouse
                  </th>
                )}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const handleItemChange = (itemId: string) => {
                  const it = items.find((x) => x.id === itemId);
                  if (!it) {
                    updateLine(l.id, {
                      itemId: "",
                      itemName: "",
                      itemCode: "",
                      unit: "",
                      hsnCode: "",
                    });
                    return;
                  }
                  const itemRate =
                    type === "sales" ? Number(it.salesRate || 0) : Number(it.purchaseRate || 0);
                  updateLine(l.id, {
                    itemId: it.id,
                    itemName: it.name,
                    itemCode: it.code,
                    unit: it.unit || "",
                    hsnCode: it.hsnCode || "",
                    rate: itemRate,
                    isTaxable: !!it.isTaxable,
                    vatRate: it.vatRate ?? (it.isTaxable ? 13 : 0),
                    discountPercent: 0,
                    discountAmount: 0,
                  });
                };

                const handleDiscPercent = (pctVal: number) => {
                  const pct = Math.min(100, Math.max(0, pctVal));
                  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
                  const amt = round2((gross * pct) / 100);
                  updateLine(l.id, { discountPercent: pct, discountAmount: amt });
                };

                const handleDiscAmt = (amtVal: number) => {
                  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
                  const amt = Math.min(gross, Math.max(0, amtVal));
                  const pct = gross > 0 ? round2((amt / gross) * 100) : 0;
                  updateLine(l.id, { discountPercent: pct, discountAmount: amt });
                };

                const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
                const taxableLineVal = round2(gross - (Number(l.discountAmount) || 0));
                const vatLineVal = l.isTaxable
                  ? round2(taxableLineVal * ((Number(l.vatRate) || 0) / 100))
                  : 0;
                const totalLineVal = round2(taxableLineVal + vatLineVal);

                const cellInputClass =
                  "w-full h-8 px-2 text-xs font-mono bg-transparent border border-transparent focus:border-[#1557b0] focus:bg-white rounded-sm outline-none";

                return (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-[#e8eeff]">
                    <td className="px-2 py-1 text-center text-[11px] font-bold text-slate-400 w-8">
                      {idx + 1}
                    </td>

                    {/* Item Select */}
                    <td className="px-1 py-1 min-w-[180px]">
                      <select
                        className={cellInputClass}
                        value={l.itemId}
                        onChange={(e) => handleItemChange(e.target.value)}
                        disabled={readOnly}
                      >
                        <option value="">— select item —</option>
                        {itemList.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.code} · {it.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* HSN */}
                    <td className="px-1 py-1 w-20">
                      <input
                        className={cellInputClass}
                        value={l.hsnCode || ""}
                        onChange={(e) => updateLine(l.id, { hsnCode: e.target.value })}
                        disabled={readOnly}
                        placeholder="—"
                      />
                    </td>

                    {/* Description */}
                    <td className="px-1 py-1 min-w-[140px]">
                      <input
                        className={cellInputClass}
                        value={l.description || ""}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        disabled={readOnly}
                        placeholder="—"
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-1 py-1 w-20">
                      <input
                        type="number"
                        className="w-full h-7 px-2 text-[12px] border-0 border-b border-gray-200 bg-transparent text-right focus:outline-none focus:border-[#1557b0] font-mono"
                        value={l.qty || ""}
                        onChange={(e) => {
                          const newQty = Number(e.target.value) || 0;
                          const newGross = newQty * (Number(l.rate) || 0);
                          const newAmt = round2(
                            (newGross * (Number(l.discountPercent) || 0)) / 100,
                          );
                          updateLine(l.id, { qty: newQty, discountAmount: newAmt });
                        }}
                        disabled={readOnly}
                        placeholder="0"
                        min={0}
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-1 py-1 w-16">
                      <input
                        className={cellInputClass}
                        value={l.unit || ""}
                        onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                        disabled={readOnly}
                        placeholder="pcs"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-1 py-1 w-24">
                      <input
                        type="number"
                        className="w-full h-7 px-2 text-[12px] border-0 border-b border-gray-200 bg-transparent text-right focus:outline-none focus:border-[#1557b0] font-mono"
                        value={l.rate || ""}
                        onChange={(e) => {
                          const newRate = Number(e.target.value) || 0;
                          const newGross = (Number(l.qty) || 0) * newRate;
                          const newAmt = round2(
                            (newGross * (Number(l.discountPercent) || 0)) / 100,
                          );
                          updateLine(l.id, { rate: newRate, discountAmount: newAmt });
                        }}
                        disabled={readOnly}
                        placeholder="0.00"
                        min={0}
                        step="0.01"
                      />
                    </td>

                    {/* FEATURE-1: Disc% */}
                    <td className="px-1 py-1 w-20">
                      <input
                        type="number"
                        className={`${cellInputClass} text-right`}
                        value={l.discountPercent || ""}
                        onChange={(e) => handleDiscPercent(Number(e.target.value) || 0)}
                        disabled={readOnly}
                        placeholder="0.00"
                        min={0}
                        max={100}
                        step="0.01"
                      />
                    </td>

                    {/* FEATURE-1: Disc Amt */}
                    <td className="px-1 py-1 w-24">
                      <input
                        type="number"
                        className={`${cellInputClass} text-right`}
                        value={l.discountAmount || ""}
                        onChange={(e) => handleDiscAmt(Number(e.target.value) || 0)}
                        disabled={readOnly}
                        placeholder="0.00"
                        min={0}
                        step="0.01"
                      />
                    </td>

                    {/* Taxable Amount */}
                    <td className="px-2 py-1 text-right w-24 font-mono text-[12px]">
                      {formatNumber(taxableLineVal)}
                    </td>

                    {/* Is Taxable */}
                    <td className="px-1 py-1 text-center w-14">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#1557b0]"
                        checked={!!l.isTaxable}
                        onChange={(e) => updateLine(l.id, { isTaxable: e.target.checked })}
                        disabled={readOnly}
                      />
                    </td>

                    {/* VAT % */}
                    <td className="px-1 py-1 w-16">
                      <input
                        type="number"
                        className={`${cellInputClass} text-right`}
                        value={l.vatRate || ""}
                        onChange={(e) => updateLine(l.id, { vatRate: Number(e.target.value) || 0 })}
                        disabled={readOnly || !l.isTaxable}
                        placeholder="13"
                        min={0}
                        max={100}
                        step="0.01"
                      />
                    </td>

                    {/* VAT Amount */}
                    <td className="px-2 py-1 text-right w-24 font-mono text-[12px] text-blue-700">
                      {formatNumber(vatLineVal)}
                    </td>

                    {/* Total */}
                    <td className="text-right text-[12px] font-medium text-gray-800 font-mono px-3 w-24 bg-slate-50/80">
                      {formatNumber(totalLineVal)}
                    </td>

                    {/* Warehouse */}
                    {showWarehouse && (
                      <td className="px-1 py-1 w-32">
                        <select
                          className={cellInputClass}
                          value={l.warehouseId || ""}
                          onChange={(e) => updateLine(l.id, { warehouseId: e.target.value })}
                          disabled={readOnly}
                        >
                          <option value="">—</option>
                          {warehouses
                            .filter((w) => w.isActive)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    )}

                    {/* Delete */}
                    <td className="px-1 py-1 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(l.id)}
                        disabled={readOnly}
                        className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-40"
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={colspan} className="text-center py-6 text-gray-400">
                    No lines. Click “Add Line”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* FEATURE-2: Invoice-level additional charges */}
      <Card border padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Additional Charges
          </h3>
          <Button
            variant="outline"
            size="xs"
            onClick={addAdditionalCharge}
            disabled={readOnly}
            icon={<Plus className="h-3 w-3" />}
          >
            Add Charge
          </Button>
        </div>
        {additionalCharges.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-[#eef1f8] border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Description
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Ledger Account
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Taxable (13% VAT)?
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {additionalCharges.map((charge) => (
                  <tr key={charge.id} className="border-b border-gray-100 hover:bg-[#e8eeff]">
                    <td className="p-1">
                      <input
                        type="text"
                        className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        value={charge.description}
                        onChange={(e) =>
                          updateAdditionalCharge(charge.id, "description", e.target.value)
                        }
                        placeholder="e.g. Shipping / Delivery / Packing"
                        disabled={readOnly}
                        required
                      />
                    </td>
                    <td className="p-1 min-w-[200px]">
                      <AccountSelect
                        value={charge.accountId}
                        onChange={(val) => updateAdditionalCharge(charge.id, "accountId", val)}
                        disabled={readOnly}
                        placeholder="Select income/expense ledger"
                        filterTypes={[AccountType.INCOME, AccountType.EXPENSE]}
                        required
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#1557b0]"
                        checked={!!charge.taxApplicable}
                        onChange={(e) =>
                          updateAdditionalCharge(charge.id, "taxApplicable", e.target.checked)
                        }
                        disabled={readOnly}
                      />
                    </td>
                    <td className="p-1 w-32">
                      <input
                        type="number"
                        className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-right font-mono"
                        value={charge.amount || ""}
                        onChange={(e) =>
                          updateAdditionalCharge(charge.id, "amount", Number(e.target.value) || 0)
                        }
                        disabled={readOnly}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td className="p-1 text-center w-10">
                      <button
                        type="button"
                        onClick={() => removeAdditionalCharge(charge.id)}
                        disabled={readOnly}
                        className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 border border-dashed border-gray-200 rounded-md text-gray-400">
            No additional charges added.
          </div>
        )}
      </Card>

      {/* Payment + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        {/* Payment & TDS & Narration */}
        <Card border padding="md">
          <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3">
            Payment
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { id: PaymentMode.CASH, label: "Cash", icon: Banknote },
              { id: PaymentMode.BANK_TRANSFER, label: "Bank", icon: Landmark },
              { id: PaymentMode.CREDIT, label: "Credit", icon: CreditCard },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setPayMode(id as PaymentMode);
                  markDirty();
                }}
                className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-md border text-xs font-bold transition-colors ${payMode === id ? "bg-[#1557b0] text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {payMode === PaymentMode.BANK_TRANSFER && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[11px] text-gray-500 font-medium">Bank Account</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => {
                    setBankAccountId(e.target.value);
                    markDirty();
                  }}
                  disabled={readOnly}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="" disabled>
                    Select bank
                  </option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Cheque No"
                value={chequeNo}
                onChange={(v) => {
                  setChequeNo(v);
                  markDirty();
                }}
                placeholder="Optional"
                disabled={readOnly}
              />
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
          )}

          {payMode === PaymentMode.CREDIT && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                type="number"
                label={`Amount Paid Now (${currencyCode === "NPR" ? "NPR" : currencyCode})`}
                value={paidAmount || ""}
                onChange={(v) => {
                  setPaidAmount(Number(v) || 0);
                  markDirty();
                }}
                placeholder="0.00"
                hint="Leave 0 for fully credit sale"
                disabled={readOnly}
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500 font-medium">Balance Due</span>
                <span
                  className={`font-mono font-bold text-base ${balance > 0 ? "text-[#dc2626]" : "text-[#15803d]"}`}
                >
                  {currencyCode === "NPR" ? symbol : currencyCode} {formatNumber(balance)}
                </span>
              </div>
            </div>
          )}

          {party?.subjectToTds && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <input
                  id="tds-enabled"
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#1557b0]"
                  checked={tdsEnabled}
                  onChange={(e) => {
                    setTdsEnabled(e.target.checked);
                    markDirty();
                  }}
                  disabled={readOnly}
                />
                <label htmlFor="tds-enabled" className="text-xs font-bold text-slate-700">
                  Deduct TDS
                </label>
              </div>
              {tdsEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    label="TDS Type"
                    options={Object.values(TdsType)
                      .filter((v) => v !== TdsType.NONE)
                      .map((v) => ({ value: v, label: String(v).toUpperCase() }))}
                    value={tdsType}
                    onChange={(v) => {
                      setTdsType(v as TdsType);
                      markDirty();
                    }}
                    disabled={readOnly}
                  />
                  <Input
                    type="number"
                    label="TDS Rate %"
                    value={tdsRate || ""}
                    onChange={(v) => {
                      setTdsRate(Number(v) || 0);
                      markDirty();
                    }}
                    disabled={readOnly}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-500 font-medium">
                      TDS Amount
                    </span>
                    <span className="font-mono font-bold text-orange-600 text-base">
                      {currencyCode === "NPR" ? symbol : currencyCode} {formatNumber(tdsAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="mb-1 block">
              <label className="text-xs font-semibold text-gray-700">Narration</label>
            </div>
            <NarrationInput
              value={narration}
              onChange={(v) => {
                setNarration(v);
                markDirty();
              }}
              disabled={readOnly}
              voucherType="sales"
              rows={2}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="text-xs font-medium text-slate-700 mb-1 block">Attachments</label>
            <AttachmentUploader
              attachments={attachments}
              onAdd={(b64) => {
                setAttachments((p) => [...p, b64]);
                markDirty();
              }}
              onRemove={(idx) => {
                setAttachments((p) => p.filter((_, i) => i !== idx));
                markDirty();
              }}
            />
          </div>
        </Card>

        {/* Totals Box, right-aligned in a w-64 card */}
        <div className="flex flex-col gap-3 justify-end items-end">
          {/* FEATURE-3: Round-off toggle UI */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm w-64 justify-between">
            <label htmlFor="roundoff-toggle" className="text-[11px] font-medium text-gray-600">
              Enable Round-off
            </label>
            <input
              id="roundoff-toggle"
              type="checkbox"
              className="h-3.5 w-3.5 accent-[#1557b0]"
              checked={enableRoundOff}
              onChange={(e) => {
                setEnableRoundOff(e.target.checked);
                markDirty();
              }}
              disabled={readOnly}
            />
          </div>

          <div className="w-64 p-3 bg-white border border-gray-200 rounded-md flex flex-col gap-1.5 shadow-sm totals-panel">
            <div className="flex justify-between items-baseline text-[12px] totals-row">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-mono text-gray-800">
                {currencyCode === "NPR" ? symbol : currencyCode}{" "}
                {formatNumber(computation.subTotal)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px] text-red-600 totals-row">
              <span className="font-medium">Discount</span>
              <span className="font-mono">
                - {currencyCode === "NPR" ? symbol : currencyCode} {formatNumber(discountAmount)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px] totals-row">
              <span className="text-gray-600 font-medium">Taxable Amount</span>
              <span className="font-mono text-gray-800">
                {currencyCode === "NPR" ? symbol : currencyCode}{" "}
                {formatNumber(computation.taxableTotal)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px] totals-row">
              <span className="text-gray-600 font-medium">VAT (13%)</span>
              <span className="font-mono text-gray-800">
                {currencyCode === "NPR" ? symbol : currencyCode}{" "}
                {formatNumber(computation.vatAmount)}
              </span>
            </div>
            {tdsEnabled && (
              <div className="flex justify-between items-baseline text-[12px] text-orange-600 totals-row">
                <span className="font-medium">TDS Deducted</span>
                <span className="font-mono">
                  - {currencyCode === "NPR" ? symbol : currencyCode} {formatNumber(tdsAmount)}
                </span>
              </div>
            )}
            {enableRoundOff && computation.roundOff !== 0 && (
              <div className="flex justify-between items-baseline text-[12px] text-gray-500 totals-row">
                <span className="font-medium">Round Off</span>
                <span className="font-mono">
                  {computation.roundOff > 0 ? "+" : ""}
                  {currencyCode === "NPR" ? symbol : currencyCode}{" "}
                  {formatNumber(computation.roundOff)}
                </span>
              </div>
            )}
            <div className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] p-2 mt-1 flex justify-between items-baseline rounded-sm totals-row total-final">
              <span className="text-[12px] font-bold text-[#1557b0] uppercase">Grand Total</span>
              <span className="font-mono font-bold text-[12px] text-[#1557b0] text-right">
                {currencyCode === "NPR" ? symbol : currencyCode} {formatNumber(grandTotal)}
              </span>
            </div>
            {/* Display Base NPR total if in foreign currency */}
            {currencyCode !== "NPR" && (
              <div className="text-[10px] text-right text-gray-500 font-mono mt-0.5 uppercase tracking-wide">
                Equiv. Base: {symbol} {formatNumber(round2(grandTotal * exchangeRate))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <p className="text-[11px] text-gray-400 font-semibold">
          ESC to cancel · Ctrl+S to save draft · F12 to post
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBack}>
            Cancel
          </Button>
          {savedInvoice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePrint()}
              icon={<Printer className="h-4 w-4" />}
            >
              Print Preview
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(VoucherStatus.DRAFT)}
            loading={saving}
            disabled={readOnly}
            icon={<Save className="h-4 w-4" />}
          >
            Save as Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(VoucherStatus.POSTED)}
            loading={saving}
            disabled={readOnly}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Post Invoice
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Discard changes?"
        message="You have unsaved changes. Leaving will discard this invoice."
        confirmText="Discard"
        cancelText="Stay"
        danger={true}
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel?.();
        }}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
};

export default SalesInvoiceForm;
