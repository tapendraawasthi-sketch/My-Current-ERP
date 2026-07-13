import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postSalesTransaction,
  seedOrbixSalesE2ECompany,
  resetOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_ITEM_ID,
  E2E_SALES_CUSTOMER_ID,
  E2E_SALES_USER_AUTHORIZED,
  E2E_SALES_USER_RESTRICTED,
} from "@/domains/sales";

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
  await db.fiscalYears.put({
    id: "fy-e2e-sales-aligned",
    name: "E2E sales aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

function baseCmd(overrides: Record<string, unknown> = {}) {
  return {
    commandId: "sale-cmd-1",
    requestId: "sale-req-1",
    draftId: "draft-sale-bike-1",
    draftVersion: 2,
    previewVersion: 2,
    previewHash: "sale-hash-abc",
    idempotencyKey: "sale-idem-1",
    companyId: E2E_SALES_COMPANY_ID,
    userId: E2E_SALES_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "orbix" as const,
    sale: {
      transactionDate: "2026-07-12",
      paymentMethod: "cash" as const,
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
      narration: "E2E bike sale",
    },
    ...overrides,
  };
}

describe("postSalesTransaction", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("posts cash sale invoice, journal, stock-out, audit, event, receipt", async () => {
    const db = getDB();
    const result = await postSalesTransaction(baseCmd());
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    const invoice = await db.invoices.get(result.payload.invoice_id);
    const journal = await db.vouchers.get(result.payload.voucher_id);
    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    const sync = await db.syncOutbox
      .filter((s) => s.entityId === result.payload.invoice_id)
      .toArray();
    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();

    expect(invoice?.type).toBe("sales-invoice");
    expect(journal?.status).toBe("posted");
    expect(movements.length).toBe(1);
    expect(Number(movements[0].qty)).toBeLessThan(0);
    expect(sync.length).toBe(0);
    expect(eventQueue.length).toBe(1);
    expect((eventQueue[0].envelope as { eventType?: string })?.eventType).toBe("sales_posted");
    expect(result.payload.idempotent_replay).toBe(false);
  });

  it("posts credit sale with customer", async () => {
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-credit-1",
        idempotencyKey: "sale-credit-idem",
        sale: {
          ...(baseCmd().sale as object),
          paymentMethod: "credit",
          paymentAccountId: null,
          customerId: E2E_SALES_CUSTOMER_ID,
          customerName: "Ram Traders E2E",
        },
      }),
    );
    expect(result.type).toBe("posting_completed");
  });

  it("posts bank sale", async () => {
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-bank-1",
        idempotencyKey: "sale-bank-idem",
        sale: {
          ...(baseCmd().sale as object),
          paymentMethod: "bank",
          paymentAccountId: "acc-bank",
        },
      }),
    );
    expect(result.type).toBe("posting_completed");
  });

  it("rejects insufficient stock", async () => {
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-stock-1",
        idempotencyKey: "sale-stock-idem",
        sale: {
          ...(baseCmd().sale as object),
          items: [
            {
              itemId: E2E_SALES_ITEM_ID,
              quantity: "9999",
              unit: "pcs",
              rate: "60000.00",
              lineAmount: "599940000.00",
            },
          ],
          subtotal: "599940000.00",
          grandTotal: "599940000.00",
        },
      }),
    );
    expect(result.type).toBe("validation_error");
    if (result.status === "failed") {
      expect(result.payload.error_code).toBe("insufficient_stock");
    }
  });

  it("rejects credit without customer", async () => {
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-nocust",
        idempotencyKey: "sale-nocust-idem",
        sale: {
          ...(baseCmd().sale as object),
          paymentMethod: "credit",
          paymentAccountId: null,
          customerId: null,
          customerName: null,
        },
      }),
    );
    expect(result.type).toBe("validation_error");
  });

  it("rejects Ask Mode", async () => {
    const result = await postSalesTransaction(baseCmd({ orbixMode: "ask" }));
    expect(result.type).toBe("permission_denied");
  });

  it("rejects restricted role", async () => {
    const result = await postSalesTransaction(
      baseCmd({
        userId: E2E_SALES_USER_RESTRICTED,
        userRole: "viewer",
        requestId: "sale-perm",
        idempotencyKey: "sale-perm-idem",
      }),
    );
    expect(result.type).toBe("permission_denied");
  });

  it("idempotent replay returns same invoice", async () => {
    const first = await postSalesTransaction(baseCmd());
    const second = await postSalesTransaction(
      baseCmd({ requestId: "sale-req-2", commandId: "sale-cmd-2" }),
    );
    expect(first.type).toBe("posting_completed");
    expect(second.type).toBe("posting_completed");
    if (first.type === "posting_completed" && second.type === "posting_completed") {
      expect(second.payload.idempotent_replay).toBe(true);
      expect(second.payload.invoice_id).toBe(first.payload.invoice_id);
    }
  });

  it("rolls back on injected failure", async () => {
    const db = getDB();
    const beforeInv = (await db.invoices.toArray()).length;
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-fail",
        idempotencyKey: "sale-fail-idem",
        injectFailure: "before_stock",
      }),
    );
    expect(result.type).toBe("posting_failed");
    expect((await db.invoices.toArray()).length).toBe(beforeInv);
  });

  it("reset restores opening stock", async () => {
    await postSalesTransaction(baseCmd());
    await resetOrbixSalesE2ECompany();
    const db = getDB();
    const open = await db.stockMovements.get("e2e-sales-open-bike");
    expect(Number(open?.qty)).toBe(100);
  });

  it("perpetual cash sale creates COGS journal and cost allocation", async () => {
    const db = getDB();
    const result = await postSalesTransaction(
      baseCmd({
        requestId: "sale-cogs-1",
        idempotencyKey: "sale-cogs-idem",
        commandId: "sale-cogs-cmd",
      }),
    );
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;

    expect(result.payload.inventory_accounting).toBe("perpetual");
    expect(result.payload.valuation_method).toBe("moving_weighted_average");
    expect(Number(result.payload.cogs_amount)).toBe(50000);

    const cogs = await db.vouchers.get(`jnl-cogs-${result.payload.invoice_id}`);
    expect(cogs).toBeTruthy();
    expect(Number((cogs as { totalDebit?: number }).totalDebit)).toBe(50000);

    const allocs = await db.salesCostAllocations
      .where("invoice_id")
      .equals(result.payload.invoice_id)
      .toArray();
    expect(allocs.length).toBe(1);
    expect(Number(allocs[0].total_cost)).toBe(50000);

    const { runSalesReconciliation } = await import("@/platform/sync/reconciliation");
    const report = await runSalesReconciliation(E2E_SALES_COMPANY_ID);
    const material = report.findings.filter(
      (f) =>
        f.severity === "error" &&
        (f.invoiceId === result.payload.invoice_id || f.entityId === result.payload.invoice_id),
    );
    expect(material).toEqual([]);
  });
});
