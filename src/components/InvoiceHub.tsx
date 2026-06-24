// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Table,
  Button,
  Input,
  Select,
  Modal,
  NepaliDatePicker,
  PartySelect,
  ItemSelect,
} from "./ui";
import {
  Receipt,
  Plus,
  Search,
  Eye,
  XOctagon,
  Printer,
  FileSpreadsheet,
  PlusCircle,
  Trash,
  Calculator,
} from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  ItemType,
  TdsType,
  PaymentStatus,
} from "../lib/types";
import { generateInvoicePDF } from "../lib/printUtils";
import { exportInvoicesToExcel } from "../lib/exportUtils";
import toast from "react-hot-toast";

const InvoiceHub: React.FC = () => {
  const {
    invoices,
    parties,
    items,
    addInvoice,
    cancelInvoice,
    companySettings,
    currentPage,
    setCurrentPage,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | VoucherType>("ALL");

  // Creation Sub-modes STATES
  const [isCreating, setIsCreating] = useState(false);
  const [invoiceType, setInvoiceType] = useState<VoucherType>(VoucherType.SALES_INVOICE);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [partyId, setPartyId] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>(PaymentMode.CREDIT);
  const [narration, setNarration] = useState("");
  const [refDDC, setRefDDC] = useState(""); // Delivery challan/Ref No

  // Invoice transaction item lines
  const [lines, setLines] = useState<any[]>([
    { itemId: "", qty: 1, rate: 0, discountPercent: 0, isTaxable: true },
  ]);

  // Tax Deducted at Source TDS parameters
  const [enableTds, setEnableTds] = useState(false);
  const [tdsType, setTdsType] = useState<TdsType>(TdsType.SERVICE_CONTRACT);
  const [tdsRate, setTdsRate] = useState<number>(1.5);

  // Selected invoice overlay details view
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const matchesSearch =
        i.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.partyName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab = activeTab === "ALL" || i.type === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [invoices, searchTerm, activeTab]);

  const handlePrintInvoicePDF = async (i: any) => {
    try {
      const party = parties.find((p) => p.id === i.partyId);
      if (!party) {
        toast.error("Identity Conflict: Party associated with invoice not found.");
        return;
      }
      const blob = await generateInvoicePDF(i, companySettings, party, items);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) {
        win.focus();
      }
    } catch (e) {
      toast.error("Failed to generate printable PDF document.");
    }
  };

  const handleExportExcel = () => {
    exportInvoicesToExcel(invoices);
    toast.success("Spreadsheet exported.");
  };

  // Line helpers
  const handleAddLine = () => {
    setLines([...lines, { itemId: "", qty: 1, rate: 0, discountPercent: 0, isTaxable: true }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) {
      toast.error("Legal standard tax invoices must contain at least 1 item.");
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    setLines(
      lines.map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, [field]: val };

        // Auto-load standard sales base rate when item changes
        if (field === "itemId") {
          const itemObj = items.find((itm) => itm.id === val);
          if (itemObj) {
            updated.rate =
              invoiceType === VoucherType.PURCHASE_INVOICE
                ? itemObj.purchaseRate
                : itemObj.salesRate;
            updated.isTaxable = itemObj.isTaxable !== false;
          }
        }
        return updated;
      }),
    );
  };

  // Live Auto Calculations Engine
  const invoiceCalculations = useMemo(() => {
    let subTotalVal = 0;
    let discVal = 0;
    let taxableVal = 0;
    let exemptVal = 0;

    lines.forEach((line) => {
      const rawLineTotal = line.qty * line.rate;
      const discountAmount = rawLineTotal * ((line.discountPercent || 0) / 100);
      const netLine = rawLineTotal - discountAmount;

      subTotalVal += rawLineTotal;
      discVal += discountAmount;

      if (line.isTaxable) {
        taxableVal += netLine;
      } else {
        exemptVal += netLine;
      }
    });

    const vatVal = taxableVal * 0.13;
    const grossVal = taxableVal + exemptVal + vatVal;

    let tdsDeductionVal = 0;
    if (enableTds) {
      // Direct TDS withhold deduction
      tdsDeductionVal = (taxableVal + exemptVal) * (tdsRate / 100);
    }

    const netBeforeRound = grossVal - tdsDeductionVal;
    const grandTotalVal = Math.round(netBeforeRound);
    const roundOffVal = grandTotalVal - netBeforeRound;

    return {
      subTotal: parseFloat(subTotalVal.toFixed(2)),
      discount: parseFloat(discVal.toFixed(2)),
      taxable: parseFloat(taxableVal.toFixed(2)),
      exempt: parseFloat(exemptVal.toFixed(2)),
      vat: parseFloat(vatVal.toFixed(2)),
      tds: parseFloat(tdsDeductionVal.toFixed(2)),
      roundOff: parseFloat(roundOffVal.toFixed(2)),
      grandTotal: grandTotalVal,
    };
  }, [lines, enableTds, tdsRate]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please specify a client customer or supplier.");
      return;
    }

    const invalidLine = lines.some((l) => !l.itemId || l.qty <= 0 || l.rate <= 0);
    if (invalidLine) {
      toast.error(
        "Billing failed: Invoice lines must list valid Inventory Items and non-zero counts.",
      );
      return;
    }

    try {
      const activeParty = parties.find((p) => p.id === partyId);
      const cleanLines = lines.map((l) => {
        const itemObj = items.find((itm) => itm.id === l.itemId);
        const gross = l.qty * l.rate;
        const discountAmt = gross * ((l.discountPercent || 0) / 100);
        const netAmt = gross - discountAmt;
        const lineVat = l.isTaxable ? netAmt * 0.13 : 0;

        return {
          itemId: l.itemId,
          itemName: itemObj?.name || "",
          itemCode: itemObj?.code || "",
          qty: l.qty,
          unit: itemObj?.unit || "PCS",
          rate: l.rate,
          discountPercent: l.discountPercent || 0,
          netAmount: parseFloat(netAmt.toFixed(2)),
          vatRate: l.isTaxable ? 13 : 0,
          vatAmount: parseFloat(lineVat.toFixed(2)),
          totalAmount: parseFloat((netAmt + lineVat).toFixed(2)),
        };
      });

      const { ADToBSString } = await import("../lib/nepaliDate");
      const bsStr = ADToBSString(date);

      await addInvoice({
        date,
        dateNepali: bsStr || "2083-04-15",
        type: invoiceType,
        partyId,
        partyName: activeParty?.name || "",
        partyPan: activeParty?.pan || "",
        paymentMode: payMode,
        paymentStatus: payMode === PaymentMode.CREDIT ? PaymentStatus.UNPAID : PaymentStatus.PAID,
        status: VoucherStatus.POSTED,
        subTotal: invoiceCalculations.subTotal,
        discountAmount: invoiceCalculations.discount,
        taxableAmount: invoiceCalculations.taxable,
        exemptAmount: invoiceCalculations.exempt,
        vatAmount: invoiceCalculations.vat,
        taxAmount: invoiceCalculations.vat,
        tdsAmount: enableTds ? invoiceCalculations.tds : undefined,
        tdsRate: enableTds ? tdsRate : undefined,
        tdsType: enableTds ? tdsType : undefined,
        roundOff: invoiceCalculations.roundOff,
        grandTotal: invoiceCalculations.grandTotal,
        lines: cleanLines,
        narration: narration.trim() || `Invoice generated for ${activeParty?.name}`,
      });

      toast.success("VAT Tax-Invoice billed, stock counts decremented, ledger nodes posted.");
      setIsCreating(false);

      // Reset
      setPartyId("");
      setLines([{ itemId: "", qty: 1, rate: 0, discountPercent: 0, isTaxable: true }]);
      setNarration("");
      setEnableTds(false);
    } catch (err: any) {
      toast.error(err.message || "Validation error.");
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please explain why this bill invoice must be voided.");
      return;
    }

    try {
      await cancelInvoice(selectedInvoice.id, cancelReason);
      toast.success("Tax-invoice set to cancel/void status, inventory levels restored.");
      setCancelOpen(false);
      setSelectedInvoice(null);
    } catch (err: any) {
      toast.error("Operation failed.");
    }
  };

  const tabs = [
    "ALL",
    VoucherType.SALES_INVOICE,
    VoucherType.PURCHASE_INVOICE,
    VoucherType.SALES_RETURN,
    VoucherType.PURCHASE_RETURN,
  ];

  if (isCreating || currentPage === "invoices-new") {
    return (
      <div className="flex flex-col gap-6 animate-fadeIn text-xs font-semibold select-none">
        {/* Title header */}
        <div className="flex items-center justify-between border-b border-[#9DC07A] pb-5">
          <div>
            <h2 className="text-xl font-bold text-[#000000] tracking-tight flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#000000]" />
              <span>GENERATE CORPORATE BILL INVOICE</span>
            </h2>
            <p className="text-xs text-[#000000] mt-1 leading-none uppercase tracking-wider font-bold">
              Inland Revenue Department compliant VAT billing console
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreating(false);
              if (currentPage === "invoices-new") setCurrentPage("invoices");
            }}
          >
            Discard & Exit
          </Button>
        </div>

        <form
          onSubmit={handleSaveInvoice}
          className="flex flex-col gap-6 select-none font-semibold text-[#000000]"
        >
          {/* General particulars */}
          <Card border padding="md">
            <div className="grid grid-cols-4 gap-4 bg-white">
              <Select
                label="Invoice Bill Module"
                options={[
                  { value: VoucherType.SALES_INVOICE, label: "Sales Tax Invoice (Tax-Bill out)" },
                  {
                    value: VoucherType.PURCHASE_INVOICE,
                    label: "Purchase Invoice (Inward Expense)",
                  },
                  { value: VoucherType.SALES_RETURN, label: "Sales Return (Credit Note)" },
                  { value: VoucherType.PURCHASE_RETURN, label: "Purchase Return (Debit Note)" },
                ]}
                value={invoiceType}
                onChange={(val) => setInvoiceType(val as VoucherType)}
                required
              />
              <NepaliDatePicker
                label="Transaction invoice date"
                value={date}
                onChange={setDate}
                required
              />
              <PartySelect
                label={invoiceType.includes("sales") ? "Client Customer" : "Trade Supplier"}
                value={partyId}
                onChange={setPartyId}
                required
              />
              <Select
                label="Terms of Payment"
                options={[
                  { value: PaymentMode.CREDIT, label: "On Credit terms (Unpaid Debt)" },
                  { value: PaymentMode.CASH, label: "Paid Cache (Liquid Petty)" },
                  { value: PaymentMode.BANK_TRANSFER, label: "Bank Transfer (E-Sewa/Imediate)" },
                ]}
                value={payMode}
                onChange={(val) => setPayMode(val as PaymentMode)}
                required
              />
            </div>
          </Card>

          {/* Line item builder */}
          <Card title="Billing Line Items Details Grid">
            <div className="flex flex-col gap-4">
              <div className="border border-[#9DC07A] rounded-lg overflow-hidden bg-white shadow-sm">
                <table className="w-full text-xs text-left border-collapse font-bold">
                  <thead className="bg-[#EBF5E2] border-b border-[#9DC07A] text-[#000000] uppercase tracking-wider font-bold select-none">
                    <tr>
                      <th className="px-3 py-2 w-[40%]">Stock Item</th>
                      <th className="px-3 py-2 w-[12%] text-center">Billing Qty</th>
                      <th className="px-3 py-2 w-[16%] text-right">Unit Rate</th>
                      <th className="px-3 py-2 w-[12%] text-center">Discount %</th>
                      <th className="px-3 py-2 w-[10%] text-center">13% VAT</th>
                      <th className="px-3 py-2 w-[10%] text-center">Line clear</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-[#EBF5E2]/50">
                        <td className="px-2.5 py-1.5">
                          <ItemSelect
                            value={line.itemId}
                            onChange={(val) => handleLineChange(idx, "itemId", val)}
                            required
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <Input
                            type="number"
                            value={line.qty}
                            onChange={(v) => handleLineChange(idx, "qty", parseInt(v) || 0)}
                            align="center"
                            min={1}
                            required
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <Input
                            type="number"
                            value={line.rate === 0 ? "" : line.rate}
                            onChange={(v) => handleLineChange(idx, "rate", parseFloat(v) || 0)}
                            prefix="Rs."
                            align="right"
                            required
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <Input
                            type="number"
                            value={line.discountPercent === 0 ? "" : line.discountPercent}
                            onChange={(v) =>
                              handleLineChange(idx, "discountPercent", parseFloat(v) || 0)
                            }
                            suffix="%"
                            align="center"
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={line.isTaxable}
                            onChange={(e) => handleLineChange(idx, "isTaxable", e.target.checked)}
                            className="h-4 w-4 text-[#000000] border-[#9DC07A] rounded focus:ring-[#3D6B25]"
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove catalog line"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-[#EBF5E2] border border-[#9DC07A] rounded-lg p-3">
                <span className="text-[11px] text-[#000000] leading-none">
                  Billing regulations: Standard Nepalese invoices must break down taxable and exempt
                  portions clearly.
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1.5 text-xs text-[#000000] bg-[#D4EABD] hover:bg-[#D4EABD] border border-[#9DC07A] rounded-md font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="h-[18px] w-[18px]" />
                  <span>Insert Item Row</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Bottom Panel: calculations & TDS settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            <div className="flex flex-col gap-4">
              {/* TDS Tax withholding settings Card */}
              <Card title="Withholding TDS Selection (Annex Book)" border>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tdsCheck"
                      checked={enableTds}
                      onChange={(e) => setEnableTds(e.target.checked)}
                      className="h-4 w-4 text-[#000000] focus:ring-[#3D6B25] rounded border-[#9DC07A]"
                    />
                    <label htmlFor="tdsCheck" className="text-xs font-bold text-[#000000]">
                      Apply withholding TDS deduction on base invoice
                    </label>
                  </div>
                  {enableTds && (
                    <div className="grid grid-cols-2 gap-4 border-t border-[#9DC07A] pt-4 animate-fadeIn">
                      <Select
                        label="Withholding TDS Class"
                        options={Object.values(TdsType).map((t) => ({
                          value: t,
                          label: t.charAt(0) + t.slice(1).toLowerCase().replace("_", " "),
                        }))}
                        value={tdsType}
                        onChange={(val) => {
                          setTdsType(val as TdsType);
                          if (val === TdsType.SERVICE_CONTRACT) setTdsRate(1.5);
                          else if (val === TdsType.HOUSE_RENT) setTdsRate(10);
                          else if (val === TdsType.CONSULTANCY) setTdsRate(15);
                        }}
                        required
                      />
                      <Input
                        label="Withholding TDS % rate"
                        type="number"
                        value={tdsRate}
                        onChange={(v) => setTdsRate(parseFloat(v) || 0)}
                        suffix="%"
                        align="center"
                        step={0.1}
                      />
                    </div>
                  )}
                </div>
              </Card>

              {/* General narrictions */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#000000] leading-none">
                  Billing Invoice Remarks / Narration details
                </label>
                <textarea
                  placeholder="e.g. Sales delivery dispatched via Nepal Goods Carrier, delivery Challan # DC-3004..."
                  rows={3}
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full text-xs font-medium p-3 border border-[#9DC07A] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D6B25] focus:border-[#9DC07A] bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Calculations summaries Card */}
            <Card
              title="Summary Bill Calculations Valuation"
              action={<Calculator className="h-4 w-4 text-[#000000]" />}
            >
              <div className="flex flex-col gap-3 font-semibold text-xs text-[#000000] font-mono">
                <div className="flex justify-between">
                  <span>Gross Valuation (Rates * counts):</span>
                  <span>Rs. {formatNumber(invoiceCalculations.subTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts deducted sum:</span>
                  <span>(Rs. {formatNumber(invoiceCalculations.discount)})</span>
                </div>
                <div className="flex justify-between text-[#000000] border-t border-dashed pt-2">
                  <span className="font-bold">Taxable Turnover valuation:</span>
                  <span className="font-bold">Rs. {formatNumber(invoiceCalculations.taxable)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exempted non-VAT balance:</span>
                  <span>Rs. {formatNumber(invoiceCalculations.exempt)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span>13% VAT standard collected:</span>
                  <span>Rs. {formatNumber(invoiceCalculations.vat)}</span>
                </div>
                {enableTds && (
                  <div className="flex justify-between text-amber-600">
                    <span>Withheld TDS deductible ({tdsRate}%):</span>
                    <span>(Rs. {formatNumber(invoiceCalculations.tds)})</span>
                  </div>
                )}
                {invoiceCalculations.roundOff !== 0 && (
                  <div className="flex justify-between text-[#000000]">
                    <span>Round Off correction:</span>
                    <span>Rs. {formatNumber(invoiceCalculations.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[#000000] border-t border-double border-t-2 pt-3 font-bold text-sm">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#000000]">
                    Gross Grand Total Payable:
                  </span>
                  <span className="text-xl font-extrabold text-[#000000]">
                    Rs. {formatNumber(invoiceCalculations.grandTotal)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 mt-6 font-sans">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCreating(false);
                      if (currentPage === "invoices-new") setCurrentPage("invoices");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" onClick={handleSaveInvoice}>
                    Register Tax Bill Invoice
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#9DC07A] pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#000000] tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#000000]" />
            <span>TAX INVOICE BILL REGISTER</span>
          </h2>
          <p className="text-xs text-[#000000] mt-1 leading-none font-semibold uppercase tracking-wider">
            Sutra Fiscal VAT Sales and Purchase Bills
          </p>
        </div>

        <div className="shrink-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            Export Bills Register
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Create Tax Invoice Bill
          </Button>
        </div>
      </div>

      {/* FILTER SEARCH PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-[#9DC07A] rounded-xl shadow-sm">
        <div className="w-full md:max-w-xs relative bg-white">
          <Input
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search invoice number, buyer/supplier..."
            inputClassName="pl-9 text-xs"
          />
          <div className="absolute left-3 top-2.5 text-[#000000]">
            <Search className="h-4 w-4" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border border-transparent select-none shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors border select-none uppercase tracking-wide ${activeTab === tab ? "bg-[#D4EABD] text-white border-[#9DC07A]" : "bg-[#EBF5E2] text-[#000000] border-[#9DC07A] hover:bg-[#EBF5E2] hover:text-[#000000]"}`}
            >
              {tab === "ALL" ? "Show All" : tab.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table grid */}
      <Card border padding="none">
        <Table
          columns={[
            {
              key: "invoiceNo",
              header: "Bill Serial",
              width: "15%",
              render: (no) => <span className="font-mono font-bold text-[#000000]">{no}</span>,
            },
            {
              key: "date",
              header: "Date",
              render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
            },
            {
              key: "partyName",
              header: "Supplier / Customer entity",
              width: "28%",
              render: (name, row) => (
                <div className="flex flex-col">
                  <span className="font-bold text-[#000000] leading-tight">{name}</span>
                  {row.partyPan && (
                    <span className="text-[10px] font-mono font-medium text-[#000000] mt-0.5">
                      PAN: {row.partyPan}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "type",
              header: "Bill Module",
              width: "12%",
              render: (val) => (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#000000] leading-none">
                  {String(val).replace("-", " ")}
                </span>
              ),
            },
            {
              key: "grandTotal",
              header: "Gross Billed Val",
              align: "right",
              width: "13%",
              render: (val) => (
                <span className="font-mono font-bold text-[#000000]">{formatCurrency(val)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "10%",
              render: (val) => (
                <Badge
                  variant={
                    val === VoucherStatus.POSTED
                      ? "success"
                      : val === VoucherStatus.DRAFT
                        ? "warning"
                        : "danger"
                  }
                >
                  {val === VoucherStatus.POSTED
                    ? "POSTED ✓"
                    : val === VoucherStatus.DRAFT
                      ? "DRAFT"
                      : "VOIDED Ø"}
                </Badge>
              ),
            },
          ]}
          data={filteredInvoices}
          rowKey="id"
          onRowClick={(row) => setSelectedInvoice(row)}
          emptyMessage="No legal tax Invoices generated in this workspace yet."
        />
      </Card>

      {/* SELECTED DETAILS OVERLAY MODAL */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Fiscal Tax Invoice: ${selectedInvoice.invoiceNo}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {selectedInvoice.status === VoucherStatus.POSTED && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XOctagon className="h-4 w-4" />}
                    onClick={() => {
                      setCancelReason("");
                      setCancelOpen(true);
                    }}
                  >
                    Cancel/Void Bill
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintInvoicePDF(selectedInvoice)}
                  icon={<Printer className="h-4 w-4" />}
                >
                  Print Legal PDF Bill
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedInvoice(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-6 select-none font-semibold text-[#000000] text-xs">
            <div className="grid grid-cols-4 gap-4 bg-[#EBF5E2] border border-[#9DC07A] p-4 rounded-xl leading-relaxed">
              <div>
                <span className="block text-[10px] uppercase text-[#000000] font-bold tracking-wider leading-none mb-1">
                  Invoice NO
                </span>
                <span className="font-mono font-extrabold text-[#000000] text-sm leading-none">
                  {selectedInvoice.invoiceNo}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#000000] font-bold tracking-wider leading-none mb-1">
                  Billed Date (BS)
                </span>
                <span className="font-bold text-[#000000] text-sm leading-none">
                  {selectedInvoice.dateNepali}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#000000] font-bold tracking-wider leading-none mb-1">
                  Tax Register Client
                </span>
                <span className="font-bold text-[#000000] text-xs truncate max-w-[120px] block leading-none">
                  {selectedInvoice.partyName}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#000000] font-bold tracking-wider leading-none mb-1">
                  Payment Mode
                </span>
                <span className="text-[#000000] font-extrabold uppercase mt-1 block leading-none">
                  {selectedInvoice.paymentMode}
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase text-[#000000] font-bold tracking-wider">
                Dispatched catalog lines list
              </span>
              <div className="border border-[#9DC07A] rounded-lg overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs border-collapse font-bold">
                  <thead className="bg-[#EBF5E2] border-b text-[#000000]">
                    <tr>
                      <th className="px-3 py-2 w-[40%]">Item Description</th>
                      <th className="px-3 py-2 text-center w-[12%]">Qty</th>
                      <th className="px-3 py-2 text-right w-[16%]">Rate</th>
                      <th className="px-3 py-2 text-center w-[12%]">Dis %</th>
                      <th className="px-3 py-2 text-right w-[20%]">Line gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {selectedInvoice.lines.map((l: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#EBF5E2]/20">
                        <td className="px-3 py-2 text-[#000000]">{l.itemName}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {l.qty} {l.unit}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          Rs. {formatNumber(l.rate)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {l.discountPercent > 0 ? `${l.discountPercent}%` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          Rs. {formatNumber(l.netAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations breakdown details */}
            <div className="grid grid-cols-2 gap-6 border-t border-[#9DC07A] pt-4 font-mono">
              <div className="flex flex-col gap-1.5 leading-relaxed font-sans text-xs">
                <span className="text-[10px] text-[#000000] font-bold uppercase tracking-wider block font-sans">
                  Remarks / Explanation
                </span>
                <p className="bg-[#EBF5E2]/50 border rounded-lg p-3 text-[#000000] font-semibold">
                  {selectedInvoice.narration}
                </p>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Gross Valuation:</span>
                  <span>Rs. {formatNumber(selectedInvoice.subTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Line Discounts:</span>
                  <span>(Rs. {formatNumber(selectedInvoice.discountAmount)})</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-1.5">
                  <span>Taxable Val (13% VAT):</span>
                  <span>Rs. {formatNumber(selectedInvoice.taxableAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exempt Non-VAT Billed:</span>
                  <span>Rs. {formatNumber(selectedInvoice.exemptAmount)}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span>VAT Collected standard:</span>
                  <span>Rs. {formatNumber(selectedInvoice.vatAmount)}</span>
                </div>
                {selectedInvoice.tdsAmount && selectedInvoice.tdsAmount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Withholding TDS ({selectedInvoice.tdsRate}%):</span>
                    <span>(Rs. {formatNumber(selectedInvoice.tdsAmount)})</span>
                  </div>
                )}
                {selectedInvoice.roundOff !== 0 && (
                  <div className="flex justify-between text-[#000000]">
                    <span>Round Off correction:</span>
                    <span>Rs. {formatNumber(selectedInvoice.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#000000] border-t border-double border-t-2 pt-2 text-sm">
                  <span className="font-sans">Grand total paid:</span>
                  <span className="text-[#000000]">
                    Rs. {formatNumber(selectedInvoice.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {selectedInvoice.status === VoucherStatus.CANCELLED && (
              <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
                <div className="flex flex-col">
                  <span className="font-bold text-red-800 leading-none">
                    Cancellation / Void details statement
                  </span>
                  <p className="text-[11px] font-semibold text-red-650 mt-1">
                    {selectedInvoice.cancellationReason}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* CANCEL VOID OVERLAY MODAL */}
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Record Bill cancel reason statement"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmCancel}>
              Void Billed Invoice
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-xs select-none">
          <p className="text-[#000000] leading-relaxed font-semibold">
            Are you sure you want to cancel and void this legal VAT tax-bill? This will reverse
            ledger accounts postings and restore warehouse inventory stock levels. This transaction
            cannot be undone.
          </p>
          <Input
            label="Provide Cancellation/Void Reason statement"
            placeholder="e.g. Returned goods, invoice code duplicated..."
            value={cancelReason}
            onChange={setCancelReason}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceHub;

