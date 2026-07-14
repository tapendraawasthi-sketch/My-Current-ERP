/**
 * UI-7 — shared manual purchase posting adapter.
 * Calls the same postPurchaseTransaction engine as Orbix.
 * Does not calculate accounting facts — maps form fields to the command only.
 */
import { postPurchaseTransaction } from "@/domains/purchase/postPurchaseTransaction";
import { generateId } from "@/lib/db";

export async function postManualPurchaseInvoice(input: {
  companyId: string;
  financialYearId?: string | null;
  userId: string;
  userRole?: string | null;
  transactionDate: string;
  supplierId?: string | null;
  supplierName?: string | null;
  paymentMethod: "cash" | "bank" | "credit";
  paymentAccountId?: string | null;
  items: Array<{
    itemId: string;
    quantity: string;
    unit: string;
    rate: string;
    amount: string;
  }>;
  subtotal: string;
  discount?: string;
  tax?: string;
  grandTotal: string;
  currency?: string;
  narration: string;
}) {
  const requestId = generateId();
  return postPurchaseTransaction({
    commandId: requestId,
    requestId,
    idempotencyKey: `manual-purchase-${requestId}`,
    companyId: input.companyId,
    financialYearId: input.financialYearId ?? null,
    userId: input.userId,
    userRole: input.userRole ?? null,
    source: "manual_form",
    purchase: {
      transactionDate: input.transactionDate,
      supplierId: input.supplierId ?? null,
      supplierName: input.supplierName ?? null,
      paymentMethod: input.paymentMethod,
      paymentAccountId: input.paymentAccountId ?? null,
      items: input.items,
      subtotal: input.subtotal,
      discount: input.discount,
      tax: input.tax,
      grandTotal: input.grandTotal,
      currency: input.currency || "NPR",
      narration: input.narration,
    },
  });
}
