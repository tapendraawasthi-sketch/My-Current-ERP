import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postSalesTransaction,
  postSalesAdjustmentTransaction,
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
  // VAT-registered so historical vat_reversal is non-zero in the return envelope
  await db.companySettings.update("main", {
    vatRegistered: true,
    vatNumber: "605012345",
  } as any);
  await db.items.update(E2E_SALES_ITEM_ID, {
    isTaxable: true,
    vatRate: 13,
  } as any);
  return getDB();
}

describe("sales return remote apply — no recalculation", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("Device B applies event VAT/cost even when local item cost and tax settings differ", async () => {
    const db = getDB();

    const sale = await postSalesTransaction({
      commandId: "sale-ret-remote-a",
      requestId: "sale-ret-remote-req",
      draftId: "draft-ret-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-ret-remote",
      idempotencyKey: "sale-ret-remote-idem",
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
            quantity: "2",
            unit: "pcs",
            rate: "60000.00",
            lineAmount: "120000.00",
          },
        ],
        subtotal: "120000.00",
        grandTotal: "120000.00",
        currency: "NPR",
        narration: "E2E return remote cost/VAT proof sale",
      },
    });
    expect(sale.type).toBe("posting_completed");
    if (sale.type !== "posting_completed") return;

    const original = await db.invoices.get(sale.payload.invoice_id);
    expect(original).toBeTruthy();
    expect(Number(original!.vatAmount)).toBeGreaterThan(0);
    const originalLineId = original!.lines[0].id || `line-${original!.id}-0`;
    const historicalUnitCost = Number(
      (original!.lines[0] as { unitCost?: number }).unitCost ?? 50000,
    );
    const historicalLineVat = Number(original!.lines[0].vatAmount ?? 0);

    const adj = await postSalesAdjustmentTransaction({
      commandId: "adj-ret-remote-a",
      requestId: "adj-ret-remote-req",
      draftId: "draft-adj-ret-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-adj-ret-remote",
      idempotencyKey: "adj-ret-remote-idem",
      companyId: E2E_SALES_COMPANY_ID,
      userId: E2E_SALES_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      expectedAdjustmentVersion: 0,
      adjustment: {
        adjustmentType: "inventory_sales_return",
        originalInvoiceId: original!.id,
        transactionDate: "2026-07-12",
        settlementMethod: "cash_refund",
        settlementAccountId: "acc-cash",
        destinationWarehouseId: "wh-main",
        reasonCode: "defective",
        narration: "E2E partial return for remote apply",
        lines: [
          {
            originalSalesLineId: originalLineId,
            itemId: E2E_SALES_ITEM_ID,
            returnQuantity: 1,
            stockCondition: "resalable",
          },
        ],
        currency: "NPR",
      },
    });
    expect(adj.type).toBe("posting_completed");
    if (adj.type !== "posting_completed") return;

    expect(adj.payload.operation).toBe("post_sales_return");
    const expectedVat = Number(adj.payload.vat_reversal);
    const expectedCost = Number(adj.payload.cogs_reversal);
    expect(expectedVat).toBeGreaterThan(0);
    expect(expectedCost).toBe(historicalUnitCost);
    // Partial return of 1 of 2 → half of original line VAT
    expect(expectedVat).toBe(historicalLineVat / 2);

    const queue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === adj.payload.sync_event_id)
      .toArray();
    expect(queue.length).toBe(1);
    expect((queue[0].envelope as { eventType?: string })?.eventType).toBe(
      "sales_return_posted",
    );
    const envelope = queue[0].envelope as {
      eventId: string;
      timestamp: string;
      hash: string;
      aggregateVersion?: number;
      payload: Record<string, unknown>;
    };

    const returnInvoiceId = adj.payload.invoice_id;
    const returnBefore = await db.invoices.get(returnInvoiceId);
    expect((returnBefore as { originalInvoiceId?: string })?.originalInvoiceId).toBe(
      original!.id,
    );

    // Simulate Device B: keep original sale, strip return artifacts, diverge masters
    await db.invoices.delete(returnInvoiceId);
    await db.vouchers.delete(`jnl-${returnInvoiceId}`);
    await db.vouchers.delete(adj.payload.voucher_id);
    await db.vouchers.delete(`jnl-cogs-rev-${returnInvoiceId}`);
    await db.stockMovements.where("referenceId").equals(returnInvoiceId).delete();
    if (db.salesInvoiceAdjustmentState) {
      await db.salesInvoiceAdjustmentState.delete(original!.id);
    }
    await db.eventSyncQueue.clear();
    if (db.domainEvents) {
      await db.domainEvents.clear();
    }

    await db.items.update(E2E_SALES_ITEM_ID, {
      costPrice: 99999,
      vatRate: 99,
      isTaxable: false,
    } as any);
    await db.companySettings.update("main", {
      vatRegistered: false,
      vatNumber: "",
    } as any);

    const payload = {
      ...envelope.payload,
      device_id: "device-b-return-isolated",
    };

    const applied = await applyRemoteSyncEnvelope({
      eventId: envelope.eventId,
      eventType: "sales_return_posted",
      aggregateType: "sale",
      aggregateId: returnInvoiceId,
      aggregateVersion: envelope.aggregateVersion ?? 1,
      tenantId: "local",
      principalId: "remote",
      timestamp: envelope.timestamp || new Date().toISOString(),
      hash: envelope.hash,
      payload,
      correlationId: envelope.eventId,
      signature: "",
      deviceId: "device-b-return-isolated",
      companyId: E2E_SALES_COMPANY_ID,
      globalSequence: 1,
      remoteSequence: 1,
    } as any);

    expect(applied.status).toBe("applied");

    const ret = await db.invoices.get(returnInvoiceId);
    expect(ret).toBeTruthy();
    expect(ret!.type).toBe("sales-return");
    expect((ret as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);
    expect(Number(ret!.vatAmount)).toBe(expectedVat);
    expect(Number(ret!.lines[0].vatAmount)).toBe(expectedVat);
    expect(Number((ret!.lines[0] as { unitCost?: number }).unitCost)).toBe(historicalUnitCost);
    expect(Number((ret!.lines[0] as { costAmount?: number }).costAmount)).toBe(expectedCost);

    const cogsRev = await db.vouchers.get(`jnl-cogs-rev-${returnInvoiceId}`);
    expect(cogsRev).toBeTruthy();
    expect(Number((cogsRev as { totalDebit?: number }).totalDebit)).toBe(expectedCost);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(returnInvoiceId)
      .toArray();
    expect(movements.length).toBe(1);
    expect(Number(movements[0].qty)).toBeGreaterThan(0);
    expect(Number(movements[0].rate)).toBe(historicalUnitCost);
    expect(Number(movements[0].amount)).toBe(expectedCost);

    // Local masters unchanged — prove no recalculation from current cost/tax
    const item = await db.items.get(E2E_SALES_ITEM_ID);
    expect(Number((item as { costPrice?: number }).costPrice)).toBe(99999);
    expect(Number((item as { vatRate?: number }).vatRate)).toBe(99);

    // No outbound sales_return_posted loop (remote_sync origin only)
    const outboundLoop = await db.eventSyncQueue
      .filter((r: { origin?: string; envelope?: { eventType?: string }; status?: string }) => {
        const et = (r.envelope as { eventType?: string } | undefined)?.eventType;
        return (
          et === "sales_return_posted" &&
          r.origin !== "remote_sync" &&
          r.status !== "synced"
        );
      })
      .toArray();
    expect(outboundLoop.length).toBe(0);

    const appliedMarker = await db.eventSyncQueue.get(`applied:${envelope.eventId}`);
    expect(appliedMarker).toBeTruthy();
    expect((appliedMarker as { origin?: string }).origin).toBe("remote_sync");
    expect((appliedMarker as { status?: string }).status).toBe("synced");
  });

  it("Device B credit note apply preserves originalInvoiceId and skips stock/COGS", async () => {
    const db = getDB();

    const sale = await postSalesTransaction({
      commandId: "sale-cn-remote-a",
      requestId: "sale-cn-remote-req",
      draftId: "draft-cn-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-cn-remote",
      idempotencyKey: "sale-cn-remote-idem",
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
        narration: "E2E credit note remote apply sale",
      },
    });
    expect(sale.type).toBe("posting_completed");
    if (sale.type !== "posting_completed") return;

    const original = await db.invoices.get(sale.payload.invoice_id);
    const originalLineId = original!.lines[0].id || `line-${original!.id}-0`;

    const adj = await postSalesAdjustmentTransaction({
      commandId: "adj-cn-remote-a",
      requestId: "adj-cn-remote-req",
      draftId: "draft-adj-cn-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-adj-cn-remote",
      idempotencyKey: "adj-cn-remote-idem",
      companyId: E2E_SALES_COMPANY_ID,
      userId: E2E_SALES_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      expectedAdjustmentVersion: 0,
      adjustment: {
        adjustmentType: "financial_credit_note",
        originalInvoiceId: original!.id,
        transactionDate: "2026-07-12",
        settlementMethod: "cash_refund",
        settlementAccountId: "acc-cash",
        reasonCode: "pricing_error",
        narration: "E2E credit note for remote apply",
        lines: [
          {
            originalSalesLineId: originalLineId,
            itemId: E2E_SALES_ITEM_ID,
            financialAdjustment: "1130.00",
          },
        ],
        currency: "NPR",
      },
    });
    expect(adj.type).toBe("posting_completed");
    if (adj.type !== "posting_completed") return;

    const queue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === adj.payload.sync_event_id)
      .toArray();
    const envelope = queue[0].envelope as {
      eventId: string;
      timestamp: string;
      hash: string;
      aggregateVersion?: number;
      payload: Record<string, unknown>;
    };
    const cnId = adj.payload.invoice_id;
    const expectedVat = Number(adj.payload.vat_reversal);

    await db.invoices.delete(cnId);
    await db.vouchers.delete(adj.payload.voucher_id);
    await db.vouchers.delete(`jnl-${cnId}`);
    await db.eventSyncQueue.clear();

    await db.items.update(E2E_SALES_ITEM_ID, { costPrice: 88888, vatRate: 1 } as any);

    const applied = await applyRemoteSyncEnvelope({
      eventId: envelope.eventId,
      eventType: "sales_credit_note_posted",
      aggregateType: "sale",
      aggregateId: cnId,
      aggregateVersion: envelope.aggregateVersion ?? 1,
      tenantId: "local",
      principalId: "remote",
      timestamp: envelope.timestamp || new Date().toISOString(),
      hash: envelope.hash,
      payload: { ...envelope.payload, device_id: "device-b-cn-isolated" },
      correlationId: envelope.eventId,
      signature: "",
      deviceId: "device-b-cn-isolated",
      companyId: E2E_SALES_COMPANY_ID,
      globalSequence: 2,
      remoteSequence: 2,
    } as any);

    expect(applied.status).toBe("applied");

    const cn = await db.invoices.get(cnId);
    expect(cn?.type).toBe("credit-note");
    expect((cn as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);
    expect(Number(cn!.vatAmount)).toBe(expectedVat);

    const movements = await db.stockMovements.where("referenceId").equals(cnId).toArray();
    expect(movements.length).toBe(0);
    expect(await db.vouchers.get(`jnl-cogs-rev-${cnId}`)).toBeFalsy();

    const outbound = await db.eventSyncQueue
      .filter(
        (r: { origin?: string; envelope?: { eventType?: string }; status?: string }) =>
          (r.envelope as { eventType?: string } | undefined)?.eventType ===
            "sales_credit_note_posted" &&
          r.origin !== "remote_sync" &&
          r.status !== "synced",
      )
      .toArray();
    expect(outbound.length).toBe(0);
  });
});
