/** SUTRA AI — invoice draft session bridge to SalesInvoiceForm */

import type { AiInvoiceDraft } from "../types";

export const AI_INVOICE_DRAFT_KEY = "sutra:ai-invoice-draft";

export function saveAiInvoiceDraft(draft: AiInvoiceDraft): void {
  sessionStorage.setItem(AI_INVOICE_DRAFT_KEY, JSON.stringify(draft));
}

export function peekAiInvoiceDraft(): AiInvoiceDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_INVOICE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiInvoiceDraft;
  } catch {
    return null;
  }
}

export function consumeAiInvoiceDraft(): AiInvoiceDraft | null {
  const draft = peekAiInvoiceDraft();
  if (draft) sessionStorage.removeItem(AI_INVOICE_DRAFT_KEY);
  return draft;
}
