// src/lib/cbmsService.ts

import toast from "@/lib/appToast";
import { getDB, type DBInvoice } from "./db";

export type CBMSInvoiceType = "tax-invoice" | "simplified-invoice" | "credit-note" | "debit-note";

export interface CompanySettings {
  id?: string;
  name?: string;
  nameNepali?: string;
  companyNameEn?: string;
  companyNameNp?: string;
  panNumber?: string;
  vatNumber?: string;
  fiscalYearBS?: string;

  cbmsEnabled?: boolean;
  cbmsApiUrl?: string;
  cbmsApiKey?: string;
  simplifiedInvoiceThreshold?: number;
}

export interface CBMSSubmitResponse {
  success: boolean;
  irn?: string;
  qrCode?: string;
  message?: string;
  raw?: any;
}

export interface CBMSBulkResult {
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    invoiceId: string;
    invoiceNo: string;
    success: boolean;
    irn?: string;
    error?: string;
  }>;
}

export interface CBMSPayload {
  fiscalYear: string;
  invoiceType: CBMSInvoiceType;
  invoiceNo: string;
  invoiceDate: string;
  invoiceDateBS: string;

  sellerPan: string;
  sellerVatNo: string;

  buyerPan?: string;
  buyerName: string;

  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  totalAmount: number;

  lineItems: Array<{
    sn: number;
    description: string;
    hsCode: string;
    unit: string;
    quantity: number;
    rate: number;
    taxableAmount: number;
    exemptAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
}

export const DEFAULT_CBMS_SETTINGS = {
  cbmsEnabled: false,
  cbmsApiUrl: "https://cbms.ird.gov.np/api",
  simplifiedInvoiceThreshold: 10000,
};

const DEFAULT_CBMS_API_URL = "https://cbms.ird.gov.np/api";
const DEFAULT_SIMPLIFIED_THRESHOLD = 10000;
const BULK_DELAY_MS = 500;
const QUEUE_FLUSH_INTERVAL_MS = 2 * 60 * 1000;
const MAX_QUEUE_ATTEMPTS = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowISO() {
  return new Date().toISOString();
}

function normalizeAmount(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function getCompanyName(companySettings: CompanySettings): string {
  return companySettings.companyNameEn || companySettings.name || "Company";
}

function getSellerPan(companySettings: CompanySettings): string {
  return companySettings.panNumber || companySettings.vatNumber || "";
}

function getSellerVatNo(companySettings: CompanySettings): string {
  return companySettings.vatNumber || companySettings.panNumber || "";
}

function detectInvoiceType(invoice: DBInvoice, companySettings: CompanySettings): CBMSInvoiceType {
  if (invoice.type === "sales-return") return "credit-note";
  if (invoice.type === "purchase-return") return "debit-note";

  const total = normalizeAmount(invoice.grandTotal);
  const threshold = companySettings.simplifiedInvoiceThreshold ?? DEFAULT_SIMPLIFIED_THRESHOLD;

  const buyerIsUnregistered = !invoice.partyPan?.trim();

  if (invoice.type === "sales-invoice" && buyerIsUnregistered && total > 0 && total < threshold) {
    return "simplified-invoice";
  }

  return "tax-invoice";
}

export function generateCbmsQrString(args: {
  irn: string;
  invoiceNo: string;
  dateBS: string;
  sellerPan: string;
  buyerPan?: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}) {
  return [
    args.irn,
    args.invoiceNo,
    args.dateBS,
    args.sellerPan,
    args.buyerPan || "",
    args.taxableAmount.toFixed(2),
    args.vatAmount.toFixed(2),
    args.totalAmount.toFixed(2),
  ].join("|");
}

export function buildCbmsPayload(
  invoice: DBInvoice,
  companySettings: CompanySettings,
): CBMSPayload {
  const sellerPan = getSellerPan(companySettings);
  const sellerVatNo = getSellerVatNo(companySettings);

  if (!sellerPan) {
    throw new Error("Seller PAN is missing in company settings.");
  }

  if (!sellerVatNo) {
    throw new Error("Seller VAT number is missing in company settings.");
  }

  if (!invoice.invoiceNo) {
    throw new Error("Invoice number is missing.");
  }

  const invoiceDateBS = invoice.dateNepali || invoice.date;

  const lineItems =
    invoice.lines?.map((line, index) => {
      const qty = normalizeAmount(line.qty || 1);
      const rate = normalizeAmount(line.rate || 0);
      const taxableAmount = normalizeAmount(line.taxableAmount);
      const exemptAmount = normalizeAmount(line.exemptAmount);
      const vatAmount = normalizeAmount(line.vatAmount);
      const totalAmount =
        normalizeAmount(line.totalAmount) || taxableAmount + exemptAmount + vatAmount;

      return {
        sn: index + 1,
        description: line.itemName || line.description || `Item ${index + 1}`,
        hsCode: line.hsCode || line.hsnCode || "",
        unit: line.unit || "PCS",
        quantity: qty,
        rate,
        taxableAmount,
        exemptAmount,
        vatAmount,
        totalAmount,
      };
    }) || [];

  return {
    fiscalYear: companySettings.fiscalYearBS || "2081/82",
    invoiceType: detectInvoiceType(invoice, companySettings),

    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.date,
    invoiceDateBS,

    sellerPan,
    sellerVatNo,

    buyerPan: invoice.partyPan || undefined,
    buyerName: invoice.partyName || "Retail Customer",

    taxableAmount: normalizeAmount(invoice.taxableAmount),
    exemptAmount: normalizeAmount(invoice.exemptAmount),
    vatAmount: normalizeAmount(invoice.vatAmount),
    totalAmount: normalizeAmount(invoice.grandTotal),

    lineItems,
  };
}

async function getCompanySettingsFromDb(): Promise<CompanySettings> {
  const db = getDB();
  const settings = await db.companySettings.toArray();
  return settings[0] || {};
}

function isNetworkError(error: any): boolean {
  if (!navigator.onLine) return true;
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Network request failed")
  );
}

class CBMSService {
  private queueIntervalId: number | null = null;
  private isFlushing = false;

  private getApiUrl(companySettings: CompanySettings) {
    return (companySettings.cbmsApiUrl || DEFAULT_CBMS_API_URL).replace(/\/$/, "");
  }

  private getHeaders(companySettings: CompanySettings) {
    const apiKey = companySettings.cbmsApiKey;

    return {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    };
  }

  async submitInvoice(
    invoice: DBInvoice,
    companySettings: CompanySettings,
    options?: { queueOnFailure?: boolean },
  ): Promise<CBMSSubmitResponse> {
    const db = getDB();

    if (!companySettings.cbmsEnabled) {
      throw new Error("CBMS is not enabled in company settings.");
    }

    if (invoice.cbmsSubmitted && invoice.cbmsIrn) {
      return {
        success: true,
        irn: invoice.cbmsIrn,
        qrCode: invoice.cbmsQrString,
        message: "Invoice already submitted.",
      };
    }

    const payload = buildCbmsPayload(invoice, companySettings);
    const apiUrl = this.getApiUrl(companySettings);

    try {
      await db.invoices.update(invoice.id, {
        cbmsStatus: "pending",
        cbmsError: "",
      } as any);

      const response = await fetch(`${apiUrl}/invoice/submit`, {
        method: "POST",
        headers: this.getHeaders(companySettings),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || `CBMS submission failed with HTTP ${response.status}`,
        );
      }

      const irn = data.irn || data.IRN || data.invoiceReferenceNumber || data.data?.irn;

      if (!irn) {
        throw new Error("CBMS response did not contain IRN.");
      }

      const qrString = generateCbmsQrString({
        irn,
        invoiceNo: invoice.invoiceNo,
        dateBS: payload.invoiceDateBS,
        sellerPan: payload.sellerPan,
        buyerPan: payload.buyerPan,
        taxableAmount: payload.taxableAmount,
        vatAmount: payload.vatAmount,
        totalAmount: payload.totalAmount,
      });

      const submittedAt = nowISO();

      await db.invoices.update(invoice.id, {
        cbmsSubmitted: true,
        cbmsIrn: irn,
        cbmsQrString: qrString,
        cbmsQrCode: data.qrCode || data.qr || qrString,
        cbmsSubmittedAt: submittedAt,
        cbmsStatus: "submitted",
        cbmsError: "",
      } as any);

      return {
        success: true,
        irn,
        qrCode: qrString,
        raw: data,
      };
    } catch (error: any) {
      const message = error?.message || "CBMS submission failed.";

      await db.invoices.update(invoice.id, {
        cbmsSubmitted: false,
        cbmsStatus: "failed",
        cbmsError: message,
      } as any);

      if (options?.queueOnFailure !== false && isNetworkError(error)) {
        await this.enqueueSubmit(invoice.id, payload, message);
      }

      return {
        success: false,
        message,
      };
    }
  }

  async cancelInvoice(
    invoice: DBInvoice,
    reason: string,
    companySettings?: CompanySettings,
  ): Promise<{ success: boolean; message?: string }> {
    const db = getDB();
    const settings = companySettings || (await getCompanySettingsFromDb());

    if (!settings.cbmsEnabled) {
      throw new Error("CBMS is not enabled in company settings.");
    }

    if (!invoice.cbmsIrn) {
      throw new Error("Invoice has no CBMS IRN to cancel.");
    }

    const apiUrl = this.getApiUrl(settings);

    const payload = {
      irn: invoice.cbmsIrn,
      invoiceNo: invoice.invoiceNo,
      reason,
      sellerPan: getSellerPan(settings),
      cancelledAt: nowISO(),
    };

    try {
      const response = await fetch(`${apiUrl}/invoice/cancel`, {
        method: "POST",
        headers: this.getHeaders(settings),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || `CBMS cancellation failed with HTTP ${response.status}`,
        );
      }

      await db.invoices.update(invoice.id, {
        cbmsStatus: "cancelled",
        cbmsCancelledAt: nowISO(),
        cbmsCancelReason: reason,
      } as any);

      return { success: true, message: "Invoice cancelled in CBMS." };
    } catch (error: any) {
      const message = error?.message || "CBMS cancellation failed.";

      if (isNetworkError(error)) {
        await this.enqueueCancel(invoice.id, payload, reason, message);
      }

      await db.invoices.update(invoice.id, {
        cbmsError: message,
      } as any);

      return { success: false, message };
    }
  }

  async bulkSubmit(
    invoices: DBInvoice[],
    companySettings: CompanySettings,
    onProgress?: (done: number, total: number, invoice: DBInvoice) => void,
  ): Promise<CBMSBulkResult> {
    const results: CBMSBulkResult["results"] = [];

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];

      const result = await this.submitInvoice(invoice, companySettings, {
        queueOnFailure: true,
      });

      results.push({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        success: result.success,
        irn: result.irn,
        error: result.success ? undefined : result.message,
      });

      onProgress?.(i + 1, invoices.length, invoice);

      if (i < invoices.length - 1) {
        await sleep(BULK_DELAY_MS);
      }
    }

    return {
      total: invoices.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async enqueueSubmit(invoiceId: string, payload: any, lastError?: string) {
    const db = getDB();
    const existing = await db.cbmsQueue
      .where("invoiceId")
      .equals(invoiceId)
      .and((q) => q.action === "submit" && q.status !== "processing")
      .first();

    const base = {
      invoiceId,
      action: "submit" as const,
      payload,
      attempts: existing?.attempts || 0,
      lastError,
      status: "pending" as const,
      updatedAt: nowISO(),
    };

    if (existing?.id) {
      await db.cbmsQueue.update(existing.id, base);
    } else {
      await db.cbmsQueue.add({
        ...base,
        createdAt: nowISO(),
      });
    }
  }

  async enqueueCancel(invoiceId: string, payload: any, reason: string, lastError?: string) {
    const db = getDB();

    await db.cbmsQueue.add({
      invoiceId,
      action: "cancel",
      payload,
      reason,
      attempts: 0,
      lastError,
      status: "pending",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  }

  startQueueWorker() {
    if (this.queueIntervalId !== null) return;

    this.queueIntervalId = window.setInterval(() => {
      this.flushQueue().catch((err) => {
        console.error("[CBMS Queue] Flush failed", err);
      });
    }, QUEUE_FLUSH_INTERVAL_MS);

    window.addEventListener("online", () => {
      this.flushQueue().catch(console.error);
    });
  }

  stopQueueWorker() {
    if (this.queueIntervalId !== null) {
      window.clearInterval(this.queueIntervalId);
      this.queueIntervalId = null;
    }
  }

  async flushQueue() {
    if (this.isFlushing) return;
    if (!navigator.onLine) return;

    this.isFlushing = true;

    try {
      const db = getDB();
      const companySettings = await getCompanySettingsFromDb();

      if (!companySettings.cbmsEnabled) return;

      const queueItems = await db.cbmsQueue.where("status").equals("pending").sortBy("createdAt");

      for (const item of queueItems) {
        if (!item.id) continue;

        await db.cbmsQueue.update(item.id, {
          status: "processing",
          updatedAt: nowISO(),
        });

        try {
          const invoice = await db.invoices.get(item.invoiceId);

          if (!invoice) {
            await db.cbmsQueue.delete(item.id);
            continue;
          }

          if (item.action === "submit") {
            const result = await this.submitInvoice(invoice, companySettings, {
              queueOnFailure: false,
            });

            if (!result.success) {
              throw new Error(result.message || "Queued submission failed.");
            }
          }

          if (item.action === "cancel") {
            const result = await this.cancelInvoice(
              invoice,
              item.reason || "Queued cancellation",
              companySettings,
            );

            if (!result.success) {
              throw new Error(result.message || "Queued cancellation failed.");
            }
          }

          await db.cbmsQueue.delete(item.id);
          await sleep(BULK_DELAY_MS);
        } catch (error: any) {
          const attempts = item.attempts + 1;
          const failedPermanently = attempts >= MAX_QUEUE_ATTEMPTS;

          await db.cbmsQueue.update(item.id, {
            attempts,
            status: failedPermanently ? "failed" : "pending",
            lastError: error?.message || "Unknown CBMS queue error",
            updatedAt: nowISO(),
          });
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

export const cbmsService = new CBMSService();

export function startCbmsQueueWorker() {
  cbmsService.startQueueWorker();
}
