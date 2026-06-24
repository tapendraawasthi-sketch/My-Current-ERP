/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Purchase Invoice — mirror of SalesInvoiceForm tuned for supplier billing.
 *
 * Differences vs. Sales:
 *   - Default party filter is supplier (handled inside SalesInvoiceForm via the
 *     `type='purchase'` branch — PartyType.SUPPLIER).
 *   - Item rate auto-fills from item.purchaseRate (handled by InvoiceLineItem
 *     when type='purchase').
 *   - Journal on post (built by useStore.addInvoice for purchase-invoice):
 *        Dr  Taxable Purchases A/C   (taxableAmount)
 *        Dr  Exempt  Purchases A/C   (exemptAmount)
 *        Dr  VAT Receivable A/C      (vatAmount — creditable input VAT)
 *        Cr  Supplier A/C            (grandTotal)        [if mode = credit]
 *        Cr  Cash / Bank A/C         (grandTotal)        [if mode = cash/bank]
 *        Cr  TDS Payable A/C         (tdsAmount, if any)
 *   - Extra header fields: GRN Reference + Supplier Invoice No + Supplier
 *     Invoice Date. These are folded into challanRef / referenceNo /
 *     orderRef so they print on the invoice and persist on the voucher.
 *
 * The form below is a thin wrapper that captures the supplier-specific
 * fields, then delegates the heavy lifting (lines, VAT, posting) to
 * SalesInvoiceForm which already knows how to render the purchase variant.
 */

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { Card, Input, NepaliDatePicker } from "../ui";
import { Truck } from "lucide-react";
import SalesInvoiceForm from "./SalesInvoiceForm";

interface PurchaseInvoiceFormProps {
  invoiceId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const PurchaseInvoiceForm: React.FC<PurchaseInvoiceFormProps> = ({
  invoiceId,
  onSave,
  onCancel,
}) => {
  const { invoices } = useStore();
  const existing = invoices.find((i: any) => i.id === invoiceId);

  const [grnRef, setGrnRef] = useState<string>(existing?.challanRef || "");
  const [supInvNo, setSupInvNo] = useState<string>(existing?.referenceNo || "");
  const [supInvDate, setSupInvDate] = useState<string>(existing?.orderRef || "");
  const [dupWarn, setDupWarn] = useState<string>("");

  // Duplicate supplier invoice no warning
  useEffect(() => {
    if (!supInvNo) {
      setDupWarn("");
      return;
    }
    const dup = invoices.find(
      (i: any) =>
        i.id !== invoiceId &&
        i.type === "purchase-invoice" &&
        i.partyId === existing?.partyId &&
        (i.referenceNo || "").toLowerCase() === supInvNo.toLowerCase(),
    );
    setDupWarn(
      dup
        ? `Duplicate supplier invoice ${supInvNo} found for this supplier (${dup.invoiceNo}).`
        : "",
    );
  }, [supInvNo, invoices, invoiceId, existing?.partyId]);

  return (
    <div className="flex flex-col gap-3">
      <Card border padding="md">
        <h3 className="text-[11px] font-bold text-[#000000] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-[#1557b0]" /> Supplier Invoice Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="GRN Reference"
            value={grnRef}
            onChange={setGrnRef}
            placeholder="GRN-0001 (optional)"
          />
          <Input
            label="Supplier Invoice No"
            value={supInvNo}
            onChange={setSupInvNo}
            placeholder="Their invoice no."
            error={dupWarn}
          />
          <NepaliDatePicker
            label="Supplier Invoice Date"
            value={supInvDate}
            onChange={setSupInvDate}
          />
        </div>
        {dupWarn && <p className="mt-2 text-[11px] font-semibold text-amber-600">⚠ {dupWarn}</p>}
      </Card>

      <SalesInvoiceForm invoiceId={invoiceId} type="purchase" onSave={onSave} onCancel={onCancel} />
    </div>
  );
};

export default PurchaseInvoiceForm;
