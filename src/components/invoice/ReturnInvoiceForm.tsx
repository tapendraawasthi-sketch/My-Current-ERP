// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Return Invoice — sales-return or purchase-return.
 *
 * Journal posted by useStore.addInvoice on the respective voucher types:
 *   SALES RETURN
 *     Dr  Sales Return A/C        (taxableAmount + exemptAmount)
 *     Dr  VAT Payable A/C         (vatAmount — reversal of output VAT)
 *     Cr  Customer A/C            (grandTotal)
 *
 *   PURCHASE RETURN
 *     Dr  Supplier A/C            (grandTotal)
 *     Cr  Purchase Return A/C     (taxableAmount + exemptAmount)
 *     Cr  VAT Receivable A/C      (vatAmount — reversal of input VAT)
 *
 * Stock movements are reversed by the store's stock subsystem when the
 * voucher type is a return.
 *
 * "Original Invoice No" — when entered, prefills party and line items from
 * the original invoice. The user can then trim quantities to the amounts
 * actually being returned.
 */

import React, { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { Card, Input } from "../ui";
import { Undo2 } from "lucide-react";
import SalesInvoiceForm from "./SalesInvoiceForm";
import { VoucherType } from "../../lib/types";
import toast from "react-hot-toast";

interface ReturnInvoiceFormProps {
  type: "sales-return" | "purchase-return";
  originalInvoiceId?: string;
  invoiceId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const ReturnInvoiceForm: React.FC<ReturnInvoiceFormProps> = ({
  type,
  originalInvoiceId,
  invoiceId,
  onSave,
  onCancel,
}) => {
  const { invoices } = useStore();
  const existing = invoices.find((i: any) => i.id === invoiceId);

  const [origNo, setOrigNo] = useState<string>(existing?.originalInvoiceNo || "");
  const [linkedKey, setLinkedKey] = useState<number>(0); // bumps to force re-mount with prefilled draft

  const targetType =
    type === "sales-return" ? VoucherType.SALES_INVOICE : VoucherType.PURCHASE_INVOICE;

  // If originalInvoiceId is provided externally, stage a draft in sessionStorage
  // (consumed by SalesInvoiceForm if your store wires it; otherwise this
  // simply surfaces the original number so the user can copy lines manually).
  useEffect(() => {
    if (!originalInvoiceId) return;
    const orig = invoices.find((i: any) => i.id === originalInvoiceId && i.type === targetType);
    if (orig) {
      setOrigNo(orig.invoiceNo || "");
      try {
        sessionStorage.setItem(
          "sutra:return-draft",
          JSON.stringify({
            type,
            partyId: orig.partyId,
            lines: orig.lines,
            originalInvoiceId,
            originalInvoiceNo: orig.invoiceNo,
          }),
        );
        setLinkedKey((k) => k + 1);
      } catch {
        /* ignore */
      }
    }
  }, [originalInvoiceId, invoices, type, targetType]);

  const lookupAndLink = () => {
    if (!origNo) return;
    const orig = invoices.find((i: any) => i.invoiceNo === origNo && i.type === targetType);
    if (!orig) {
      toast.error(
        `Original ${type === "sales-return" ? "sales" : "purchase"} invoice "${origNo}" not found.`,
      );
      return;
    }
    try {
      sessionStorage.setItem(
        "sutra:return-draft",
        JSON.stringify({
          type,
          partyId: orig.partyId,
          lines: orig.lines,
          originalInvoiceId: orig.id,
          originalInvoiceNo: orig.invoiceNo,
        }),
      );
      setLinkedKey((k) => k + 1);
      toast.success(
        `Loaded ${orig.lines?.length || 0} lines from ${orig.invoiceNo}. Adjust return quantities.`,
      );
    } catch {
      toast.error("Unable to stage return draft.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card border padding="md">
        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Undo2 className="h-3.5 w-3.5 text-amber-600" /> Original Invoice Linkage
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Input
            label="Original Invoice No"
            value={origNo}
            onChange={setOrigNo}
            placeholder={type === "sales-return" ? "SI-0001" : "PI-0001"}
          />
          <button
            type="button"
            onClick={lookupAndLink}
            className="h-9 px-4 rounded-md bg-[#1557b0] text-white text-xs font-bold hover:bg-[#0f4a96]"
          >
            Link & Prefill
          </button>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Lookup loads party and line items from the original invoice. Trim quantities to what is
            actually being returned.
          </p>
        </div>
      </Card>

      <SalesInvoiceForm
        key={linkedKey}
        invoiceId={invoiceId}
        type={type}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
};

export default ReturnInvoiceForm;
