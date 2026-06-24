// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanySettings, Invoice, VoucherType } from "./types";

export async function submitToCBMS(
  invoice: Invoice,
  company: CompanySettings,
): Promise<{ success: boolean; irn: string | null; error: string | null }> {
  try {
    const baseUrl = "https://cbms.ird.gov.np/api/billing/";
    
    // Authorization: Basic base64(username:password)
    const username = company.cbmsUsername || "";
    const password = company.cbmsPassword || "";
    const authHeader = "Basic " + btoa(`${username}:${password}`);

    const payload = {
      BuyerPanNo: invoice.partyPan || "",
      BuyerName: invoice.partyName || "Cash",
      Amount: invoice.grandTotal || 0,
      TaxableAmount: invoice.taxableAmount || 0,
      TaxAmount: invoice.vatAmount || 0,
      Discount: invoice.totalDiscount || 0,
      InvoiceDate: invoice.date.replace(/-/g, "/"),
      InvoiceNo: invoice.invoiceNo,
      IsRealTime: true,
      Miti: invoice.dateNepali,
      TransactionType: invoice.type === VoucherType.SALES_INVOICE ? "D" : "C",
    };

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200) {
      const data = await res.json();
      const irn = data.Irn || data.irn || data.InvoiceReferenceNo || null;
      return { success: true, irn, error: null };
    } else {
      const text = await res.text();
      return { success: false, irn: null, error: `IRD Error (${res.status}): ${text}` };
    }
  } catch (error: any) {
    return { success: false, irn: null, error: error?.message || "Network error while syncing with CBMS" };
  }
}

