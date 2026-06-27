
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Input, Select, NepaliDatePicker, Badge, ActionToolbar, AmountInput } from "../components/ui";
import { Plus, X, Save, Printer, Copy, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { generateSerialNumber } from "../lib/accounting";
import { VoucherType, VoucherStatus } from "../lib/types";
import { calculateVoucherTotals, validateVoucherDate, formatVoucherDisplayDate } from "../lib/voucherUtils";
import toast from "react-hot-toast";
import { useScreenF12 } from "../hooks/useF12Config";

const PurchaseVoucher: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("purchase-voucher");

  const { accounts, items, parties, vouchers, companySettings, currentFiscalYear, addVoucher } = useStore();
  
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherNumber, setVoucherNumber] = useState<string>("Loading...");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [partyId, setPartyId] = useState<string>("");
  const [purchaseLedgerId, setPurchaseLedgerId] = useState<string>("");
  const [mode, setMode] = useState<"item-invoice" | "accounting-invoice">("item-invoice");
  const [isOptional, setIsOptional] = useState<boolean>(false);
  const [isPostDated, setIsPostDated] = useState<boolean>(false);
  const [narration, setNarration] = useState<string>("");
  const [roundOff, setRoundOff] = useState<number>(0);
  const [lines, setLines] = useState<Array<any>>([emptyLine()]);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState<boolean>(false);
  
  // New state for purchase-specific fields
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<"credit" | "cash" | "bank">("credit");
  const [cashBankLedgerId, setCashBankLedgerId] = useState<string>("");

  useEffect(() => {
    const generateNumber = async () => {
      try {
        const number = await generateSerialNumber(VoucherType.PURCHASE_INVOICE, undefined, currentFiscalYear?.fiscalYearBS);
        setVoucherNumber(number);
      } catch (error) {
        setVoucherNumber("PI-" + Date.now());
      }
    };
    generateNumber();
  }, []);

  const partyOptions = useMemo(() => {
    return parties
      .filter(party => party.type === "supplier" || party.type === "both")
      .map(party => ({ value: party.id, label: party.name }));
  }, [parties]);

  const itemOptions = useMemo(() => {
    return items
      .filter(item => item.isActive)
      .map(item => ({ value: item.id, label: `${item.code} - ${item.name}` }));
  }, [items]);

  const purchaseLedgerOptions = useMemo(() => {
    return accounts
      .filter(acc => acc.type === "expense" || acc.group?.toLowerCase().includes("purchase"))
      .map(acc => ({ value: acc.id, label: acc.name }));
  }, [accounts]);

  const cashBankLedgerOptions = useMemo(() => {
    return accounts
      .filter(acc => acc.type === "cash" || acc.type === "bank")
      .map(acc => ({ value: acc.id, label: acc.name }));
  }, [accounts]);

  const totals = useMemo(() => {
    const mappedLines = lines.map(line => ({
      debit: line.totalAmount || 0,
      credit: 0,
      amount: line.totalAmount || 0,
      taxAmount: line.taxAmount || 0
    }));
    return calculateVoucherTotals(mappedLines);
  }, [lines]);

  const subTotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  }, [lines]);

  const totalDiscount = useMemo(() => {
    return lines.reduce((sum, line) => sum + (line.discountAmount || 0), 0);
  }, [lines]);

  const totalTax = useMemo(() => {
    return lines.reduce((sum, line) => sum + (line.taxAmount || 0), 0);
  }, [lines]);

  const grandTotal = useMemo(() => {
    return subTotal - totalDiscount + totalTax + roundOff;
  }, [subTotal, totalDiscount, totalTax, roundOff]);

  function emptyLine() {
    return {
      key: Math.random().toString(36).substring(7),
      itemId: "",
      itemName: "",
      quantity: 1,
      unit: "",
      rate: 0,
      discount: 0,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      amount: 0,
      totalAmount: 0,
      godownId: "",
      narration: "",
      itcEligible: true
    };
  }

  const updateLine = useCallback((index: number, field: string, value: any) => {
    setLines(prev => {
      const newLines = [...prev];
      const line = { ...newLines[index] };
      
      if (field === "itemId") {
        const item = items.find(i => i.id === value);
        if (item) {
          line.itemId = value;
          line.itemName = item.name;
          line.unit = item.unit || "";
          line.rate = item.purchaseRate || 0;
          line.taxRate = item.vatRate || 0;
        }
      } else {
        line[field] = value;
      }
      
      // Recalculate amounts if relevant fields change
      if (field === "quantity" || field === "rate" || field === "discount" || field === "taxRate") {
        line.discountAmount = (line.rate * line.quantity * line.discount) / 100;
        line.amount = (line.rate * line.quantity) - line.discountAmount;
        line.taxAmount = (line.amount * line.taxRate) / 100;
        line.totalAmount = line.amount + line.taxAmount;
      }
      
      newLines[index] = line;
      setDirty(true);
      return newLines;
    });
  }, [items]);

  const addLine = useCallback(() => {
    if (lines.length >= 50) {
      toast.error("Maximum 50 lines allowed");
      return;
    }
    setLines(prev => [...prev, emptyLine()]);
    setDirty(true);
  }, [lines.length]);

  const removeLine = useCallback((index: number) => {
    if (lines.length <= 1) {
      toast.error("At least one line is required");
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, [lines.length]);

  const handleSave = async () => {
    const validation = validateVoucherDate(date, currentFiscalYear);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    if (!partyId) {
      toast.error("Please select a supplier");
      return;
    }

    if (paymentType !== "credit" && !cashBankLedgerId) {
      toast.error("Please select a cash/bank ledger for payment");
      return;
    }

    const hasValidLine = lines.some(line => line.itemId && line.quantity > 0);
    if (!hasValidLine) {
      toast.error("Please add at least one item");
      return;
    }

    if (grandTotal <= 0) {
      toast.error("Invoice amount cannot be zero");
      return;
    }

    // Check if supplier invoice number is required
    if (!supplierInvoiceNo && companySettings?.requireSupplierInvoiceNo) {
      toast.error("Supplier invoice number is required");
      return;
    }

    setSaving(true);

    try {
      const party = parties.find(p => p.id === partyId);
      const voucher = {
        id: "pinv-" + Date.now(),
        type: VoucherType.PURCHASE_INVOICE,
        voucherNo: voucherNumber,
        date: date,
        dateNepali: ADToBSString(date),
        partyId: partyId,
        partyName: party?.name || "",
        lines: lines.map(({ key, ...rest }) => rest),
        narration: narration,
        status: isOptional ? "optional" : VoucherStatus.POSTED,
        isOptional: isOptional,
        isPostDated: isPostDated,
        subTotal: subTotal,
        discountAmount: totalDiscount,
        taxableAmount: subTotal - totalDiscount,
        vatAmount: totalTax,
        grandTotal: grandTotal,
        paidAmount: paymentType === "credit" ? 0 : grandTotal,
        paymentStatus: paymentType === "credit" ? "unpaid" : "paid",
        supplierInvoiceNo: supplierInvoiceNo,
        supplierInvoiceDate: supplierInvoiceDate,
        paymentType: paymentType,
        cashBankLedgerId: paymentType === "credit" ? null : cashBankLedgerId,
        createdAt: new Date().toISOString()
      };

      await addVoucher(voucher);
      toast.success(`Purchase invoice saved successfully — ${voucherNumber}`);
      
      // Reset form
      resetForm();
      
      // Generate new voucher number
      const newNumber = await generateSerialNumber(VoucherType.PURCHASE_INVOICE, undefined, currentFiscalYear?.fiscalYearBS);
      setVoucherNumber(newNumber);
    } catch (error) {
      toast.error(error.message || "Failed to save purchase invoice");
    } finally {
      setSaving(false);
      setDirty(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setReferenceNo("");
    setPartyId("");
    setPurchaseLedgerId(purchaseLedgerOptions[0]?.value || "");
    setNarration("");
    setRoundOff(0);
    setLines([emptyLine()]);
    setIsOptional(false);
    setIsPostDated(false);
    
    // Reset purchase-specific fields
    setSupplierInvoiceNo("");
    setSupplierInvoiceDate(new Date().toISOString().split('T')[0]);
    setPaymentType("credit");
    setCashBankLedgerId("");
    
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

  return (
    <div className="p-4 pr-32">
      {/* Top Bar */}
      <ActionToolbar className="mb-4 sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold text-gray-800">Purchase Invoice</h1>
          <Badge variant="info">
            {mode === "item-invoice" ? "Item Invoice" : "Accounting Invoice"}
          </Badge>
          {isOptional && (
            <Badge variant="warning">
              Optional
            </Badge>
          )}
          {isPostDated && (
            <Badge variant="default">
              Post-Dated
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">No: {voucherNumber}</div>
          <NepaliDatePicker
            value={date}
            onChange={setDate}
            className="w-36"
          />
          <Input
            placeholder="Ref No."
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-32"
          />
        </div>
        
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save (Ctrl+A)
            </>
          )}
        </Button>
      </ActionToolbar>

      {/* Party Section */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
            <Select
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="Select supplier"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Ledger *</label>
            <Select
              value={purchaseLedgerId}
              onChange={setPurchaseLedgerId}
              options={purchaseLedgerOptions}
              placeholder="Select purchase account"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice No</label>
            <Input
              value={supplierInvoiceNo}
              onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              placeholder="Supplier's invoice no."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice Date</label>
            <NepaliDatePicker
              value={supplierInvoiceDate}
              onChange={setSupplierInvoiceDate}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
            <Select
              value={paymentType}
              onChange={setPaymentType}
              options={[
                { value: "credit", label: "Credit" },
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" }
              ]}
            />
          </div>
          
          {(paymentType === "cash" || paymentType === "bank") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash/Bank Ledger *</label>
              <Select
                value={cashBankLedgerId}
                onChange={setCashBankLedgerId}
                options={cashBankLedgerOptions}
                placeholder="Select cash/bank account"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Items Table Section */}
      <Card className="mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disc%</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax%</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ITC</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Del</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line, index) => (
                <tr key={line.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Select
                      value={line.itemId}
                      onChange={(value) => updateLine(index, "itemId", value)}
                      options={itemOptions}
                      placeholder="Select item"
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.quantity}
                      onChange={(value) => updateLine(index, "quantity", value)}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{line.unit}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.rate}
                      onChange={(value) => updateLine(index, "rate", value)}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.discount}
                      onChange={(value) => updateLine(index, "discount", value)}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                    {formatNumber(line.amount || 0)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <AmountInput
                      value={line.taxRate}
                      onChange={(value) => updateLine(index, "taxRate", value)}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {formatNumber(line.taxAmount || 0)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={line.itcEligible}
                      onChange={(e) => updateLine(index, "itcEligible", e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                    {formatNumber(line.totalAmount || 0)}
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
            Add Item
          </Button>
        </div>
      </Card>

      {/* Totals Section */}
      <Card className="mb-4 w-80 ml-auto">
        <div className="p-4 space-y-2">
          <div className="flex justify-between">
            <span>Sub Total:</span>
            <span className="font-medium">{formatNumber(subTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount:</span>
            <span className="font-medium">{formatNumber(totalDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxable:</span>
            <span className="font-medium">{formatNumber(subTotal - totalDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT/Tax:</span>
            <span className="font-medium">{formatNumber(totalTax)}</span>
          </div>
          <div className="flex justify-between">
            <span>Round Off:</span>
            <AmountInput
              value={roundOff}
              onChange={setRoundOff}
              className="w-24 text-right"
            />
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-bold">Grand Total:</span>
            <span className="font-bold text-lg text-amber-600">{formatNumber(grandTotal)}</span>
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
          variant={isOptional ? "secondary" : "outline"}
          onClick={() => {
            setIsOptional(!isOptional);
            setDirty(true);
          }}
          className={isOptional ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : ""}
        >
          Optional (Ctrl+L)
        </Button>
        
        <Button
          variant="outline"
          onClick={handleCancel}
          className="text-red-600 border-red-600 hover:bg-red-50"
        >
          Discard
        </Button>
        
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save (Ctrl+A)
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
              <Button
                variant="outline"
                onClick={() => setShowConfirmCancel(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancel}
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseVoucher;
