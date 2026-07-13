import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postPurchaseTransaction,
  postPurchaseAdjustmentTransaction,
  seedOrbixE2ECompany,
  E2E_COMPANY_ID,
  E2E_ITEM_ID,
  E2E_USER_AUTHORIZED,
} from "@/domains/purchase";
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
  await seedOrbixE2ECompany();
  await db.fiscalYears.put({
    id: "fy-e2e-purchase-aligned",
    name: "E2E purchase aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  // Perpetual so the return emits an inventory removal journal with cost facts
  await db.companySettings.update("main", {
    inventoryAccountingMode: "perpetual",
    stockValuationMethod: "moving_weighted_average",
    inventoryAccountId: "acc-inventory",
    cogsAccountId: "acc-cogs",
  } as any);
  return getDB();
}

function purchaseCmd() {
  return {
    commandId: "purch-ret-remote-a",
    requestId: "purch-ret-remote-req",
    draftId: "draft-ret-remote",
    draftVersion: 1,
    previewVersion: 1,
    previewHash: "hash-ret-remote",
    idempotencyKey: "purch-ret-remote-idem",
    companyId: E2E_COMPANY_ID,
    userId: E2E_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "orbix" as const,
    purchase: {
      transactionDate: "2026-07-12",
      supplierId: "party-e2e-supplier",
      supplierName: "E2E Supplier",
      paymentMethod: "credit" as const,
      items: [
        {
          itemId: E2E_ITEM_ID,
          quantity: "2",
          unit: "pcs",
          rate: "60000.00",
          amount: "120000.00",
        },
      ],
      subtotal: "120000.00",
      grandTotal: "120000.00",
      currency: "NPR",
      narration: "E2E return remote cost proof purchase",
    },
  };
}

describe("purchase return remote apply — no recalculation", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("Device B applies event cost even when local item cost differs", async () => {
    const db = getDB();

    const purchase = await postPurchaseTransaction(purchaseCmd());
    expect(purchase.type).toBe("posting_completed");
    if (purchase.type !== "posting_completed") return;

    const original = await db.invoices.get(purchase.payload.invoice_id);
    expect(original).toBeTruthy();
    const originalLineId = original!.lines[0].id || `line-${original!.id}-0`;
    const historicalUnitCost = 60000;

    const adj = await postPurchaseAdjustmentTransaction({
      commandId: "adj-ret-remote-a",
      requestId: "adj-ret-remote-req",
      draftId: "draft-adj-ret-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-adj-ret-remote",
      idempotencyKey: "adj-ret-remote-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      expectedAdjustmentVersion: 0,
      adjustment: {
        adjustmentType: "inventory_purchase_return",
        originalInvoiceId: original!.id,
        transactionDate: "2026-07-12",
        settlementMethod: "reduce_payable",
        settlementAccountId: "acc-sundry-creditors",
        destinationWarehouseId: "wh-main",
        reasonCode: "defective",
        narration: "E2E partial purchase return for remote apply",
        lines: [
          {
            originalPurchaseLineId: originalLineId,
            itemId: E2E_ITEM_ID,
            returnQuantity: 1,
            stockCondition: "resalable",
          },
        ],
        currency: "NPR",
      },
    });
    expect(adj.type).toBe("posting_completed");
    if (adj.type !== "posting_completed") return;

    expect(adj.payload.operation).toBe("post_purchase_return");
    const expectedCost = Number(adj.payload.cost_reversal);
    expect(expectedCost).toBe(historicalUnitCost);

    const queue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === adj.payload.sync_event_id)
      .toArray();
    expect(queue.length).toBe(1);
    expect((queue[0].envelope as { eventType?: string })?.eventType).toBe(
      "purchase_return_posted",
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

    // Simulate Device B: keep original purchase, strip return artifacts, diverge masters
    await db.invoices.delete(returnInvoiceId);
    await db.vouchers.delete(`jnl-${returnInvoiceId}`);
    await db.vouchers.delete(adj.payload.voucher_id);
    await db.vouchers.delete(`jnl-inv-rev-${returnInvoiceId}`);
    await db.stockMovements.where("referenceId").equals(returnInvoiceId).delete();
    if (db.purchaseInvoiceAdjustmentState) {
      await db.purchaseInvoiceAdjustmentState.delete(original!.id);
    }
    await db.eventSyncQueue.clear();
    if (db.domainEvents) {
      await db.domainEvents.clear();
    }

    await db.items.update(E2E_ITEM_ID, { costPrice: 99999 } as any);

    const payload = {
      ...envelope.payload,
      device_id: "device-b-purchase-return-isolated",
    };

    const applied = await applyRemoteSyncEnvelope({
      eventId: envelope.eventId,
      eventType: "purchase_return_posted",
      aggregateType: "purchase",
      aggregateId: returnInvoiceId,
      aggregateVersion: envelope.aggregateVersion ?? 1,
      tenantId: "local",
      principalId: "remote",
      timestamp: envelope.timestamp || new Date().toISOString(),
      hash: envelope.hash,
      payload,
      correlationId: envelope.eventId,
      signature: "",
      deviceId: "device-b-purchase-return-isolated",
      companyId: E2E_COMPANY_ID,
      globalSequence: 1,
      remoteSequence: 1,
    } as any);

    expect(applied.status).toBe("applied");

    const ret = await db.invoices.get(returnInvoiceId);
    expect(ret).toBeTruthy();
    expect(ret!.type).toBe("purchase-return");
    expect((ret as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);
    expect(Number((ret!.lines[0] as { unitCost?: number }).unitCost)).toBe(historicalUnitCost);
    expect(Number((ret!.lines[0] as { costAmount?: number }).costAmount)).toBe(expectedCost);
    expect((ret!.lines[0] as { originalPurchaseLineId?: string }).originalPurchaseLineId).toBe(
      originalLineId,
    );

    const invRev = await db.vouchers.get(`jnl-inv-rev-${returnInvoiceId}`);
    expect(invRev).toBeTruthy();
    expect(Number((invRev as { totalDebit?: number }).totalDebit)).toBe(expectedCost);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(returnInvoiceId)
      .toArray();
    expect(movements.length).toBe(1);
    // Purchase return removes stock
    expect(Number(movements[0].qty)).toBeLessThan(0);
    expect(Number(movements[0].rate)).toBe(historicalUnitCost);
    expect(Number(movements[0].amount)).toBe(expectedCost);

    // Local masters unchanged — prove no recalculation from current cost
    const item = await db.items.get(E2E_ITEM_ID);
    expect(Number((item as { costPrice?: number }).costPrice)).toBe(99999);

    // No outbound purchase_return_posted loop (remote_sync origin only)
    const outboundLoop = await db.eventSyncQueue
      .filter((r: { origin?: string; envelope?: { eventType?: string }; status?: string }) => {
        const et = (r.envelope as { eventType?: string } | undefined)?.eventType;
        return (
          et === "purchase_return_posted" &&
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

  it("Device B debit note apply preserves originalInvoiceId and skips stock", async () => {
    const db = getDB();

    const purchase = await postPurchaseTransaction(purchaseCmd());
    expect(purchase.type).toBe("posting_completed");
    if (purchase.type !== "posting_completed") return;

    const original = await db.invoices.get(purchase.payload.invoice_id);
    const originalLineId = original!.lines[0].id || `line-${original!.id}-0`;

    const adj = await postPurchaseAdjustmentTransaction({
      commandId: "adj-dn-remote-a",
      requestId: "adj-dn-remote-req",
      draftId: "draft-adj-dn-remote",
      draftVersion: 1,
      previewVersion: 1,
      previewHash: "hash-adj-dn-remote",
      idempotencyKey: "adj-dn-remote-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "orbix",
      expectedAdjustmentVersion: 0,
      adjustment: {
        adjustmentType: "financial_supplier_debit_note",
        originalInvoiceId: original!.id,
        transactionDate: "2026-07-12",
        settlementMethod: "reduce_payable",
        settlementAccountId: "acc-sundry-creditors",
        reasonCode: "pricing_error",
        narration: "E2E debit note for remote apply",
        lines: [
          {
            originalPurchaseLineId: originalLineId,
            itemId: E2E_ITEM_ID,
            financialAdjustment: "10000.00",
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
    const dnId = adj.payload.invoice_id;

    await db.invoices.delete(dnId);
    await db.vouchers.delete(adj.payload.voucher_id);
    await db.vouchers.delete(`jnl-${dnId}`);
    await db.eventSyncQueue.clear();

    await db.items.update(E2E_ITEM_ID, { costPrice: 88888 } as any);

    const applied = await applyRemoteSyncEnvelope({
      eventId: envelope.eventId,
      eventType: "supplier_debit_note_posted",
      aggregateType: "purchase",
      aggregateId: dnId,
      aggregateVersion: envelope.aggregateVersion ?? 1,
      tenantId: "local",
      principalId: "remote",
      timestamp: envelope.timestamp || new Date().toISOString(),
      hash: envelope.hash,
      payload: { ...envelope.payload, device_id: "device-b-dn-isolated" },
      correlationId: envelope.eventId,
      signature: "",
      deviceId: "device-b-dn-isolated",
      companyId: E2E_COMPANY_ID,
      globalSequence: 2,
      remoteSequence: 2,
    } as any);

    expect(applied.status).toBe("applied");

    const dn = await db.invoices.get(dnId);
    expect(dn?.type).toBe("debit-note");
    expect((dn as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);

    const movements = await db.stockMovements.where("referenceId").equals(dnId).toArray();
    expect(movements.length).toBe(0);
    expect(await db.vouchers.get(`jnl-inv-rev-${dnId}`)).toBeFalsy();

    const outbound = await db.eventSyncQueue
      .filter(
        (r: { origin?: string; envelope?: { eventType?: string }; status?: string }) =>
          (r.envelope as { eventType?: string } | undefined)?.eventType ===
            "supplier_debit_note_posted" &&
          r.origin !== "remote_sync" &&
          r.status !== "synced",
      )
      .toArray();
    expect(outbound.length).toBe(0);
  });
});
