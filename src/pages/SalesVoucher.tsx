// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Plus, Trash2, Save, RefreshCw, X, Eye, Search } from "lucide-react";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import { computeVatForLine } from "../lib/taxUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalesLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  qty: number;
  unit: string;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  isTaxable: boolean;
  vatRate: number;
  vatClassificationId?: string;
  taxability?: string;
  vatLabel?: string;
  vatBadgeVariant?: "success" | "warning" | "info" | "default";
  vatAmount: number;
  totalAmount: number;
  warehouseId?: string;
  batchNo?: string;
  costPrice?: number;
}

interface PaymentEntry {
  mode: string;
  accountId: string;
  amount: number;
  reference: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptyLine(): SalesLine {
  return {
    id: uuid(),
    itemId: "",
    itemName: "",
    itemCode: "",
    qty: 1,
    unit: "PCS",
    rate: 0,
    discountPercent: 0,
    discountAmount: 0,
    netAmount: 0,
    isTaxable: true,
    vatRate: 13,
    vatAmount: 0,
    totalAmount: 0,
  };
}

function computeLine(
  line: SalesLine,
  vatClassifications: Array<{ id: string; name?: string; taxability: string; vatRate: number }>,
): SalesLine {
  const vat = computeVatForLine(
    {
      qty: line.qty,
      rate: line.rate,
      discountPercent: line.discountPercent,
      isTaxable: line.isTaxable,
      vatRate: line.vatRate,
      vatClassificationId: line.vatClassificationId,
    },
    vatClassifications.map((c) => ({
      id: c.id,
      name: c.name,
      taxability: c.taxability as "taxable" | "exempt" | "zero_rated" | "non_vat",
      vatRate: c.vatRate ?? 0,
    })),
  );

  return {
    ...line,
    discountAmount: vat.discountAmount,
    netAmount: vat.netAmount,
    isTaxable: vat.isTaxable,
    vatRate: vat.vatRate,
    vatAmount: vat.vatAmount,
    totalAmount: vat.totalAmount,
    taxability: vat.taxability,
    vatLabel: vat.vatLabel,
    vatBadgeVariant: vat.vatBadgeVariant,
    vatClassificationId: vat.vatClassificationId || line.vatClassificationId,
  };
}

const statusBadgeCls = (status: string) => {
  switch (status) {
    case "posted":
      return "bg-green-100 text-green-700";
    case "draft":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "submitted":
    case "under_review":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const vatBadgeCls = (variant?: string) => {
  if (variant === "success") return "bg-green-100 text-green-700";
  if (variant === "warning") return "bg-amber-100 text-amber-700";
  if (variant === "info") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
};

// ─── Main Component ────────────────────────────────────────────────────────────

const SalesVoucher: React.FC = () => {
  const {
    accounts,
    parties,
    items,
    warehouses,
    invoices,
    addInvoice,
    updateInvoice,
    companySettings,
    currentFiscalYear,
    currentUser,
    vatClassifications,
  } = useStore();

  // ── Form State ───────────────────────────────────────────────────────────
  const [voucherDate, setVoucherDate] = useState(today());
  const [voucherDateNepali, setVoucherDateNepali] = useState("");
  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState(() => warehouses[0]?.id ?? "");
  const [paymentMode, setPaymentMode] = useState<"credit" | "cash" | "bank">("credit");
  const [narration, setNarration] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [lines, setLines] = useState<SalesLine[]>([emptyLine()]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [loading, setSaving] = useState(false);

  // ── List view state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"new" | "list">("new");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // ── Party & Item lookups ──────────────────────────────────────────────────
  const customers = useMemo(
    () => parties.filter((p) => p.type === "customer" || p.type === "both"),
    [parties],
  );

  const salesItems = useMemo(() => items.filter((i) => i.isActive !== false), [items]);

  // ── Line calculations ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0);
    const taxable = lines.filter((l) => l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const exempt = lines.filter((l) => !l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
    // Bill discount must reduce the taxable base BEFORE VAT is computed.
    // First, split the bill discount proportionally between taxable and exempt portions.
    const preBillDiscTotal = taxable + exempt;
    const billDisc =
      billDiscountAmount > 0 ? billDiscountAmount : preBillDiscTotal * (billDiscountPercent / 100);

    // Subtract bill discount from the taxable portion only (exempt already has no VAT).
    const taxableAfterDisc = Math.max(0, taxable - billDisc);

    // Recompute VAT on the discounted taxable base (line-level VAT rates vary,
    // so we scale VAT proportionally to how much the taxable base was reduced).
    const vatScale = taxable > 0 ? taxableAfterDisc / taxable : 1;
    const vatAfterDisc = vat * vatScale;

    const grandRaw = taxableAfterDisc + exempt + vatAfterDisc;
    const grandTotal = Math.round(grandRaw);
    const autoRoundOff = parseFloat((grandTotal - grandRaw).toFixed(2));
    return {
      subTotal,
      lineDiscount,
      taxable: taxableAfterDisc,
      exempt,
      vat: vatAfterDisc,
      billDisc,
      grandTotal,
      roundOff: autoRoundOff,
    };
  }, [lines, billDiscountPercent, billDiscountAmount]);

  // ── Line handlers ─────────────────────────────────────────────────────────
  const updateLine = (id: string, field: keyof SalesLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        let updated = { ...l, [field]: value };
        if (field === "itemId") {
          const item = items.find((i) => i.id === value);
          if (item) {
            updated = {
              ...updated,
              itemName: item.name,
              itemCode: item.code ?? item.sku ?? "",
              unit: item.unit ?? "PCS",
              rate: item.salesRate ?? item.sellingPrice ?? item.mrp ?? item.rate ?? 0,
              isTaxable: item.isTaxable !== false,
              vatRate: item.vatRate ?? 13,
              vatClassificationId: item.vatClassificationId,
              costPrice: item.costPrice ?? 0,
            };
          }
        }
        if (field === "vatClassificationId") {
          updated = { ...updated, vatClassificationId: value || undefined };
        }
        return computeLine(updated, vatClassifications || []);
      }),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      toast.error("At least one line is required.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const resetForm = () => {
    setVoucherDate(today());
    setVoucherDateNepali("");
    setPartyId("");
    setPaymentMode("credit");
    setNarration("");
    setReferenceNo("");
    setLines([emptyLine()]);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    setRoundOff(0);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!partyId) {
      toast.error("Please select a customer.");
      return;
    }
    const invalidLine = lines.some((l) => !l.itemId || l.qty <= 0 || l.rate <= 0);
    if (invalidLine) {
      toast.error("All lines must have a valid item, quantity, and rate.");
      return;
    }

    setSaving(true);
    try {
      const party = parties.find((p) => p.id === partyId);
      await addInvoice({
        date: voucherDate,
        dateNepali: voucherDateNepali,
        type: "sales-invoice",
        status: "posted",
        partyId,
        partyName: party?.name ?? "",
        partyPan: party?.pan ?? "",
        warehouseId: warehouseId || undefined,
        paymentMode,
        paymentStatus: paymentMode === "credit" ? "unpaid" : "paid",
        subTotal: totals.subTotal,
        discountAmount: totals.lineDiscount + totals.billDisc,
        taxableAmount: totals.taxable,
        exemptAmount: totals.exempt,
        vatAmount: totals.vat,
        taxAmount: totals.vat,
        grandTotal: totals.grandTotal,
        roundOff: totals.roundOff,
        narration: narration.trim(),
        referenceNo: referenceNo.trim() || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          itemCode: l.itemCode,
          qty: l.qty,
          unit: l.unit,
          rate: l.rate,
          discountPercent: l.discountPercent,
          discountAmount: l.discountAmount,
          netAmount: l.netAmount,
          vatRate: l.vatRate,
          vatAmount: l.vatAmount,
          totalAmount: l.totalAmount,
          isTaxable: l.isTaxable,
          vatClassificationId: l.vatClassificationId,
          warehouseId: l.warehouseId ?? warehouseId,
          batchNo: l.batchNo,
          costPrice: l.costPrice,
        })),
        createdBy: currentUser?.id,
        createdByName: currentUser?.name,
      });

      toast.success("Sales invoice saved successfully.");
      resetForm();
      setActiveTab("list");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save sales invoice.");
    } finally {
      setSaving(false);
    }
  };

  // ── Filter invoices ───────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          inv.type === "sales-invoice" &&
          (statusFilter === "all" || inv.status === statusFilter) &&
          (searchTerm === "" ||
            (inv.invoiceNo ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.partyName ?? "").toLowerCase().includes(searchTerm.toLowerCase())),
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [invoices, statusFilter, searchTerm]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-y-auto p-4 md:p-6">
      {/* ── Page Header — NO ActionToolbar, NO children prop ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Sales Invoice</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Create and manage sales invoices</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge variant uses "default" not "outline" */}
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
            {companySettings?.name ?? "Company"}
          </span>
          {currentFiscalYear && (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
              FY {currentFiscalYear.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              activeTab === "new"
                ? "bg-[#1557b0] text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            New Invoice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              activeTab === "list"
                ? "bg-[#1557b0] text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Invoice List
          </button>
        </div>
      </div>

      {/* ── NEW INVOICE TAB ─────────────────────────────────────────────────── */}
      {activeTab === "new" && (
        <div className="space-y-4">
          {/* Header fields */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date (AD) */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Date (AD)
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>

              {/* Date (BS) — wrap NepaliDatePicker in div; className NOT on component */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Date (BS)
                </label>
                <div className="w-full">
                  <NepaliDatePicker
                    value={voucherDateNepali}
                    onChange={(val: string) => setVoucherDateNepali(val)}
                  />
                </div>
              </div>

              {/* Customer */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">— Select Customer —</option>
                  {customers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.pan ? `(PAN: ${p.pan})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">— Select Warehouse —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as "credit" | "cash" | "bank")}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              {/* Reference No */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Reference No.
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. PO-001"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>

              {/* Narration */}
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Narration
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Invoice remarks…"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa]">
              <h3 className="text-[12px] font-semibold text-gray-700">Line Items</h3>
              <button
                type="button"
                onClick={addLine}
                className="h-7 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Item
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                      Unit
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Rate
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Disc %
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Net Amt
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                      VAT
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Total
                    </th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      {/* Item select */}
                      <td className="px-2 py-1.5">
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(line.id, "itemId", e.target.value)}
                          className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                        >
                          <option value="">— Select Item —</option>
                          {salesItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} {i.code ? `(${i.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Qty — AmountInput replaced with plain input; className NOT on AmountInput */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.qty}
                            onChange={(e) =>
                              updateLine(line.id, "qty", parseFloat(e.target.value) || 0)
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                          className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-center"
                        />
                      </td>

                      {/* Rate — AmountInput replaced with plain input; no className on component */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.rate}
                            onChange={(e) =>
                              updateLine(line.id, "rate", parseFloat(e.target.value) || 0)
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Discount % — AmountInput replaced with plain input; no className on component */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.discountPercent}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "discountPercent",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Net Amount */}
                      <td className="px-3 py-1.5 text-right font-mono text-[12px] text-gray-700">
                        {money(line.netAmount)}
                      </td>

                      {/* VAT classification badge */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <select
                            value={line.vatClassificationId || ""}
                            onChange={(e) =>
                              updateLine(line.id, "vatClassificationId", e.target.value)
                            }
                            className="h-7 px-1.5 text-[10px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full max-w-[110px]"
                          >
                            <option value="">Default</option>
                            {(vatClassifications || []).map((vc) => (
                              <option key={vc.id} value={vc.id}>
                                {vc.name}
                              </option>
                            ))}
                          </select>
                          {line.vatLabel && (
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${vatBadgeCls(line.vatBadgeVariant)}`}
                            >
                              {line.vatLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-1.5 text-right font-mono text-[12px] font-semibold text-gray-800">
                        {money(line.totalAmount)}
                      </td>

                      {/* Remove */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 px-4 py-4">
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Sub Total</span>
                    <span className="font-mono">{money(totals.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Line Discount</span>
                    <span className="font-mono">({money(totals.lineDiscount)})</span>
                  </div>

                  {/* Bill Discount — AmountInput replaced with plain input */}
                  <div className="flex items-center justify-between text-gray-600 gap-2">
                    <span className="shrink-0">Bill Disc %</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={billDiscountPercent}
                        onChange={(e) => {
                          setBillDiscountPercent(parseFloat(e.target.value) || 0);
                          setBillDiscountAmount(0);
                        }}
                        className="h-7 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">{money(totals.taxable)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Exempt Amount</span>
                    <span className="font-mono">{money(totals.exempt)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (13%)</span>
                    <span className="font-mono">{money(totals.vat)}</span>
                  </div>
                  {totals.roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>Round Off</span>
                      <span className="font-mono">{money(totals.roundOff)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2 text-[14px]">
                    <span>Grand Total</span>
                    <span className="font-mono text-[#1557b0]">{money(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {/* Button variant "danger" NOT "destructive" */}
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIST TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="no-print bg-white border border-gray-200 rounded-md p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by invoice no. or customer…"
                className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="all">All statuses</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <span className="text-[11px] text-gray-500">
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New invoice
            </button>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message="No sales invoices found"
                hint='Adjust filters or switch to "New invoice" to create one.'
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Invoice no.
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Customer
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-gray-800 border-b border-gray-100">
                          {inv.invoiceNo}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100">
                          {inv.dateNepali || inv.date}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100">
                          {inv.partyName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] font-medium text-gray-800 border-b border-gray-100">
                          {money(inv.grandTotal ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-center border-b border-gray-100">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeCls(inv.status)}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right border-b border-gray-100">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(inv);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filteredInvoices.length} sales invoice{filteredInvoices.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Invoice Detail Modal ──────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInvoice(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-800">
                  Invoice: {selectedInvoice.invoiceNo}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeCls(selectedInvoice.status)}`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Date
                  </p>
                  <p className="text-gray-800">
                    {selectedInvoice.dateNepali || selectedInvoice.date}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Customer
                  </p>
                  <p className="text-gray-800">{selectedInvoice.partyName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Payment Mode
                  </p>
                  <p className="text-gray-800 capitalize">{selectedInvoice.paymentMode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Grand Total
                  </p>
                  <p className="text-gray-800 font-mono font-semibold">
                    {money(selectedInvoice.grandTotal ?? 0)}
                  </p>
                </div>
              </div>

              {/* Lines */}
              {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Line Items
                  </p>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                            Item
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Rate
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedInvoice.lines.map((line: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-700">{line.itemName}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {line.qty} {line.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {money(line.rate)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">
                              {money(line.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedInvoice.narration && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Narration
                  </p>
                  <p className="text-[12px] text-gray-700 bg-[#f5f6fa] rounded px-3 py-2 border border-gray-200">
                    {selectedInvoice.narration}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-[#f5f6fa] flex justify-end gap-2">
              {selectedInvoice.status === "posted" && (
                <button
                  type="button"
                  onClick={async () => {
                    const reason = window.prompt("Enter cancellation reason:");
                    if (!reason) return;
                    try {
                      await updateInvoice(selectedInvoice.id, {
                        status: "cancelled",
                        cancellationReason: reason,
                      });
                      toast.success("Invoice cancelled.");
                      setSelectedInvoice(null);
                    } catch {
                      toast.error("Failed to cancel invoice.");
                    }
                  }}
                  // "danger" variant — NOT "destructive"
                  className="h-8 px-3 bg-white border border-red-300 text-red-600 text-[12px] font-medium rounded-md hover:bg-red-50 transition-colors"
                >
                  Cancel Invoice
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesVoucher;
