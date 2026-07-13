// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  Badge,
  ActionToolbar,
  AmountInput,
} from "../components/ui";
import {
  Plus,
  X,
  Save,
  Printer,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Trash2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { generateSerialNumber } from "../lib/accounting";
import { VoucherType, VoucherStatus } from "../lib/types";
import {
  calculateVoucherTotals,
  validateVoucherDate,
  formatVoucherDisplayDate,
} from "../lib/voucherUtils";
import toast from "react-hot-toast";

const CreditNoteVoucher: React.FC = () => {
  const {
    accounts,
    items,
    parties,
    vouchers,
    invoices,
    companySettings,
    currentFiscalYear,
  } = useStore();

  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [voucherNumber, setVoucherNumber] = useState<string>("Loading...");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [partyId, setPartyId] = useState<string>("");
  const [partyName, setPartyName] = useState<string>("");
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string>("");
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState<string>("");
  const [creditReason, setCreditReason] = useState<string>("");
  const [isInventoryReturn, setIsInventoryReturn] = useState<boolean>(false);
  const [lines, setLines] = useState<Array<any>>([]);
  const [narration, setNarration] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const generateNumber = async () => {
      try {
        const number = await generateSerialNumber(
          VoucherType.CREDIT_NOTE,
          undefined,
          currentFiscalYear?.fiscalYearBS,
        );
        setVoucherNumber(number);
      } catch (error) {
        setVoucherNumber("CN-" + Date.now());
      }
    };
    generateNumber();
  }, []);

  const partyOptions = useMemo(() => {
    return parties
      .filter((party) => party.type === "customer" || party.type === "both")
      .map((party) => ({ value: party.id, label: party.name }));
  }, [parties]);

  const originalInvoiceOptions = useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          (inv.type === VoucherType.SALES_INVOICE || String(inv.type) === "sales-invoice") &&
          String(inv.status || "").toLowerCase() === "posted" &&
          (inv.partyId === partyId || !partyId),
      )
      .map((inv) => ({
        value: inv.id,
        label: `${inv.invoiceNo || inv.voucherNo} — Rs.${formatNumber(inv.grandTotal || 0)}`,
      }));
  }, [invoices, partyId]);

  const itemOptions = useMemo(() => {
    return items
      .filter((item) => item.isActive)
      .map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }));
  }, [items]);

  const totals = useMemo(() => {
    const mappedLines = lines.map((line) => ({
      debit: 0,
      credit: line.totalAmount || 0,
      amount: line.totalAmount || 0,
      taxAmount: line.taxAmount || 0,
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
    return subTotal - totalDiscount + totalTax;
  }, [subTotal, totalDiscount, totalTax]);

  // When original invoice changes, populate lines
  useEffect(() => {
    if (originalInvoiceId) {
      const originalInvoice = invoices.find((inv) => inv.id === originalInvoiceId);
      if (originalInvoice) {
        setOriginalInvoiceNo(originalInvoice.voucherNo || originalInvoice.invoiceNo || "");
        setPartyId(originalInvoice.partyId);
        setPartyName(originalInvoice.partyName || "");

        // Populate lines from original invoice
        const newLines =
          originalInvoice.lines?.map((line: any, idx: number) => {
            const qty = Number(line.qty ?? line.quantity ?? 0);
            const rate = Number(line.rate || 0);
            const discountAmount = Number(line.discountAmount || 0);
            const amount = Number(line.netAmount ?? line.amount ?? rate * qty - discountAmount);
            const taxAmount = Number(line.vatAmount ?? line.taxAmount ?? 0);
            const totalAmount = Number(
              line.lineTotal ?? line.totalAmount ?? amount + taxAmount,
            );
            return {
              key: Math.random().toString(36).substring(7),
              itemId: line.itemId,
              itemName: line.itemName,
              quantity: qty,
              unit: line.unit,
              rate,
              discount: line.discountPercent ?? line.discount ?? 0,
              discountAmount,
              taxRate: line.vatRate ?? line.taxRate ?? 0,
              taxAmount,
              amount,
              totalAmount,
              godownId: line.warehouseId || line.godownId || "",
              narration: line.narration || "",
              originalQuantity: qty,
              originalSalesLineId: line.id || `line-${originalInvoice.id}-${idx}`,
            };
          }) || [];

        setLines(newLines);
      }
    } else {
      setLines([]);
    }
  }, [originalInvoiceId, invoices]);

  function emptyLine() {
    return {
      key: Math.random().toString(36).substring(7),
      itemId: "",
      itemName: "",
      quantity: 0,
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
      originalQuantity: 0,
      originalSalesLineId: "",
    };
  }

  const updateLine = useCallback(
    (index: number, field: string, value: any) => {
      setLines((prev) => {
        const newLines = [...prev];
        const line = { ...newLines[index] };

        if (field === "itemId") {
          const item = items.find((i) => i.id === value);
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
        if (
          field === "quantity" ||
          field === "rate" ||
          field === "discount" ||
          field === "taxRate"
        ) {
          line.discountAmount = (line.rate * line.quantity * line.discount) / 100;
          line.amount = line.rate * line.quantity - line.discountAmount;
          line.taxAmount = (line.amount * line.taxRate) / 100;
          line.totalAmount = line.amount + line.taxAmount;
        }

        newLines[index] = line;
        setDirty(true);
        return newLines;
      });
    },
    [items],
  );

  const addLine = useCallback(() => {
    if (lines.length >= 50) {
      toast.error("Maximum 50 lines allowed");
      return;
    }
    setLines((prev) => [...prev, emptyLine()]);
    setDirty(true);
  }, [lines.length]);

  const removeLine = useCallback(
    (index: number) => {
      if (lines.length <= 0) {
        toast.error("At least one line is required");
        return;
      }
      setLines((prev) => prev.filter((_, i) => i !== index));
      setDirty(true);
    },
    [lines.length],
  );

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

    if (!originalInvoiceId?.trim()) {
      toast.error("Select the original sales invoice");
      return;
    }

    if (!creditReason) {
      toast.error("Please select a reason for credit");
      return;
    }

    const hasValidLine = lines.some(
      (line) => line.itemId && (isInventoryReturn ? line.quantity > 0 : line.totalAmount > 0),
    );
    if (!hasValidLine) {
      toast.error("Please add at least one item");
      return;
    }

    if (grandTotal <= 0) {
      toast.error("Credit note amount cannot be zero");
      return;
    }

    setSaving(true);

    try {
      const original = invoices.find((inv) => inv.id === originalInvoiceId);
      if (!original || String(original.type) !== "sales-invoice") {
        toast.error("Original sales invoice not found");
        setSaving(false);
        return;
      }

      const { postSalesAdjustmentTransaction } = await import(
        "@/domains/sales/postSalesAdjustmentTransaction"
      );
      const { generateId } = await import("@/lib/db");

      const goodwillOrPricing =
        !isInventoryReturn &&
        /post-sale-discount|rate-difference|pricing|goodwill|service-cancellation/i.test(
          creditReason,
        );
      const settlementMethod = goodwillOrPricing
        ? ("customer_credit" as const)
        : ("reduce_receivable" as const);

      const adjLines = lines
        .filter((line) => line.itemId)
        .map((line) => {
          let originalSalesLineId = line.originalSalesLineId as string | undefined;
          if (!originalSalesLineId) {
            const origIdx = (original.lines || []).findIndex(
              (ol: any) => String(ol.itemId) === String(line.itemId),
            );
            if (origIdx < 0) return null;
            const origLine = original.lines![origIdx];
            originalSalesLineId =
              (origLine as { id?: string }).id || `line-${original.id}-${origIdx}`;
          }
          if (isInventoryReturn) {
            if (!(Number(line.quantity) > 0)) return null;
            return {
              originalSalesLineId,
              itemId: String(line.itemId),
              returnQuantity: Number(line.quantity),
              stockCondition: "resalable" as const,
            };
          }
          const financialAdjustment = Number(line.totalAmount || line.amount || 0);
          if (!(financialAdjustment > 0)) return null;
          return {
            originalSalesLineId,
            itemId: String(line.itemId),
            financialAdjustment,
          };
        })
        .filter(Boolean);

      if (!adjLines.length) {
        toast.error("Could not map credit lines to the original invoice");
        setSaving(false);
        return;
      }

      const requestId = generateId();
      const result = await postSalesAdjustmentTransaction({
        commandId: requestId,
        requestId,
        idempotencyKey: `manual-credit-note-${requestId}`,
        companyId: String(
          (companySettings as { companyId?: string } | null)?.companyId ||
            companySettings?.id ||
            "main",
        ),
        financialYearId: currentFiscalYear?.id ?? null,
        userId: useStore.getState().currentUser?.id || "manual-user",
        userRole: useStore.getState().currentUser?.role || "accountant",
        source: "manual_form",
        adjustment: {
          adjustmentType: isInventoryReturn
            ? "inventory_sales_return"
            : "financial_credit_note",
          originalInvoiceId,
          transactionDate: date,
          customerId: partyId || original.partyId || null,
          settlementMethod,
          reasonCode: creditReason || "credit_note",
          narration:
            narration ||
            `${creditReason}: credit note vs ${original.invoiceNo || originalInvoiceNo}`,
          lines: adjLines as any,
          currency: "NPR",
        },
      });

      if (result.type !== "posting_completed") {
        throw new Error(result.payload.safe_message || "Credit note posting failed");
      }

      toast.success(
        `Credit note posted — ${result.payload.invoice_number}`,
      );

      resetForm();

      const newNumber = await generateSerialNumber(
        VoucherType.CREDIT_NOTE,
        undefined,
        currentFiscalYear?.fiscalYearBS,
      );
      setVoucherNumber(newNumber);
    } catch (error) {
      toast.error(error.message || "Failed to save credit note");
    } finally {
      setSaving(false);
      setDirty(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setReferenceNo("");
    setPartyId("");
    setPartyName("");
    setOriginalInvoiceId("");
    setOriginalInvoiceNo("");
    setCreditReason("");
    setIsInventoryReturn(false);
    setLines([]);
    setNarration("");
    setDirty(false);
  };

  const handleCancel = () => {
    if (dirty) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        resetForm();
      }
    } else {
      resetForm();
    }
  };

  return (
    <div className="p-4 pr-32">
      {/* Top Bar */}
      <ActionToolbar className="mb-4 sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-red-700">Credit Note</h1>
          <Badge variant="outline" className="bg-blue-100 text-blue-700">
            {isInventoryReturn ? "With Return" : "Without Return"}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">No: {voucherNumber}</div>
          <NepaliDatePicker value={date} onChange={setDate} className="w-36" />
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
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
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

      {/* Party + Reference Section */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <Select
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="Select customer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Original Invoice *
            </label>
            <Select
              value={originalInvoiceId}
              onChange={setOriginalInvoiceId}
              options={originalInvoiceOptions}
              placeholder="Select original invoice"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Original Invoice No.
            </label>
            <Input
              value={originalInvoiceNo}
              onChange={(e) => setOriginalInvoiceNo(e.target.value)}
              placeholder="Enter invoice no."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Reason *</label>
            <Select
              value={creditReason}
              onChange={setCreditReason}
              options={[
                { value: "sales-return", label: "Sales Return" },
                { value: "post-sale-discount", label: "Post-Sale Discount" },
                { value: "rate-difference", label: "Rate Difference" },
                { value: "damaged-goods", label: "Damaged Goods" },
                { value: "service-cancellation", label: "Service Cancellation" },
                { value: "other", label: "Other" },
              ]}
              placeholder="Select reason"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isInventoryReturn}
                onChange={(e) => setIsInventoryReturn(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Goods physically returned to stock
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Items Table Section */}
      {(isInventoryReturn || lines.length > 0) && (
        <Card className="mb-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return Qty
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disc%
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax%
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Del
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line, index) => {
                  const isOverReturn = line.quantity > (line.originalQuantity || 0);
                  return (
                    <tr
                      key={line.key}
                      className={`hover:bg-gray-50 ${isOverReturn ? "bg-red-50" : ""}`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {index + 1}
                      </td>
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
                        <div className="flex flex-col">
                          <AmountInput
                            value={line.quantity}
                            onChange={(value) => updateLine(index, "quantity", value)}
                            className="w-20"
                          />
                          {isOverReturn && (
                            <span className="text-xs text-red-600">
                              Exceeds original: {line.originalQuantity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {line.unit}
                      </td>
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
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                        {formatNumber(line.totalAmount || 0)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
      )}

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
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-bold">Grand Total:</span>
            <span className="font-bold text-lg text-red-600">{formatNumber(grandTotal)}</span>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
            placeholder="Enter narration..."
          />
        </div>
      </Card>

      {/* Bottom Buttons */}
      <div className="flex justify-end space-x-2">
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
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
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
    </div>
  );
};

export default CreditNoteVoucher;
