/**
 * Remaining returnable quantity and creditable amount engine (Phase 7).
 * Derived from original sale + linked posted adjustments — never mutates the original.
 */

import type { SutraERPDatabase, DBInvoice } from "@/lib/db";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";

export interface LineRemainingBalance {
  original_sales_line_id: string;
  item_id: string;
  original_quantity: number;
  previously_returned_quantity: number;
  remaining_returnable_quantity: number;
  original_line_total: number;
  original_taxable: number;
  original_vat: number;
  original_unit_cost: number;
  original_cost_amount: number;
  previously_credited_total: number;
  previously_reversed_vat: number;
  previously_reversed_cost: number;
  remaining_creditable_total: number;
  remaining_reversible_vat: number;
  remaining_reversible_cost: number;
}

export interface InvoiceRemainingBalance {
  original_invoice_id: string;
  invoice_number: string;
  customer_id: string | null;
  status: string;
  adjustment_version: number;
  lines: LineRemainingBalance[];
  prior_adjustment_ids: string[];
}

function lineId(inv: DBInvoice, idx: number, line: { id?: string }): string {
  return line.id || `line-${inv.id}-${idx}`;
}

export interface SalesInvoiceAdjustmentStateRow {
  id: string;
  companyId: string;
  adjustmentVersion: number;
  updatedAt: string;
}

export async function listPostedAdjustmentsForInvoice(
  db: SutraERPDatabase,
  originalInvoiceId: string,
): Promise<DBInvoice[]> {
  return db.invoices
    .filter((inv) => {
      const t = String(inv.type || "");
      if (t !== "sales-return" && t !== "credit-note") return false;
      if (String(inv.status || "").toLowerCase() === "cancelled") return false;
      const orig =
        (inv as { originalInvoiceId?: string }).originalInvoiceId ||
        (inv as { original_invoice_id?: string }).original_invoice_id;
      return orig === originalInvoiceId;
    })
    .toArray();
}

/**
 * Load or derive optimistic concurrency version for adjustments against an original sale.
 * Uses `salesInvoiceAdjustmentState` when the table exists; otherwise derives from prior
 * posted adjustments so tests can run before migration is applied.
 */
export async function getOrCreateAdjustmentState(
  db: SutraERPDatabase,
  companyId: string,
  originalInvoiceId: string,
): Promise<SalesInvoiceAdjustmentStateRow> {
  const nowIso = new Date().toISOString();
  if (db.salesInvoiceAdjustmentState) {
    const existing = await db.salesInvoiceAdjustmentState.get(originalInvoiceId);
    if (existing && typeof existing.adjustmentVersion === "number") {
      return {
        id: String(existing.id || originalInvoiceId),
        companyId: String(existing.companyId || companyId),
        adjustmentVersion: existing.adjustmentVersion,
        updatedAt: String(existing.updatedAt || nowIso),
      };
    }
    const prior = await listPostedAdjustmentsForInvoice(db, originalInvoiceId);
    const row: SalesInvoiceAdjustmentStateRow = {
      id: originalInvoiceId,
      companyId,
      adjustmentVersion: prior.length,
      updatedAt: nowIso,
    };
    await db.salesInvoiceAdjustmentState.put(row as any);
    return row;
  }
  const prior = await listPostedAdjustmentsForInvoice(db, originalInvoiceId);
  return {
    id: originalInvoiceId,
    companyId,
    adjustmentVersion: prior.length,
    updatedAt: nowIso,
  };
}

export async function bumpAdjustmentVersion(
  db: SutraERPDatabase,
  companyId: string,
  originalInvoiceId: string,
  nextVersion: number,
  nowIso: string,
): Promise<void> {
  if (!db.salesInvoiceAdjustmentState) return;
  await db.salesInvoiceAdjustmentState.put({
    id: originalInvoiceId,
    companyId,
    adjustmentVersion: nextVersion,
    updatedAt: nowIso,
  } as any);
}

export async function getOriginalSaleAdjustmentVersion(
  db: SutraERPDatabase,
  originalInvoiceId: string,
): Promise<number> {
  if (db.salesInvoiceAdjustmentState) {
    const row = await db.salesInvoiceAdjustmentState.get(originalInvoiceId);
    if (row && typeof row.adjustmentVersion === "number") return row.adjustmentVersion;
  }
  const prior = await listPostedAdjustmentsForInvoice(db, originalInvoiceId);
  return prior.length;
}

export async function computeInvoiceRemainingBalance(
  db: SutraERPDatabase,
  originalInvoiceId: string,
): Promise<InvoiceRemainingBalance | null> {
  const original = await db.invoices.get(originalInvoiceId);
  if (!original || original.type !== "sales-invoice") return null;

  const prior = await listPostedAdjustmentsForInvoice(db, originalInvoiceId);
  const version = await getOriginalSaleAdjustmentVersion(db, originalInvoiceId);

  const returnedByLine = new Map<string, number>();
  const creditedByLine = new Map<string, number>();
  const vatByLine = new Map<string, number>();
  const costByLine = new Map<string, number>();

  for (const adj of prior) {
    const isReturn = adj.type === "sales-return";
    for (const line of adj.lines || []) {
      const origLineId =
        (line as { originalSalesLineId?: string }).originalSalesLineId ||
        (line as { original_sales_line_id?: string }).original_sales_line_id ||
        "";
      if (!origLineId) continue;
      const qty = Math.abs(Number(line.qty || 0));
      const total = Math.abs(Number(line.lineTotal ?? line.totalAmount ?? line.netAmount ?? 0));
      const vat = Math.abs(Number((line as { vatAmount?: number }).vatAmount ?? 0));
      const costAmt = Math.abs(Number((line as { costAmount?: number }).costAmount ?? 0));
      if (isReturn) {
        returnedByLine.set(origLineId, (returnedByLine.get(origLineId) || 0) + qty);
        costByLine.set(origLineId, (costByLine.get(origLineId) || 0) + costAmt);
      }
      creditedByLine.set(origLineId, (creditedByLine.get(origLineId) || 0) + total);
      vatByLine.set(origLineId, (vatByLine.get(origLineId) || 0) + vat);
    }
  }

  const lines: LineRemainingBalance[] = (original.lines || []).map((line, idx) => {
    const sid = lineId(original, idx, line);
    const origQty = Number(line.qty || 0);
    const returned = returnedByLine.get(sid) || 0;
    const lineTotal = Number(line.lineTotal ?? line.totalAmount ?? line.netAmount ?? 0);
    const taxable = Number(line.taxableAmount ?? line.netAmount ?? lineTotal);
    const vat = Number((line as { vatAmount?: number }).vatAmount ?? 0);
    const unitCost = Number((line as { unitCost?: number }).unitCost ?? 0);
    const costAmount = Number((line as { costAmount?: number }).costAmount ?? unitCost * origQty);
    const credited = creditedByLine.get(sid) || 0;
    const vatRev = vatByLine.get(sid) || 0;
    const costRev = costByLine.get(sid) || 0;

    return {
      original_sales_line_id: sid,
      item_id: String(line.itemId || ""),
      original_quantity: origQty,
      previously_returned_quantity: returned,
      remaining_returnable_quantity: Math.max(0, Math.round((origQty - returned) * 1e6) / 1e6),
      original_line_total: lineTotal,
      original_taxable: taxable,
      original_vat: vat,
      original_unit_cost: unitCost,
      original_cost_amount: costAmount,
      previously_credited_total: credited,
      previously_reversed_vat: vatRev,
      previously_reversed_cost: costRev,
      remaining_creditable_total: Math.max(0, Math.round((lineTotal - credited) * 100) / 100),
      remaining_reversible_vat: Math.max(0, Math.round((vat - vatRev) * 100) / 100),
      remaining_reversible_cost: Math.max(0, Math.round((costAmount - costRev) * 100) / 100),
    };
  });

  return {
    original_invoice_id: original.id,
    invoice_number: original.invoiceNo,
    customer_id: original.partyId || null,
    status: String(original.status || ""),
    adjustment_version: version,
    lines,
    prior_adjustment_ids: prior.map((p) => p.id),
  };
}

/** Proportionally reverse money for a partial quantity; final slice absorbs rounding remainder. */
export function proportionMoney(
  originalAmount: number,
  returnQty: number,
  originalQty: number,
  remainingAmount: number,
  isFinalSlice: boolean,
): number {
  if (!(originalQty > 0) || !(returnQty > 0)) return 0;
  if (isFinalSlice) {
    return Math.max(0, Math.round(remainingAmount * 100) / 100);
  }
  const raw = (originalAmount * returnQty) / originalQty;
  const rounded = Math.round(raw * 100) / 100;
  return Math.min(rounded, Math.max(0, remainingAmount));
}

export function moneyString(n: number): string {
  return paisaToString(parseMoneyToPaisa(String(n)));
}
