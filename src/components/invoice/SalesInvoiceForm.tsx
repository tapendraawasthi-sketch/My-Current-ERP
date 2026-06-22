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
} from "lucide-react";
import { formatNumber, numberToWords } from "../../lib/utils";
import { ADToBSString } from "../../lib/nepaliDate";
import { generateInvoiceNo } from "../../lib/accounting";
import { computeVAT } from "../../lib/taxUtils";
import { generateInvoicePDF } from "../../lib/printUtils";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  PaymentStatus,
  PartyType,
  TdsType,
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
        isTaxable: l.isTaxable ?? true,
        vatRate: Number(l.vatRate ?? 13),
        warehouseId: l.warehouseId || "",
      }));
    }
    return [emptyLine()];
  });

  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  const markDirty = () => setDirty(true);

  // ---- totals via taxUtils.computeVAT ----
  const computation = useMemo(() => {
    const filtered = lines
      .filter((l) => l.itemId && Number(l.qty) > 0)
      .map((l) => ({
        itemName: l.itemName,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discount: Number(l.discountPercent) || 0,
        isTaxable: !!l.isTaxable,
        vatRate: Number(l.vatRate) || 0,
      }));
    return computeVAT(filtered);
  }, [lines]);

  const discountAmount = useMemo(
    () =>
      round2(
        lines.reduce(
          (s, l) =>
            s +
            (Number(l.qty) || 0) * (Number(l.rate) || 0) * ((Number(l.discountPercent) || 0) / 100),
          0,
        ),
      ),
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
      grandTotal,
      lines: payloadLines,
      paymentMode: payMode,
      paymentStatus: ps,
      paidAmount: payMode === PaymentMode.CREDIT ? paidAmount || 0 : grandTotal,
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
  }, [lines, dirty, readOnly, date, partyId, payMode, paidAmount, narration, tdsEnabled, tdsRate]);

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
            {savedInvoice.invoiceNo} · {symbol} {formatNumber(grandTotal)} · {party?.name}
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

  const colspan = 13 + (showWarehouse ? 1 : 0);

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
          <table className="w-full text-xs">
            <thead className="bg-[#f0f4ff] text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2 text-center">#</th>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-left">HSN</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-left">Unit</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">Disc%</th>
                <th className="px-2 py-2 text-right">Taxable</th>
                <th className="px-2 py-2 text-center">Tax?</th>
                <th className="px-2 py-2 text-right">VAT%</th>
                <th className="px-2 py-2 text-right">VAT Amt</th>
                <th className="px-2 py-2 text-right">Total</th>
                {showWarehouse && <th className="px-2 py-2 text-left">Warehouse</th>}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <InvoiceLineItem
                  key={l.id}
                  line={l}
                  lineNo={idx + 1}
                  onUpdate={(u) => updateLine(l.id, u)}
                  onDelete={() => removeLine(l.id)}
                  onTabNext={() => {
                    if (idx === lines.length - 1) addLine();
                  }}
                  showWarehouse={showWarehouse}
                  type={meta.isSales ? "sales" : "purchase"}
                  readOnly={readOnly}
                />
              ))}
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
                label="Amount Paid Now"
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
                <span className="text-xs font-semibold text-gray-500">Balance Due</span>
                <span
                  className={`font-mono font-bold text-base ${balance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {symbol} {formatNumber(balance)}
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
                  className="h-3.5 w-3.5 accent-indigo-600"
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
                    <span className="text-xs font-semibold text-gray-500">TDS Amount</span>
                    <span className="font-mono font-bold text-orange-600 text-base">
                      {symbol} {formatNumber(tdsAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <Input
              label="Narration"
              value={narration}
              onChange={(v) => {
                setNarration(v);
                markDirty();
              }}
              placeholder="Optional notes / description"
              disabled={readOnly}
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
        <div className="flex justify-end">
          <div className="w-64 p-3 bg-white border border-gray-200 rounded-md flex flex-col gap-1.5 shadow-sm">
            <div className="flex justify-between items-baseline text-[12px]">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-mono text-gray-800">
                {symbol} {formatNumber(computation.subTotal)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px] text-red-600">
              <span className="font-medium">Discount</span>
              <span className="font-mono">
                - {symbol} {formatNumber(discountAmount)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px]">
              <span className="text-gray-600 font-medium">Taxable Amount</span>
              <span className="font-mono text-gray-800">
                {symbol} {formatNumber(computation.taxableTotal)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[12px]">
              <span className="text-gray-600 font-medium">VAT (13%)</span>
              <span className="font-mono text-gray-800">
                {symbol} {formatNumber(computation.vatAmount)}
              </span>
            </div>
            {tdsEnabled && (
              <div className="flex justify-between items-baseline text-[12px] text-orange-600">
                <span className="font-medium">TDS Deducted</span>
                <span className="font-mono">
                  - {symbol} {formatNumber(tdsAmount)}
                </span>
              </div>
            )}
            {computation.roundOff !== 0 && (
              <div className="flex justify-between items-baseline text-[12px] text-gray-500">
                <span className="font-medium">Round Off</span>
                <span className="font-mono">
                  {symbol} {formatNumber(computation.roundOff)}
                </span>
              </div>
            )}
            <div className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] p-2 mt-1 flex justify-between items-baseline rounded-sm">
              <span className="text-[12px] font-bold text-[#1557b0] uppercase">Grand Total</span>
              <span className="font-mono font-bold text-[12px] text-[#1557b0] text-right">
                {symbol} {formatNumber(grandTotal)}
              </span>
            </div>
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
