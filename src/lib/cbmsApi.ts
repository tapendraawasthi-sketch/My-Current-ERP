/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDB, generateId } from "./db";
import { Invoice, CompanySettings, CbmsLog } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(config: NonNullable<CompanySettings["cbmsConfig"]>): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) return cachedToken.token;
  
  const base = config.environment === 'production'
    ? 'https://cbms.ird.gov.np'
    : 'https://sandbox.cbms.ird.gov.np';
    
  try {
    const res = await fetch(`${base}/api/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      })
    });
    
    if (!res.ok) {
      throw new Error(`Auth failed with status ${res.status}`);
    }
    
    const data = await res.json();
    cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cachedToken.token;
  } catch (error: any) {
    throw new Error(`Failed to authenticate with CBMS: ${error.message}`);
  }
}

export async function submitBill(invoice: Invoice, company: CompanySettings): Promise<{ success: boolean; cbmsRefNo?: string; qrCode?: string; errorCode?: string; errorMessage?: string }> {
  const db = getDB();
  const config = company.cbmsConfig;
  
  if (!config) {
    return { success: false, errorMessage: "CBMS is not configured" };
  }

  // Create initial log
  const logId = generateId('cbms');
  const log: CbmsLog = {
    id: logId,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    partyName: invoice.partyName,
    partyPan: invoice.partyPan,
    amount: invoice.grandTotal,
    vatAmount: invoice.vatAmount,
    submittedAt: new Date().toISOString(),
    cbmsStatus: 'pending',
    retryCount: 0,
    isBillCancelled: false,
  };
  await db.cbmsLogs.put(log);

  try {
    const token = await getAccessToken(config);
    const base = config.environment === 'production'
      ? 'https://cbms.ird.gov.np'
      : 'https://sandbox.cbms.ird.gov.np';
      
    // Build payload mapping according to IRD spec
    const payload = {
      seller_pan: company.panNumber,
      buyer_pan: invoice.partyPan || "",
      buyer_name: invoice.partyName,
      fiscal_year: company.companyNameEn || "", // Needs proper mapping
      buyer_person_no: "",
      invoice_number: invoice.invoiceNo,
      invoice_date: invoice.dateNepali.replace(/-/g, '.'),
      total_sales: invoice.grandTotal,
      taxable_sales_vat: invoice.taxableAmount,
      vat: invoice.vatAmount,
      excisable_amount: 0,
      excise: 0,
      taxable_sales_hst: 0,
      hst: 0,
      amount_for_cbpm: 0,
      amount_for_cbpm_exempted: 0,
      amount_for_cbpm_export: 0,
      amount_for_cbpm_unregistered: 0,
      isrealtime: true,
      datetimeClient: new Date().toISOString()
    };

    const res = await fetch(`${base}/api/v1/bill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    if (res.ok && data.status === "SUCCESS") {
      // Update Log
      await db.cbmsLogs.update(logId, {
        cbmsStatus: 'submitted',
        cbmsRefNo: data.cbms_ref_no || data.sync_id,
        responseCode: "200",
        responseMessage: "Success",
      });
      
      // Update Invoice
      await db.invoices.update(invoice.id, {
        cbmsStatus: 'submitted',
        cbmsRefNo: data.cbms_ref_no || data.sync_id,
      });
      
      return { success: true, cbmsRefNo: data.cbms_ref_no || data.sync_id };
    } else {
      await db.cbmsLogs.update(logId, {
        cbmsStatus: 'failed',
        responseCode: String(res.status),
        responseMessage: data.message || "Submission failed",
      });
      
      await db.invoices.update(invoice.id, { cbmsStatus: 'failed' });
      return { success: false, errorCode: String(res.status), errorMessage: data.message || "Submission failed" };
    }
  } catch (error: any) {
    await db.cbmsLogs.update(logId, {
      cbmsStatus: 'failed',
      responseCode: "500",
      responseMessage: error.message,
    });
    
    await db.invoices.update(invoice.id, { cbmsStatus: 'failed' });
    return { success: false, errorMessage: error.message };
  }
}

export async function cancelBill(invoice: Invoice, reason: string, company: CompanySettings): Promise<{ success: boolean }> {
  const db = getDB();
  const config = company.cbmsConfig;
  
  if (!config) return { success: false };

  try {
    const token = await getAccessToken(config);
    const base = config.environment === 'production'
      ? 'https://cbms.ird.gov.np'
      : 'https://sandbox.cbms.ird.gov.np';
      
    // Usually cbms cancellation is POST to /billreturn
    const payload = {
      seller_pan: company.panNumber,
      invoice_number: invoice.invoiceNo,
      reason: reason,
    };

    const res = await fetch(`${base}/api/v1/billreturn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const logs = await db.cbmsLogs.where('invoiceId').equals(invoice.id).toArray();
      if (logs.length > 0) {
        await db.cbmsLogs.update(logs[0].id, {
          isBillCancelled: true,
          cancelReason: reason,
          cbmsStatus: 'cancelled'
        });
      }
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    console.error("Cancel bill failed", error);
    return { success: false };
  }
}

export async function batchSubmitPending(db: any, company: CompanySettings): Promise<{ submitted: number; failed: number; total: number }> {
  if (!company.cbmsConfig) return { submitted: 0, failed: 0, total: 0 };
  
  const pendingInvoices = await db.invoices.filter((i: any) => i.cbmsStatus === 'pending' || i.cbmsStatus === 'failed').toArray();
  let submitted = 0;
  let failed = 0;
  
  for (const invoice of pendingInvoices) {
    const result = await submitBill(invoice, company);
    if (result.success) {
      submitted++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { submitted, failed, total: pendingInvoices.length };
}
