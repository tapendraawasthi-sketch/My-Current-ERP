/**
 * Disposable Orbix Sales E2E company seed / reset — development only.
 */

import { getDB, generateId } from "@/lib/db";
import {
  E2E_SALES_COMPANY_ID,
  E2E_SALES_COMPANY_NAME,
  E2E_SALES_CUSTOMER_ID,
  E2E_SALES_CUSTOMER_NAME,
  E2E_SALES_ITEM_ID,
  E2E_SALES_ITEM_NAME,
} from "./postSalesTransaction";
import { E2E_SALES_INVENTORY_POLICY } from "./inventoryAccountingPolicy";

export const E2E_SALES_USER_AUTHORIZED = "user-e2e-sales-accountant";
export const E2E_SALES_USER_RESTRICTED = "user-e2e-sales-viewer";
export const E2E_SALES_FY_ID = "fy-e2e-sales-orbix";
export const E2E_SALES_OPENING_STOCK = 100;

function isE2ESalesBikeInvoice(inv: {
  type?: string;
  narration?: string;
  createdBy?: string;
  partyId?: string;
  companyId?: string;
  lines?: Array<{ itemId?: string; itemName?: string }>;
}): boolean {
  const hasBike = (inv.lines || []).some(
    (l) => l.itemId === E2E_SALES_ITEM_ID || l.itemName === E2E_SALES_ITEM_NAME,
  );
  if (inv.type === "sales-invoice") {
    return (
      Boolean(
        inv.narration?.includes("E2E") ||
          inv.createdBy === E2E_SALES_USER_AUTHORIZED ||
          hasBike ||
          inv.partyId === E2E_SALES_CUSTOMER_ID ||
          inv.companyId === E2E_SALES_COMPANY_ID,
      ) && (hasBike || inv.partyId === E2E_SALES_CUSTOMER_ID || inv.companyId === E2E_SALES_COMPANY_ID)
    );
  }
  return false;
}

async function deleteInvoiceCascade(
  db: ReturnType<typeof getDB>,
  invId: string,
): Promise<void> {
  await db.stockMovements.where("referenceId").equals(invId).delete();
  const inv = await db.invoices.get(invId);
  const jnlId =
    (inv as { accountingVoucherId?: string } | undefined)?.accountingVoucherId || `jnl-${invId}`;
  await db.vouchers.delete(jnlId);
  await db.vouchers.delete(`jnl-cogs-${invId}`);
  await db.vouchers.delete(`jnl-cogs-rev-${invId}`);
  await db.invoices.delete(invId);
}

/** Remove prior E2E sales artifacts and restore known masters + stock. */
export async function resetOrbixSalesE2ECompany(): Promise<void> {
  const db = getDB();

  const invoices = await db.invoices.toArray();
  const e2eInvoiceIds = new Set<string>();

  for (const inv of invoices) {
    if (!isE2ESalesBikeInvoice(inv as never) && inv.type === "sales-invoice") {
      const hasBike = (inv.lines || []).some(
        (l: { itemId?: string }) => l.itemId === E2E_SALES_ITEM_ID,
      );
      if (!hasBike) continue;
    } else if (inv.type !== "sales-invoice") {
      continue;
    }
    e2eInvoiceIds.add(inv.id);
  }

  // Sales returns / credit notes against E2E bike or deleted originals
  for (const inv of invoices) {
    if (inv.type !== "sales-return" && inv.type !== "credit-note") continue;
    const originalId =
      (inv as { originalInvoiceId?: string }).originalInvoiceId ||
      (inv as { original_invoice_id?: string }).original_invoice_id;
    const hasBike = (inv.lines || []).some(
      (l: { itemId?: string; itemName?: string }) =>
        l.itemId === E2E_SALES_ITEM_ID || l.itemName === E2E_SALES_ITEM_NAME,
    );
    const companyMatch =
      (inv as { companyId?: string }).companyId === E2E_SALES_COMPANY_ID ||
      inv.createdBy === E2E_SALES_USER_AUTHORIZED ||
      Boolean(inv.narration?.includes("E2E"));
    if (
      hasBike ||
      companyMatch ||
      (originalId && e2eInvoiceIds.has(originalId))
    ) {
      e2eInvoiceIds.add(inv.id);
    }
  }

  for (const id of e2eInvoiceIds) {
    await deleteInvoiceCascade(db, id);
  }

  if (db.salesInvoiceAdjustmentState) {
    const states = await db.salesInvoiceAdjustmentState.toArray();
    for (const row of states) {
      if (
        row.companyId === E2E_SALES_COMPANY_ID ||
        e2eInvoiceIds.has(row.id) ||
        String(row.id || "").includes("e2e")
      ) {
        await db.salesInvoiceAdjustmentState.delete(row.id);
      }
    }
  }

  if (db.salesCostAllocations) {
    const allocs = await db.salesCostAllocations.toArray();
    for (const a of allocs) {
      if (
        a.company_id === E2E_SALES_COMPANY_ID ||
        a.item_id === E2E_SALES_ITEM_ID ||
        String(a.invoice_id || "").startsWith("inv-") ||
        (a.invoice_id && e2eInvoiceIds.has(a.invoice_id))
      ) {
        await db.salesCostAllocations.delete(a.id);
      }
    }
  }

  // Clear opening + sale / return movements for bike in sales company context
  const movements = await db.stockMovements.toArray();
  for (const m of movements) {
    if (
      m.itemId === E2E_SALES_ITEM_ID &&
      (String(m.referenceType || "").includes("sales") ||
        String(m.referenceId || "").startsWith("e2e-sales-open") ||
        String(m.narration || "").includes("E2E Sales opening") ||
        (m.referenceId && e2eInvoiceIds.has(m.referenceId)))
    ) {
      await db.stockMovements.delete(m.id);
    }
  }

  const receipts = (await db.orbixPostingReceipts?.toArray?.().catch(() => [])) ?? [];
  for (const r of receipts) {
    if (
      r.operation === "post_sale" ||
      r.operation === "post_sales_return" ||
      r.operation === "post_sales_credit_note" ||
      r.companyId === E2E_SALES_COMPANY_ID ||
      r.userId === E2E_SALES_USER_AUTHORIZED ||
      (r.invoiceId && e2eInvoiceIds.has(r.invoiceId))
    ) {
      await db.orbixPostingReceipts.delete(r.id);
    }
  }

  if (db.eventSyncQueue) {
    const queue = await db.eventSyncQueue.toArray();
    for (const row of queue) {
      const envelope = row.envelope as { eventType?: string } | undefined;
      const et = envelope?.eventType || "";
      if (
        row.companyId === E2E_SALES_COMPANY_ID ||
        et === "sales_posted" ||
        et === "sales_return_posted" ||
        et === "sales_credit_note_posted" ||
        String(row.idempotencyKey || "").includes("sale")
      ) {
        await db.eventSyncQueue.delete(row.id);
      }
    }
  }
  if (db.domainEvents) {
    const events = await db.domainEvents.toArray();
    for (const e of events) {
      if (
        e.eventType === "sales_posted" ||
        e.eventType === "sales_return_posted" ||
        e.eventType === "sales_credit_note_posted" ||
        e.companyId === E2E_SALES_COMPANY_ID
      ) {
        await db.domainEvents.delete(e.id);
      }
    }
  }

  for (const id of [
    "acc-cash",
    "acc-bank",
    "acc-sales",
    "acc-sundry-debtors",
    "acc-cogs",
    "acc-inventory",
    "acc-vat-payable",
  ]) {
    await db.accounts.update(id, { balance: 0 }).catch(() => undefined);
  }

  await seedOrbixSalesE2ECompany();
}

export async function seedOrbixSalesE2ECompany(): Promise<{
  companyId: string;
  itemId: string;
  customerId: string;
  authorizedUserId: string;
  restrictedUserId: string;
}> {
  const db = getDB();
  const now = new Date().toISOString();

  await db.companySettings.put({
    id: "main",
    companyId: E2E_SALES_COMPANY_ID,
    name: E2E_SALES_COMPANY_NAME,
    companyName: E2E_SALES_COMPANY_NAME,
    syncPolicy: "sync_enabled",
    allowNegativeStock: false,
    inventoryAccountingMode: E2E_SALES_INVENTORY_POLICY.inventoryAccounting,
    stockValuationMethod: E2E_SALES_INVENTORY_POLICY.valuationMethod,
    negativeStockPolicy: E2E_SALES_INVENTORY_POLICY.negativeStock,
    inventoryAccountId: E2E_SALES_INVENTORY_POLICY.inventoryAccountId,
    cogsAccountId: E2E_SALES_INVENTORY_POLICY.cogsAccountId,
    outputVatAccountId: E2E_SALES_INVENTORY_POLICY.outputVatAccountId,
    updatedAt: now,
  } as any);

  // Keep E2E FY covering "today" (Nepal FY rolls mid-July). Always upsert.
  await db.fiscalYears.put({
    id: E2E_SALES_FY_ID,
    name: "E2E Sales FY 2083/84",
    startDate: "2026-07-16",
    endDate: "2027-07-15",
    status: "open",
    isDefault: true,
    isCurrent: true,
    createdAt: now,
  } as any);

  const ensureUser = async (
    id: string,
    username: string,
    role: string,
    permissions: string[],
  ) => {
    const existing = await db.users.get(id);
    if (existing) {
      await db.users.update(id, { role, permissions, isActive: true, name: username });
      return;
    }
    await db.users.add({
      id,
      username,
      name: username,
      role,
      permissions,
      isActive: true,
      createdAt: now,
    } as any);
  };

  await ensureUser(E2E_SALES_USER_AUTHORIZED, "e2e.sales.accountant", "accountant", [
    "sales.post",
    "sales.draft",
    "sales.preview",
    "report.view",
    "journal.view",
    "inventory.view",
  ]);
  await ensureUser(E2E_SALES_USER_RESTRICTED, "e2e.sales.viewer", "viewer", [
    "report.view",
    "journal.view",
  ]);

  for (const acc of [
    { id: "acc-cash", code: "1401", name: "Cash", type: "asset", balance: 0 },
    { id: "acc-bank", code: "1402", name: "Bank", type: "asset", balance: 0 },
    { id: "acc-sales", code: "4101", name: "Sales", type: "income", balance: 0 },
    {
      id: "acc-sundry-debtors",
      code: "1201",
      name: "Sundry Debtors",
      type: "asset",
      balance: 0,
    },
    { id: "acc-cogs", code: "5102", name: "Cost of Goods Sold", type: "expense", balance: 0 },
    { id: "acc-inventory", code: "1310", name: "Inventory", type: "asset", balance: 0 },
    { id: "acc-vat-payable", code: "2101", name: "VAT Payable", type: "liability", balance: 0 },
  ]) {
    const found = await db.accounts.get(acc.id);
    if (!found) {
      await db.accounts.add({
        ...acc,
        level: 1,
        isGroup: false,
        isActive: true,
        createdAt: now,
      } as any);
    }
  }

  const bike = await db.items.get(E2E_SALES_ITEM_ID);
  if (!bike) {
    await db.items.add({
      id: E2E_SALES_ITEM_ID,
      code: "E2E-BIKE",
      name: E2E_SALES_ITEM_NAME,
      unit: "pcs",
      type: "goods",
      isActive: true,
      costPrice: 50000,
      salesRate: 60000,
      sellingPrice: 60000,
      salePrice: 60000,
      openingQty: E2E_SALES_OPENING_STOCK,
      currentStock: E2E_SALES_OPENING_STOCK,
      createdAt: now,
    } as any);
  } else {
    await db.items.update(E2E_SALES_ITEM_ID, {
      name: E2E_SALES_ITEM_NAME,
      unit: "pcs",
      type: "goods",
      isActive: true,
      costPrice: 50000,
      sellingPrice: 60000,
      salePrice: 60000,
      currentStock: E2E_SALES_OPENING_STOCK,
    });
  }

  // Deterministic opening stock movement
  const openId = "e2e-sales-open-bike";
  const existingOpen = await db.stockMovements.get(openId);
  if (!existingOpen) {
    await db.stockMovements.add({
      id: openId,
      date: "2026-07-17",
      type: "opening",
      itemId: E2E_SALES_ITEM_ID,
      itemName: E2E_SALES_ITEM_NAME,
      warehouseId: "wh-main",
      warehouseName: "Main Warehouse",
      qty: E2E_SALES_OPENING_STOCK,
      rate: 50000,
      amount: E2E_SALES_OPENING_STOCK * 50000,
      referenceId: openId,
      referenceType: "opening",
      narration: "E2E Sales opening stock",
    } as any);
  } else {
    await db.stockMovements.put({
      ...existingOpen,
      qty: E2E_SALES_OPENING_STOCK,
      narration: "E2E Sales opening stock",
    } as any);
  }

  const party = await db.parties.get(E2E_SALES_CUSTOMER_ID);
  if (!party) {
    await db.parties.add({
      id: E2E_SALES_CUSTOMER_ID,
      name: E2E_SALES_CUSTOMER_NAME,
      type: "customer",
      isActive: true,
      createdAt: now,
    } as any);
  } else {
    await db.parties.update(E2E_SALES_CUSTOMER_ID, {
      name: E2E_SALES_CUSTOMER_NAME,
      type: "customer",
      isActive: true,
    });
  }

  return {
    companyId: E2E_SALES_COMPANY_ID,
    itemId: E2E_SALES_ITEM_ID,
    customerId: E2E_SALES_CUSTOMER_ID,
    authorizedUserId: E2E_SALES_USER_AUTHORIZED,
    restrictedUserId: E2E_SALES_USER_RESTRICTED,
  };
}

/** Test helper */
export function e2eSalesMarker(): string {
  return `e2e-sales-${generateId().slice(0, 8)}`;
}
