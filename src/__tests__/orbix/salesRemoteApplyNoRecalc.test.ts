import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postSalesTransaction,
  seedOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_ITEM_ID,
  E2E_SALES_USER_AUTHORIZED,
} from "@/domains/sales";
import { applyRemoteSyncEnvelope } from "@/platform/sync/applyRemoteEvent";

async function prepareDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  await seedOrbixSalesE2ECompany();
  return getDB();
}

describe("sales remote apply — no recalculation", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("Device B applies event cost X even when local item cost is Y", async () => {
    const db = getDB();

    const result = await postSalesTransaction({
      commandId: "sale-remote-a",
      requestId: "sale-remote-req",
      draftId: "draft-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-remote",
      idempotencyKey: "sale-remote-idem",
      companyId: E2E_SALES_COMPANY_ID,
      userId: E2E_SALES_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      sale: {
        transactionDate: "2026-07-12",
        paymentMethod: "cash",
        paymentAccountId: "acc-cash",
        warehouseId: "wh-main",
        items: [
          {
            itemId: E2E_SALES_ITEM_ID,
            quantity: "1",
            unit: "pcs",
            rate: "60000.00",
            lineAmount: "60000.00",
          },
        ],
        subtotal: "60000.00",
        grandTotal: "60000.00",
        currency: "NPR",
        narration: "E2E remote cost proof",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;

    const queue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(queue.length).toBe(1);
    const envelope = queue[0].envelope as {
      eventId: string;
      timestamp: string;
      hash: string;
      payload: Record<string, unknown>;
    };

    const invoiceId = result.payload.invoice_id;
    await db.invoices.delete(invoiceId);
    await db.vouchers.delete(`jnl-${invoiceId}`);
    await db.vouchers.delete(`jnl-cogs-${invoiceId}`);
    await db.stockMovements.where("referenceId").equals(invoiceId).delete();
    if (db.salesCostAllocations) {
      const allocs = await db.salesCostAllocations.where("invoice_id").equals(invoiceId).toArray();
      for (const a of allocs) await db.salesCostAllocations.delete(a.id);
    }
    await db.eventSyncQueue.clear();
    await db.items.update(E2E_SALES_ITEM_ID, { costPrice: 99999 } as any);

    const payload = {
      ...envelope.payload,
      device_id: "device-b-isolated",
    };

    const applied = await applyRemoteSyncEnvelope({
      eventId: envelope.eventId,
      eventType: "sales_posted",
      aggregateType: "sale",
      aggregateId: invoiceId,
      aggregateVersion: 1,
      tenantId: "local",
      principalId: "remote",
      timestamp: envelope.timestamp || new Date().toISOString(),
      hash: envelope.hash,
      payload,
      correlationId: envelope.eventId,
      signature: "",
      deviceId: "device-b-isolated",
      companyId: E2E_SALES_COMPANY_ID,
      globalSequence: 1,
      remoteSequence: 1,
    } as any);

    expect(applied.status).toBe("applied");

    const cogs = await db.vouchers.get(`jnl-cogs-${invoiceId}`);
    expect(cogs).toBeTruthy();
    expect(Number((cogs as { totalDebit?: number }).totalDebit)).toBe(50000);

    const movements = await db.stockMovements.where("referenceId").equals(invoiceId).toArray();
    expect(movements.length).toBe(1);
    expect(Number(movements[0].amount)).toBe(50000);
    expect(Number(movements[0].rate)).toBe(50000);

    const allocs = await db.salesCostAllocations.where("invoice_id").equals(invoiceId).toArray();
    expect(Number(allocs[0].total_cost)).toBe(50000);

    const item = await db.items.get(E2E_SALES_ITEM_ID);
    expect(Number((item as { costPrice?: number }).costPrice)).toBe(99999);
  });
});
