
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

const SalesVoucher: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("sales-voucher");

  const { accounts, items, parties, vouchers, companySettings, currentFiscalYear, addVoucher } = useStore();
  
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherNumber, setVoucherNumber] = useState<string>("Loading...");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [partyId, setPartyId] = useState<string>("");
  const [salesLedgerId, setSalesLedgerId] = useState<string>("");
  const [mode, setMode] = useState<"item-invoice" | "accounting-invoice">("item-invoice");
  const [isOptional, setIsOptional] = useState<boolean>(false);
  const [isPostDated, setIsPostDated] = useState<boolean>(false);
  const [narration, setNarration] = useState<string>("");
  const [roundOff, setRoundOff] = useState<number>(0);
  const [lines, setLines] = useState<Array<any>>([emptyLine()]);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState<boolean>(false);

  useEffect(() => {
    const generateNumber = async () => {
      try {
        const number = await generateSerialNumber(VoucherType.SALES_INVOICE, undefined, currentFiscalYear?.fiscalYearBS);
        setVoucherNumber(number);
      } catch (error) {
        setVoucherNumber("SI-" + Date.now());
      }
    };
    generateNumber();
  }, []);

  const partyOptions = useMemo(() => {
    return parties
      .filter(party => party.type === "customer" || party.type === "both")
      .map(party => ({ value: party.id, label: party.name }));
  }, [parties]);

  const itemOptions = useMemo(() => {
    return items
      .filter(item => item.isActive)
      .map(item => ({ value: item.id, label: `${item.code} - ${item.name}` }));
  }, [items]);

  const salesLedgerOptions = useMemo(() => {
    return accounts
      .filter(acc => acc.type === "income" || acc.group?.toLowerCase().includes("sales"))
      .map(acc => ({ value: acc.id, label: acc.name }));
  }, [accounts]);

  const totals = useMemo(() => {
    const mappedLines = lines.map(line => ({
      debit: 0,
      credit: line.totalAmount || 0,
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
      narration: ""
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
          line.rate = item.salesRate || 0;
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
      toast.error("Please select a party/customer");
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

    setSaving(true);

    try {
      const party = parties.find(p => p.id === partyId);
      const voucher = {
        id: "sinv-" + Date.now(),
        type: VoucherType.SALES_INVOICE,
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
        paidAmount: 0,
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString()
      };

      await addVoucher(voucher);
      toast.success(`Sales invoice saved successfully — ${voucherNumber}`);
      
      // Reset form
      resetForm();
      
      // Generate new voucher number
      const newNumber = await generateSerialNumber(VoucherType.SALES_INVOICE, undefined, currentFiscalYear?.fiscalYearBS);
      setVoucherNumber(newNumber);
    } catch (error) {
      toast.error(error.message || "Failed to save sales invoice");
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
    setSalesLedgerId(salesLedgerOptions[0]?.value || "");
    setNarration("");
    setRoundOff(0);
    setLines([emptyLine()]);
    setIsOptional(false);
    setIsPostDated(false);
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
          <h1 className="text-xl font-bold text-green-700">Sales Invoice</h1>
          <Badge variant="primary" className="bg-blue-100 text-blue-700">
            {mode === "item-invoice" ? "Item Invoice" : "Accounting Invoice"}
          </Badge>
          <div className="flex gap-2">
            {isOptional && (
              <Badge variant="default" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Optional
              </Badge>
            )}
            
            {isPostDated && (
              <Badge variant="default" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                Post-Dated
              </Badge>
            )}
            
            
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">No: {voucherNumber}</div>
          <div className="w-36">
            <NepaliDatePicker
              value={date}
              onChange={setDate}
            />
          </div>
          <Input
            placeholder="Ref No."
            value={referenceNo}
            onChange={(val: any) => setReferenceNo(typeof val === 'string' ? val : val?.target?.value || val)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Party *</label>
            <Select
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="Select customer"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sales Ledger *</label>
            <Select
              value={salesLedgerId}
              onChange={setSalesLedgerId}
              options={salesLedgerOptions}
              placeholder="Select sales account"
            />
          </div>
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
                    <div className="w-24">
                      <AmountInput
                        value={line.quantity}
                        onChange={(val) => updateLine(index, "quantity", val)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{line.unit}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="w-28">
                      <AmountInput
                        value={line.rate}
                        onChange={(val) => updateLine(index, "rate", val)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="w-20">
                      <AmountInput
                        value={line.discount}
                        onChange={(val) => updateLine(index, "discount", val)}
                      />
                    </div>
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
            variant="primary"
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
              <div className="w-32">
                <AmountInput
                  value={roundOff}
                  onChange={setRoundOff}
                />
              </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-bold">Grand Total:</span>
            <span className="font-bold text-lg text-green-600">{formatNumber(grandTotal)}</span>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
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
          variant="primary"
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
                variant="primary"
                onClick={() => setShowConfirmCancel(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmCancel}>
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesVoucher;
