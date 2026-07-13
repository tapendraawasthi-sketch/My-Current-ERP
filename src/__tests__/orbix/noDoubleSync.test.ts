import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import { postPurchaseTransaction, seedOrbixE2ECompany, E2E_COMPANY_ID, E2E_ITEM_ID, E2E_USER_AUTHORIZED } from "@/domains/purchase";
import {
  postSalesTransaction,
  seedOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_ITEM_ID,
  E2E_SALES_USER_AUTHORIZED,
} from "@/domains/sales";
import { isAccountingEntitySyncBlocked } from "@/store/syncEnqueueRouter";

describe("Phase 6 no double-sync", () => {
  beforeEach(async () => {
    await Dexie.delete("SutraERPDatabase");
    const db = await resetDB();
    await db.open();
    await db.fiscalYears.put({
      ...DEFAULT_FISCAL_YEAR,
      id: "fy-double-sync",
      isCurrent: true,
    } as any);
  });

  it("blocks legacy accounting entity types", () => {
    expect(isAccountingEntitySyncBlocked("invoice")).toBe(true);
    expect(isAccountingEntitySyncBlocked("voucher")).toBe(true);
    expect(isAccountingEntitySyncBlocked("stockMovement")).toBe(true);
    expect(isAccountingEntitySyncBlocked("party")).toBe(false);
    expect(isAccountingEntitySyncBlocked("item")).toBe(false);
  });

  it("one purchase → one canonical event, no syncOutbox invoice", async () => {
    await seedOrbixE2ECompany();
    const db = getDB();
    const result = await postPurchaseTransaction({
      commandId: "p1",
      requestId: "p1",
      draftId: "d1",
      previewHash: "h1",
      previewVersion: 1,
      idempotencyKey: "idem-p1",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      purchase: {
        transactionDate: "2026-07-12",
        paymentMethod: "cash",
        paymentAccountId: "acc-cash",
        items: [
          { itemId: E2E_ITEM_ID, quantity: "1", unit: "pcs", rate: "50000", amount: "50000" },
        ],
        subtotal: "50000",
        grandTotal: "50000",
        currency: "NPR",
        narration: "double-sync purchase",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;
    const outbox = await db.syncOutbox
      .filter((s) => s.entityId === result.payload.invoice_id)
      .toArray();
    const events = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(outbox.length).toBe(0);
    expect(events.length).toBe(1);
  });

  it("one sale → one canonical sales_posted event, no syncOutbox invoice", async () => {
    await seedOrbixSalesE2ECompany();
    const db = getDB();
    const result = await postSalesTransaction({
      commandId: "s1",
      requestId: "s1",
      draftId: "ds1",
      previewHash: "hs1",
      previewVersion: 1,
      idempotencyKey: "idem-s1",
      companyId: E2E_SALES_COMPANY_ID,
      userId: E2E_SALES_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      sale: {
        transactionDate: "2026-07-12",
        paymentMethod: "cash",
        paymentAccountId: "acc-cash",
        items: [
          {
            itemId: E2E_SALES_ITEM_ID,
            quantity: "1",
            unit: "pcs",
            rate: "60000",
            lineAmount: "60000",
          },
        ],
        subtotal: "60000",
        grandTotal: "60000",
        currency: "NPR",
        narration: "double-sync sale",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;
    const outbox = await db.syncOutbox
      .filter((s) => s.entityId === result.payload.invoice_id)
      .toArray();
    const events = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(outbox.length).toBe(0);
    expect(events.length).toBe(1);
    expect((events[0].envelope as { eventType?: string })?.eventType).toBe("sales_posted");
  });
});
