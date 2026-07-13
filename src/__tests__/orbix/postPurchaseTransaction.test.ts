import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postPurchaseTransaction,
  seedOrbixE2ECompany,
  resetOrbixE2ECompany,
  E2E_COMPANY_ID,
  E2E_ITEM_ID,
  E2E_USER_AUTHORIZED,
  E2E_USER_RESTRICTED,
} from "@/domains/purchase";

async function prepareDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  // Ensure purchase date falls inside FY
  await seedOrbixE2ECompany();
  // Align E2E FY with DEFAULT so assertDateInFiscalYear passes
  await db.fiscalYears.put({
    id: "fy-e2e-aligned",
    name: "E2E aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  const names = db.tables.map((t) => t.name);
  if (!names.includes("orbixPostingReceipts")) {
    throw new Error(`orbixPostingReceipts missing; verno=${db.verno}; tables=${names.join(",")}`);
  }
  return getDB();
}

function baseCmd(overrides: Record<string, unknown> = {}) {
  return {
    commandId: "cmd-1",
    requestId: "req-1",
    draftId: "draft-bike-1",
    draftVersion: 2,
    previewVersion: 2,
    previewHash: "hash-abc",
    idempotencyKey: "idem-1",
    companyId: E2E_COMPANY_ID,
    userId: E2E_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "orbix" as const,
    purchase: {
      transactionDate: "2026-07-12",
      paymentMethod: "cash" as const,
      paymentAccountId: "acc-cash",
      items: [
        {
          itemId: E2E_ITEM_ID,
          quantity: "1",
          unit: "pcs",
          rate: "50000.00",
          amount: "50000.00",
        },
      ],
      subtotal: "50000.00",
      grandTotal: "50000.00",
      currency: "NPR",
      narration: "E2E bike purchase",
    },
    ...overrides,
  };
}

describe("postPurchaseTransaction", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("posts invoice, journal, stock, audit, sync, and receipt atomically", async () => {
    const db = getDB();
    const result = await postPurchaseTransaction(baseCmd());
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }
    expect(result.type).toBe("posting_completed");

    const invoice = await db.invoices.get(result.payload.invoice_id);
    const journal = await db.vouchers.get(result.payload.voucher_id);
    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    const audits = await db.auditLogs
      .filter((a) => a.entityId === result.payload.invoice_id)
      .toArray();
    const sync = await db.syncOutbox
      .filter((s) => s.entityId === result.payload.invoice_id)
      .toArray();
    const receipt = await db.orbixPostingReceipts.get(result.payload.receipt_id!);

    expect(invoice?.status).toBe("posted");
    expect(journal?.status).toBe("posted");
    expect(movements.length).toBe(1);
    expect(movements[0].qty).toBe(1);
    expect(audits.length).toBeGreaterThanOrEqual(1);
    // Phase 6 cutover: no legacy accounting entity sync for posted invoices
    expect(sync.length).toBe(0);
    expect(receipt?.status).toBe("completed");
    expect(result.payload.idempotent_replay).toBe(false);
    expect(result.payload.sync_status).toBe("pending");
    expect(result.payload.sync_event_id).toBeTruthy();

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(eventQueue.length).toBe(1);
    expect(eventQueue[0].status).toBe("pending");
    expect(eventQueue[0].origin).toBe("local_user");

    const domainEvent = await db.domainEvents.get(result.payload.sync_event_id!);
    expect(domainEvent?.eventType).toBe("purchase_posted");
  });

  it("replays identical confirmation without duplicating records", async () => {
    const db = getDB();
    const first = await postPurchaseTransaction(baseCmd());
    expect(first.type).toBe("posting_completed");
    const second = await postPurchaseTransaction(baseCmd({ requestId: "req-2", commandId: "cmd-2" }));
    expect(second.type).toBe("posting_completed");
    if (first.type !== "posting_completed" || second.type !== "posting_completed") return;

    expect(second.payload.idempotent_replay).toBe(true);
    expect(second.payload.invoice_id).toBe(first.payload.invoice_id);

    const invoices = await db.invoices.filter((i) => i.id === first.payload.invoice_id).count();
    expect(invoices).toBe(1);
    const movements = await db.stockMovements
      .where("referenceId")
      .equals(first.payload.invoice_id)
      .count();
    expect(movements).toBe(1);
  });

  it("rejects restricted role without writing", async () => {
    const db = getDB();
    const before = await db.invoices.count();
    const result = await postPurchaseTransaction(
      baseCmd({
        userId: E2E_USER_RESTRICTED,
        userRole: "viewer",
        idempotencyKey: "idem-restricted",
      }),
    );
    expect(result.type).toBe("permission_denied");
    expect(await db.invoices.count()).toBe(before);
  });

  it("rejects Ask mode for orbix source", async () => {
    const result = await postPurchaseTransaction(
      baseCmd({ orbixMode: "ask", idempotencyKey: "idem-ask" }),
    );
    expect(result.type).toBe("permission_denied");
    expect(result.status).toBe("failed");
  });

  it("rolls back on injected failure before stock", async () => {
    const db = getDB();
    const beforeInv = await db.invoices.count();
    const beforeMov = await db.stockMovements.count();
    const beforeVouchers = await db.vouchers.count();

    const result = await postPurchaseTransaction(
      baseCmd({
        idempotencyKey: "idem-fail",
        injectFailure: "before_stock",
      }),
    );
    expect(result.type).toBe("posting_failed");
    if (result.type === "posting_completed") return;
    expect(result.payload.rolled_back).toBe(true);
    expect(await db.invoices.count()).toBe(beforeInv);
    expect(await db.stockMovements.count()).toBe(beforeMov);
    expect(await db.vouchers.count()).toBe(beforeVouchers);
  });

  it("rejects zero quantity", async () => {
    const result = await postPurchaseTransaction(
      baseCmd({
        idempotencyKey: "idem-zq",
        purchase: {
          ...baseCmd().purchase,
          items: [
            {
              itemId: E2E_ITEM_ID,
              quantity: "0",
              unit: "pcs",
              rate: "50000.00",
              amount: "50000.00",
            },
          ],
        },
      }),
    );
    expect(result.type).toBe("validation_error");
  });

  it("resetOrbixE2ECompany reseeds bike item", async () => {
    await resetOrbixE2ECompany();
    const item = await getDB().items.get(E2E_ITEM_ID);
    expect(item?.name).toBe("E2E Test Bike");
    expect(item?.unit).toBe("pcs");
  });
});
