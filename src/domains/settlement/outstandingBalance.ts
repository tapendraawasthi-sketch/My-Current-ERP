/**
 * Document outstanding balance engine (Phase 9).
 * Derives remaining from invoice grandTotal, posted allocations, and linked adjustments.
 * rebuildInvoicePaidProjection mutates paidAmount/paymentStatus only — never grandTotal.
 */

import type { SutraERPDatabase, DBInvoice } from "@/lib/db";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";
import { getOrCreateDocumentSettlementState } from "./settlementState";

export interface DocumentOutstanding {
  document_id: string;
  document_type: string;
  party_id: string | null;
  currency: string;
  original: string;
  original_paisa: number;
  allocated_principal: string;
  allocated_principal_paisa: number;
  allocated_discount: string;
  allocated_discount_paisa: number;
  allocated_withholding: string;
  allocated_withholding_paisa: number;
  allocated_writeoff: string;
  allocated_writeoff_paisa: number;
  adjustment_reduction: string;
  adjustment_reduction_paisa: number;
  remaining_outstanding: string;
  remaining_outstanding_paisa: number;
  settlement_version: number;
}

function moneyOrZero(v: unknown): number {
  try {
    return parseMoneyToPaisa(v as string | number);
  } catch {
    return 0;
  }
}

function isReducingAdjustment(inv: DBInvoice, originalType: string): boolean {
  const t = String(inv.type || "");
  if (originalType === "sales-invoice") {
    return t === "sales-return" || t === "credit-note";
  }
  if (originalType === "purchase-invoice") {
    return t === "purchase-return" || t === "debit-note";
  }
  return false;
}

async function sumLinkedAdjustmentReduction(
  db: SutraERPDatabase,
  original: DBInvoice,
): Promise<number> {
  const originalType = String(original.type || "");
  const linked = await db.invoices
    .filter((inv) => {
      if (String(inv.status || "").toLowerCase() === "cancelled") return false;
      if (!isReducingAdjustment(inv, originalType)) return false;
      const orig =
        (inv as { originalInvoiceId?: string }).originalInvoiceId ||
        (inv as { original_invoice_id?: string }).original_invoice_id;
      return orig === original.id;
    })
    .toArray();
  let total = 0;
  for (const adj of linked) {
    total += moneyOrZero(adj.grandTotal ?? adj.total ?? 0);
  }
  return total;
}

async function sumPostedAllocations(
  db: SutraERPDatabase,
  documentId: string,
): Promise<{
  principal: number;
  discount: number;
  withholding: number;
  writeoff: number;
}> {
  const table = (db as any).settlementAllocations;
  const sums = { principal: 0, discount: 0, withholding: 0, writeoff: 0 };
  if (!table) return sums;
  const rows = await table
    .where("targetDocumentId")
    .equals(documentId)
    .toArray()
    .catch(async () => {
      const all = await table.toArray();
      return all.filter(
        (r: any) =>
          r.targetDocumentId === documentId || r.target_document_id === documentId,
      );
    });
  for (const r of rows as any[]) {
    if (String(r.status || "") !== "posted") continue;
    if (r.reversedByAllocationId || r.reversed_by_allocation_id) continue;
    const component = String(r.component || "principal");
    const paisa =
      typeof r.amountPaisa === "number"
        ? r.amountPaisa
        : typeof r.amount_paisa === "number"
          ? r.amount_paisa
          : moneyOrZero(r.amount);
    if (component === "discount") sums.discount += paisa;
    else if (component === "withholding") sums.withholding += paisa;
    else if (component === "writeoff") sums.writeoff += paisa;
    else sums.principal += paisa;
  }
  return sums;
}

export async function computeDocumentOutstanding(
  db: SutraERPDatabase,
  companyId: string,
  documentId: string,
): Promise<DocumentOutstanding | null> {
  const inv = await db.invoices.get(documentId);
  if (!inv) return null;

  const originalPaisa = moneyOrZero(inv.grandTotal ?? inv.total ?? 0);
  const alloc = await sumPostedAllocations(db, documentId);
  const adjPaisa = await sumLinkedAdjustmentReduction(db, inv);
  const settledPaisa =
    alloc.principal + alloc.discount + alloc.withholding + alloc.writeoff + adjPaisa;
  const remaining = Math.max(0, originalPaisa - settledPaisa);

  const state = await getOrCreateDocumentSettlementState(db, companyId, documentId);
  const currency =
    (inv as { currencyCode?: string }).currencyCode ||
    (inv as { currency?: string }).currency ||
    "NPR";

  return {
    document_id: documentId,
    document_type: String(inv.type || ""),
    party_id: inv.partyId || null,
    currency,
    original: paisaToString(originalPaisa),
    original_paisa: originalPaisa,
    allocated_principal: paisaToString(alloc.principal),
    allocated_principal_paisa: alloc.principal,
    allocated_discount: paisaToString(alloc.discount),
    allocated_discount_paisa: alloc.discount,
    allocated_withholding: paisaToString(alloc.withholding),
    allocated_withholding_paisa: alloc.withholding,
    allocated_writeoff: paisaToString(alloc.writeoff),
    allocated_writeoff_paisa: alloc.writeoff,
    adjustment_reduction: paisaToString(adjPaisa),
    adjustment_reduction_paisa: adjPaisa,
    remaining_outstanding: paisaToString(remaining),
    remaining_outstanding_paisa: remaining,
    settlement_version: state.settlementVersion,
  };
}

/**
 * Rebuild paidAmount / paymentStatus from posted allocations only.
 * Never mutates grandTotal.
 */
export async function rebuildInvoicePaidProjection(
  db: SutraERPDatabase,
  invoiceId: string,
): Promise<void> {
  const inv = await db.invoices.get(invoiceId);
  if (!inv) return;

  const grandPaisa = moneyOrZero(inv.grandTotal ?? inv.total ?? 0);
  const alloc = await sumPostedAllocations(db, invoiceId);
  const companyId =
    String((inv as { companyId?: string }).companyId || "") ||
    ((await db.companySettings.get("main")) as { companyId?: string } | undefined)?.companyId ||
    "local";
  const adjPaisa = await sumLinkedAdjustmentReduction(db, inv);
  const paidPaisa = alloc.principal + alloc.discount + alloc.withholding + alloc.writeoff + adjPaisa;
  const paidAmount = Math.round(paidPaisa) / 100;
  let paymentStatus = "unpaid";
  if (paidPaisa <= 0) paymentStatus = "unpaid";
  else if (paidPaisa >= grandPaisa) paymentStatus = "paid";
  else paymentStatus = "partial";

  await db.invoices.update(invoiceId, {
    paidAmount,
    paymentStatus,
  } as any);
  void companyId;
}