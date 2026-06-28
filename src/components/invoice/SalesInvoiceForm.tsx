// @ts-nocheck
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
import { useStore } from "@/store/useStore";
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
import { formatNumber, round2 } from "@/lib/utils";
import { generateSerialNumber } from "@/lib/accounting";
import { VoucherType, InvoiceStatus } from "@/lib/types";
import { computeVAT } from "@/lib/taxUtils";
import { validateVoucherDate } from "@/lib/voucherUtils";
import toast from "react-hot-toast";
import InvoiceLineItem from "./InvoiceLineItem";

interface SalesInvoiceFormProps {
  invoiceId?: string;
  invoiceType: VoucherType;
  onSave?: (invoice: any) => void;
  onCancel?: () => void;
}

const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({
  invoiceId,
  invoiceType,
  onSave,
  onCancel,
}) => {
  const {
    invoices,
    parties,
    items,
    accounts,
    fiscalYears,
    currentFiscalYear,
    companySettings,
    addInvoice,
    updateInvoice,
    setCurrentPage,
  } = useStore();

  const isEdit = !!invoiceId;
  const editingInvoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId),
    [invoices, invoiceId]
  );

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0]
  );
  const [effectiveDate, setEffectiveDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0]
  );
  const [voucherNumber, setVoucherNumber] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [partyId, setPartyId] = useState("");
  const [salesLedgerId, setSalesLedgerId] = useState("");
  const [narration, setNarration] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [lines, setLines] = useState<any[]>([]);
  const [isOptional, setIsOptional] = useState(false);
  const [isPostDated, setIsPostDated] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");

  // Initialize form for edit or new
  useEffect(() => {
    const initForm = async () => {
      if (isEdit && editingInvoice) {
        // Editing existing invoice
        setDate(editingInvoice.date);
        setEffectiveDate(editingInvoice.effectiveDate || editingInvoice.date);
        setVoucherNumber(editingInvoice.invoiceNo);
        setReferenceNo(editingInvoice.referenceNo || "");
        setPartyId(editingInvoice.partyId);
        setSalesLedgerId(editingInvoice.salesLedgerId);
        setNarration(editingInvoice.narration);
        setRoundOff(editingInvoice.roundOff || 0);
        setLines([...editingInvoice.lines]);
        setIsOptional(editingInvoice.isOptional || false);
        setIsPostDated(editingInvoice.isPostDated || false);
        setPaymentTerms(editingInvoice.paymentTerms || "");
        setDeliveryDate(editingInvoice.deliveryDate || "");
        setEwayBillNo(editingInvoice.ewayBillNo || "");
        setPlaceOfSupply(editingInvoice.placeOfSupply || "");
      } else {
        // New invoice
        resetForm();
      }
    };

    initForm();
  }, [isEdit, editingInvoice]);

  // Generate serial number when type changes
  useEffect(() => {
    if (!isEdit) {
      const generateNumber = async () => {
        try {
          const number = await generateSerialNumber(
            invoiceType,
            undefined,
            currentFiscalYear?.fiscalYearBS
          );
          setVoucherNumber(number);
        } catch (error) {
          console.error("Failed to generate serial number:", error);
        }
      };

      generateNumber();
    }
  }, [invoiceType, isEdit, currentFiscalYear]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setReferenceNo("");
    setPartyId("");
    setSalesLedgerId(salesLedgerOptions[0]?.value || "");
    setNarration("");
    setRoundOff(0);
    setLines([emptyLine()]);
    setIsOptional(false);
    setIsPostDated(false);
    setPaymentTerms("");
    setDeliveryDate("");
    setEwayBillNo("");
    setPlaceOfSupply("");
    setDirty(false);
  };

  const emptyLine = () => ({
    id: Date.now(),
    itemId: "",
    description: "",
    quantity: 1,
    rate: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  const salesLedgerOptions = useMemo(() => {
    return accounts
      .filter((acc) => acc.type === "Sales Accounts")
      .map((acc) => ({ value: acc.id, label: acc.name }));
  }, [accounts]);

  const validate = () => {
    if (!partyId) {
      toast.error("Please select a party");
      return false;
    }
    if (!voucherNumber.trim()) {
      toast.error("Invoice number is required");
      return false;
    }
    if (lines.length === 0) {
      toast.error("At least one line item is required");
      return false;
    }
    if (lines.some((line) => !line.itemId)) {
      toast.error("All line items must have an item selected");
      return false;
    }
    if (lines.some((line) => line.quantity <= 0)) {
      toast.error("Quantity must be greater than zero");
      return false;
    }
    if (lines.some((line) => line.rate < 0)) {
      toast.error("Rate cannot be negative");
      return false;
    }

    const dateValidation = validateVoucherDate(date, currentFiscalYear);
    if (!dateValidation.valid) {
      toast.error(dateValidation.error);
      return false;
    }

    return true;
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const invoiceData = {
        id: isEdit ? invoiceId : undefined,
        invoiceNo: voucherNumber,
        type: invoiceType,
        date,
        effectiveDate,
        partyId,
        salesLedgerId,
        narration,
        roundOff,
        lines,
        referenceNo,
        isOptional,
        isPostDated,
        paymentTerms,
        deliveryDate,
        ewayBillNo,
        placeOfSupply,
        status: InvoiceStatus.DRAFT,
        createdBy: "current_user", // Replace with actual user
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isEdit) {
        await updateInvoice(invoiceData);
        toast.success("Invoice updated successfully");
      } else {
        await addInvoice(invoiceData);
        toast.success("Invoice saved successfully");
      }

      onSave?.(invoiceData);
      setDirty(false);
    } catch (error) {
      console.error("Failed to save invoice:", error);
      toast.error(error.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLine = () => {
    setLines([...lines, emptyLine()]);
    setDirty(true);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
    setDirty(true);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index] };
    line[field] = value;

    // Recalculate line amounts
    line.discountAmount = (line.quantity * line.rate * line.discountPercent) / 100;
    line.taxableAmount = line.quantity * line.rate - line.discountAmount;
    const vatResult = computeVAT(
      line.taxableAmount,
      line.taxRate,
      "inclusive"
    );
    line.taxAmount = vatResult.taxAmount;
    line.totalAmount = vatResult.totalWithTax;

    newLines[index] = line;
    setLines(newLines);
    setDirty(true);
  };

  // Calculate totals
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.taxableAmount, 0),
    [lines]
  );
  const totalTax = useMemo(
    () => lines.reduce((sum, line) => sum + line.taxAmount, 0),
    [lines]
  );
  const grandTotal = useMemo(
    () => round2(subtotal + totalTax + roundOff),
    [subtotal, totalTax, roundOff]
  );

  const balanceIndicator = useMemo(() => {
    if (Math.abs(grandTotal) < 0.01) {
      return { balanced: true, message: "Balanced" };
    }
    return { balanced: false, message: `Unbalanced: ${formatNumber(grandTotal)}` };
  }, [grandTotal]);

  const invoiceTypeName = useMemo(() => {
    switch (invoiceType) {
      case VoucherType.SALES_INVOICE:
        return "Sales Invoice";
      case VoucherType.PURCHASE_INVOICE:
        return "Purchase Invoice";
      case VoucherType.SALES_RETURN:
        return "Sales Return";
      case VoucherType.PURCHASE_RETURN:
        return "Purchase Return";
      default:
        return "Invoice";
    }
  }, [invoiceType]);

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{invoiceTypeName}</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Create tax invoice, sales return, proforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage("billing")}
            className={`h-8 px-3 text-[12px] font-medium border rounded-md ${
              invoiceType === VoucherType.SALES_INVOICE
                ? "bg-[#e8f1ff] text-[#1557b0] border-[#1557b0]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Sales Invoice
          </button>
          <button
            onClick={() => setCurrentPage("purchase-register")}
            className={`h-8 px-3 text-[12px] font-medium border rounded-md ${
              invoiceType === VoucherType.PURCHASE_INVOICE
                ? "bg-[#e8f1ff] text-[#1557b0] border-[#1557b0]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Purchase Invoice
          </button>
          <button
            onClick={() => setCurrentPage("sales-return")}
            className={`h-8 px-3 text-[12px] font-medium border rounded-md ${
              invoiceType === VoucherType.SALES_RETURN
                ? "bg-[#e8f1ff] text-[#1557b0] border-[#1557b0]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Sales Return
          </button>
          <button
            onClick={() => setCurrentPage("purchase-return")}
            className={`h-8 px-3 text-[12px] font-medium border rounded-md ${
              invoiceType === VoucherType.PURCHASE_RETURN
                ? "bg-[#e8f1ff] text-[#1557b0] border-[#1557b0]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Purchase Return
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSaveInvoice} className="space-y-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">INVOICE DETAILS</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Invoice No.</label>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={(e) => {
                      setVoucherNumber(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                    readOnly={isEdit}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Reference No.</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => {
                      setReferenceNo(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => {
                      setEffectiveDate(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">PARTY DETAILS</div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Party</label>
                  <PartySelect
                    value={partyId}
                    onChange={(value) => {
                      setPartyId(value);
                      setDirty(true);
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Sales Ledger</label>
                  <select
                    value={salesLedgerId}
                    onChange={(e) => {
                      setSalesLedgerId(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                  >
                    {salesLedgerOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">LINE ITEMS</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-left w-10">
                      #
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-left">
                      Item
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                      Rate
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                      Discount %
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                      Tax %
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                      Amount
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-left w-10">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <InvoiceLineItem
                      key={line.id}
                      line={line}
                      index={index}
                      items={items}
                      onRemove={handleRemoveLine}
                      onChange={handleLineChange}
                    />
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={handleAddLine}
                className="mt-2 text-[12px] text-[#1557b0] hover:underline"
              >
                + Add Line Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">SUMMARY</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[12px] text-gray-700">
                  <span>Subtotal</span>
                  <span>Rs. {formatNumber(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-gray-700">
                  <span>VAT</span>
                  <span>Rs. {formatNumber(totalTax)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-gray-700">
                  <span>Round Off</span>
                  <span>Rs. {formatNumber(roundOff)}</span>
                </div>
                <div className="flex justify-between pt-2 mt-1 border-t border-gray-300 text-[14px] font-bold text-gray-900">
                  <span>Grand Total</span>
                  <span>Rs. {formatNumber(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">OTHER DETAILS</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 block mb-1">Narration</label>
                    <textarea
                      value={narration}
                      onChange={(e) => {
                        setNarration(e.target.value);
                        setDirty(true);
                      }}
                      className="w-full h-20 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 resize-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 block mb-1">Payment Terms</label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => {
                          setPaymentTerms(e.target.value);
                          setDirty(true);
                        }}
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 block mb-1">Delivery Date</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => {
                          setDeliveryDate(e.target.value);
                          setDirty(true);
                        }}
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 block mb-1">e-Way Bill No.</label>
                      <input
                        type="text"
                        value={ewayBillNo}
                        onChange={(e) => {
                          setEwayBillNo(e.target.value);
                          setDirty(true);
                        }}
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 block mb-1">Place of Supply</label>
                      <input
                        type="text"
                        value={placeOfSupply}
                        onChange={(e) => {
                          setPlaceOfSupply(e.target.value);
                          setDirty(true);
                        }}
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-gray-800 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {balanceIndicator.balanced ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md text-[12px] text-green-700 font-medium">
                  ✓ Balanced
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-[12px] text-red-700 font-medium">
                  ⚠ {balanceIndicator.message}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
              >
                {saving ? "Saving..." : isEdit ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Discard Changes?"
        message="Are you sure you want to discard unsaved changes?"
        confirmText="Discard"
        cancelText="Keep Editing"
        onConfirm={() => {
          onCancel?.();
          setConfirmCancel(false);
        }}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
};

export default SalesInvoiceForm;
