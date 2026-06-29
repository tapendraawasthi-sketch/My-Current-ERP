// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  Plus,
  Trash2,
  Save,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  X,
  CheckCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Badge } from "../components/ui";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

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

function computeLine(line: SalesLine): SalesLine {
  const gross = line.qty * line.rate;
  const discAmt = gross * (line.discountPercent / 100);
  const net = gross - discAmt;
  const vat = line.isTaxable ? net * (line.vatRate / 100) : 0;
  return {
    ...line,
    discountAmount: parseFloat(discAmt.toFixed(2)),
    netAmount: parseFloat(net.toFixed(2)),
    vatAmount: parseFloat(vat.toFixed(2)),
    totalAmount: parseFloat((net + vat).toFixed(2)),
  };
}

function getStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "posted": return "success";
    case "draft": return "warning";
    case "cancelled": return "danger";
    case "submitted": case "under_review": return "info";
    default: return "default";
  }
}

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
    [parties]
  );

  const salesItems = useMemo(
    () => items.filter((i) => i.isActive !== false),
    [items]
  );

  // ── Line calculations ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0);
    const taxable = lines.filter((l) => l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const exempt = lines.filter((l) => !l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
    const billDisc =
      billDiscountAmount > 0
        ? billDiscountAmount
        : (taxable + exempt) * (billDiscountPercent / 100);
    const grandRaw = taxable + exempt + vat - billDisc;
    const grandTotal = Math.round(grandRaw);
    const autoRoundOff = parseFloat((grandTotal - grandRaw).toFixed(2));
    return {
      subTotal,
      lineDiscount,
      taxable,
      exempt,
      vat,
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
              costPrice: item.costPrice ?? 0,
            };
          }
        }
        return computeLine(updated);
      })
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
            (inv.partyName ?? "").toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [invoices, statusFilter, searchTerm]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">

      {/* ── Page Header — NO ActionToolbar, NO children prop ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Sales Invoice</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Create and manage sales invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge variant uses "default" not "outline" */}
          <Badge variant="default">
            {(companySettings?.name ?? "Company")}
          </Badge>
          {currentFiscalYear && (
            <Badge variant="info">
              FY {currentFiscalYear.name}
            </Badge>
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
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
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
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
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
                                parseFloat(e.target.value) || 0
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

                      {/* VAT checkbox */}
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={line.isTaxable}
                          onChange={(e) =>
                            updateLine(line.id, "isTaxable", e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]/20"
                        />
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
                    <span className="font-mono text-[#1557b0]">
                      {money(totals.grandTotal)}
                    </span>
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
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-2 shadow-sm">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by invoice no. or customer…"
                className="h-8 pl-3 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="all">All Statuses</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Invoice
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Invoice No.
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
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-12 text-center text-[12px] text-gray-400"
                      >
                        No sales invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-mono font-semibold text-gray-800">
                          {inv.invoiceNo}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {inv.dateNepali || inv.date}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {inv.partyName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-gray-800">
                          {money(inv.grandTotal ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={getStatusVariant(inv.status)}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                        >
                          <button
                            type="button"
                            className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-[#1557b0] hover:bg-[#1557b0]/10 rounded transition-colors mx-auto"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                <Badge variant={getStatusVariant(selectedInvoice.status)}>
                  {selectedInvoice.status}
                </Badge>
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
                  <p className="text-gray-800 capitalize">
                    {selectedInvoice.paymentMode || "—"}
                  </p>
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
