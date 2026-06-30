// ─── CBMS (Customs Billing Management System) Service ──────────────────────────
// Fixes BUG-010, BUG-100: Uses unified CbmsStatus from types.ts

import type { CbmsStatus, DBInvoice } from "./db";
import { getDB } from "./db";
import toast from "react-hot-toast";

export interface CBMSSubmitRequest {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  partyName?: string;
  partyPan?: string;
  partyAddress?: string;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  discountAmount?: number;
  lines: Array<{
    itemName: string;
    qty: number;
    rate: number;
    lineTotal: number;
    vatRate?: number;
    vatAmount?: number;
    hsnCode?: string;
  }>;
}

export interface CBMSResponse {
  success: boolean;
  irn?: string;
  qrString?: string;
  qrCode?: string;
  status: CbmsStatus;
  error?: string;
  submittedAt?: string;
}

export interface CBMSConfig {
  username: string;
  password: string;
  baseUrl?: string;
  environment?: "production" | "sandbox";
}

/**
 * Submit invoice to CBMS (IRD Nepal electronic billing system).
 * Fixes BUG-010: uses CbmsStatus = "submitted" (not "success") aligned with db.ts.
 * Fixes BUG-059: proper error handling with .catch().
 */
export async function submitToCBMS(
  invoice: DBInvoice,
  config: CBMSConfig,
): Promise<CBMSResponse> {
  const db = getDB();

  // Mark as pending
  await db.invoices.update(invoice.id, {
    cbmsStatus: "pending" as CbmsStatus,
    cbmsError: undefined,
  });

  try {
    const payload: CBMSSubmitRequest = {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      partyName: invoice.partyName,
      partyPan: invoice.partyPan,
      partyAddress: invoice.partyAddress,
      taxableAmount: invoice.taxableAmount,
      vatAmount: invoice.vatAmount,
      grandTotal: invoice.grandTotal,
      discountAmount: invoice.discountAmount,
      lines: (invoice.lines || []).map((l) => ({
        itemName: l.itemName || l.description || "Item",
        qty: l.qty,
        rate: l.rate,
        lineTotal: l.lineTotal,
        vatRate: l.vatRate,
        vatAmount: l.vatAmount,
        hsnCode: l.hsnCode,
      })),
    };

    // In production this would be a real HTTP call to the CBMS API
    // For now we simulate with a timeout
    const response = await simulateCBMSCall(payload, config);

    if (response.success) {
      // Fix BUG-100: use "submitted" not "success" for CBMS status
      await db.invoices.update(invoice.id, {
        cbmsSubmitted: true,
        cbmsIrn: response.irn,
        cbmsQrString: response.qrString,
        cbmsQrCode: response.qrCode,
        cbmsStatus: "submitted" as CbmsStatus,
        cbmsSubmittedAt: new Date().toISOString(),
        cbmsError: undefined,
      });
    } else {
      await db.invoices.update(invoice.id, {
        cbmsStatus: "failed" as CbmsStatus,
        cbmsError: response.error,
      });
    }

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown CBMS error";

    // Fix BUG-059: catch block properly updates DB and returns error response
    await db.invoices.update(invoice.id, {
      cbmsStatus: "failed" as CbmsStatus,
      cbmsError: errorMsg,
    }).catch(console.error);

    return {
      success: false,
      status: "failed",
      error: errorMsg,
    };
  }
}

/**
 * Cancel a previously submitted CBMS invoice (credit note / cancellation).
 */
export async function cancelCBMSInvoice(
  invoiceId: string,
  irn: string,
  reason: string,
  config: CBMSConfig,
): Promise<CBMSResponse> {
  const db = getDB();

  try {
    // Simulate cancellation
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    await db.invoices.update(invoiceId, {
      cbmsStatus: "cancelled" as CbmsStatus,
    });

    return { success: true, status: "cancelled" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Cancellation failed";
    return { success: false, status: "failed", error: errorMsg };
  }
}

/**
 * Get CBMS submission status for an invoice.
 */
export async function getCBMSStatus(irn: string, config: CBMSConfig): Promise<{
  status: CbmsStatus;
  message?: string;
}> {
  try {
    // Simulate status check
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    return { status: "submitted" };
  } catch {
    return { status: "failed", message: "Status check failed" };
  }
}

// ─── Simulation (Replace with real HTTP calls in production) ───────────────────

async function simulateCBMSCall(
  payload: CBMSSubmitRequest,
  config: CBMSConfig,
): Promise<CBMSResponse> {
  // Simulate network delay
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));

  // Check config
  if (!config.username || !config.password) {
    return {
      success: false,
      status: "failed",
      error: "CBMS credentials not configured. Please update Company Settings.",
    };
  }

  // Simulate success (95% of the time)
  if (Math.random() > 0.05) {
    const irn = `IRN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const qrString = JSON.stringify({
      irn,
      invoiceNo: payload.invoiceNo,
      date: payload.date,
      pan: payload.partyPan || "",
      grandTotal: payload.grandTotal,
      vatAmount: payload.vatAmount,
    });
    return {
      success: true,
      status: "submitted",
      irn,
      qrString,
      qrCode: `data:text/plain;base64,${btoa(qrString)}`,
      submittedAt: new Date().toISOString(),
    };
  }

  return {
    success: false,
    status: "failed",
    error: "CBMS server returned an error. Please try again.",
  };
}

/**
 * Bulk submit pending invoices to CBMS.
 * Used by background job / manual trigger.
 */
export async function bulkSubmitPendingCBMS(config: CBMSConfig): Promise<{
  submitted: number;
  failed: number;
  errors: string[];
}> {
  const db = getDB();
  const pending = await db.invoices
    .filter((inv) => inv.cbmsStatus === "pending" && !inv.cbmsSubmitted)
    .toArray();

  let submitted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const inv of pending) {
    const result = await submitToCBMS(inv, config);
    if (result.success) {
      submitted++;
    } else {
      failed++;
      errors.push(`${inv.invoiceNo}: ${result.error}`);
    }
    // Rate-limit: wait 200ms between submissions
    await new Promise<void>((r) => setTimeout(r, 200));
  }

  return { submitted, failed, errors };
}
export function startCbmsQueueWorker() {
  // Empty stub to prevent breaking imports; in production this would run a background interval
}

export const cbmsService = { startCbmsQueueWorker: () => {} };
