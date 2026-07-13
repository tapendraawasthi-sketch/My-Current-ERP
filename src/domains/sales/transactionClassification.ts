/**
 * Explicit transaction classification for Orbix / Sutra posting.
 * Phase 6 fully implements only the three inventory sale variants.
 */

export type TransactionClassification =
  | "inventory_sale_cash"
  | "inventory_sale_bank"
  | "inventory_sale_credit"
  | "non_inventory_income"
  | "asset_disposal"
  | "journal"
  | "receipt"
  | "stock_adjustment"
  | "sales_return"
  | "credit_note"
  | "inventory_purchase_cash"
  | "inventory_purchase_bank"
  | "inventory_purchase_credit";

export const PHASE6_SUPPORTED_SALES: ReadonlySet<TransactionClassification> = new Set([
  "inventory_sale_cash",
  "inventory_sale_bank",
  "inventory_sale_credit",
]);

export function classificationFromSalePayment(
  paymentMethod: "cash" | "bank" | "credit",
): TransactionClassification {
  if (paymentMethod === "bank") return "inventory_sale_bank";
  if (paymentMethod === "credit") return "inventory_sale_credit";
  return "inventory_sale_cash";
}

export function isSupportedInventorySale(
  classification: TransactionClassification | string | null | undefined,
): boolean {
  return PHASE6_SUPPORTED_SALES.has(classification as TransactionClassification);
}
