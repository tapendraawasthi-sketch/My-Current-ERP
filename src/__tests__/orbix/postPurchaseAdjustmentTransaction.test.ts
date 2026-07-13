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
  // Perpetual so the inventory removal journal is emitted deterministically
  await db.companySettings.update("main", {
    inventoryAccountingMode: "perpetual",
    stockValuationMethod: "moving_weighted_average",
    inventoryAccountId: "acc-inventory",
    cogsAccountId: "acc-cogs",
  } as any);
  return getDB();
}

function purchaseCmd(overrides: Record<string, unknown> = {}) {
  return {
    commandId: "purch-cmd-adj-base",
    requestId: "purch-req-adj-base",
    draftId: "draft-purch-adj-base",
    draftVersion: 1,
    previewVersion: 1,
    previewHash: "purch-adj-base-hash",
    idempotencyKey: "purch-adj-base-idem",
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
      narration: "E2E bike purchase for adjustment",
    },
    ...overrides,
  };
}

async function postBasePurchase() {
  const result = await postPurchaseTransaction(purchaseCmd());
  if (result.type !== "posting_completed") {
    throw new Error(JSON.stringify(result));
  }
  return result;
}

function adjCmd(
  originalInvoiceId: string,
  originalLineId: string,
  overrides: Record<string, unknown> = {},
) {
  const adjustmentOverrides =
    (overrides.adjustment as Record<string, unknown> | undefined) || {};
  const { adjustment: _drop, ...rest } = overrides;
  return {
    commandId: "adj-cmd-1",
    requestId: "adj-req-1",
    draftId: "draft-adj-1",
    draftVersion: 1,
    previewVersion: 1,
    previewHash: "adj-hash-1",
    idempotencyKey: "adj-idem-1",
    companyId: E2E_COMPANY_ID,
    userId: E2E_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "orbix" as const,
    expectedAdjustmentVersion: 0,
    adjustment: {
      adjustmentType: "inventory_purchase_return" as const,
      originalInvoiceId,
      transactionDate: "2026-07-12",
      settlementMethod: "reduce_payable" as const,
      settlementAccountId: "acc-sundry-creditors",
      destinationWarehouseId: "wh-main",
      reasonCode: "defective",
      narration: "E2E purchase return",
      lines: [
        {
          originalPurchaseLineId: originalLineId,
          itemId: E2E_ITEM_ID,
          returnQuantity: 1,
          stockCondition: "resalable" as const,
        },
      ],
      currency: "NPR",
      ...adjustmentOverrides,
    },
    ...rest,
  };
}

describe("postPurchaseAdjustmentTransaction", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("full inventory return posts and leaves original immutable", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    expect(original).toBeTruthy();
    const originalJson = JSON.stringify(original);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-return-full",
        idempotencyKey: "adj-return-full-idem",
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.operation).toBe("post_purchase_return");
    expect(result.payload.original_invoice_id).toBe(original!.id);

    const ret = await db.invoices.get(result.payload.invoice_id);
    expect(ret?.type).toBe("purchase-return");
    expect((ret as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);
    expect(ret?.invoiceNo?.startsWith("PR-")).toBe(true);

    const afterOriginal = await db.invoices.get(original!.id);
    expect(JSON.stringify(afterOriginal)).toBe(originalJson);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    expect(movements.length).toBe(1);
    // Purchase return removes stock (goods sent back to supplier)
    expect(Number(movements[0].qty)).toBeLessThan(0);

    const journal = await db.vouchers.get(result.payload.voucher_id);
    expect(journal?.status).toBe("posted");

    const invRev = await db.vouchers.get(`jnl-inv-rev-${result.payload.invoice_id}`);
    expect(invRev).toBeTruthy();
    expect(Number((invRev as { totalDebit?: number }).totalDebit)).toBe(
      Number(result.payload.cost_reversal),
    );

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(eventQueue.length).toBe(1);
    expect((eventQueue[0].envelope as { eventType?: string })?.eventType).toBe(
      "purchase_return_posted",
    );

    const state = await db.purchaseInvoiceAdjustmentState.get(original!.id);
    expect(state?.adjustmentVersion).toBe(1);
  });

  it("rejects over-return quantity", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-over",
        idempotencyKey: "adj-over-idem",
        adjustment: {
          lines: [
            {
              originalPurchaseLineId: lineId,
              itemId: E2E_ITEM_ID,
              returnQuantity: 99,
            },
          ],
        },
      }),
    );
    expect(result.type).toBe("validation_error");
    if (result.status === "failed") {
      expect(result.payload.error_code).toBe("over_return_quantity");
    }
  });

  it("financial supplier debit note posts without stock movement", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-dn",
        idempotencyKey: "adj-dn-idem",
        adjustment: {
          adjustmentType: "financial_supplier_debit_note",
          settlementMethod: "reduce_payable",
          reasonCode: "pricing_error",
          narration: "E2E debit note",
          lines: [
            {
              originalPurchaseLineId: lineId,
              itemId: E2E_ITEM_ID,
              financialAdjustment: "10000.00",
            },
          ],
        },
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.operation).toBe("post_supplier_debit_note");
    const dn = await db.invoices.get(result.payload.invoice_id);
    expect(dn?.type).toBe("debit-note");
    expect(dn?.invoiceNo?.startsWith("DN-")).toBe(true);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    expect(movements.length).toBe(0);
    expect(result.payload.stock_movement_ids).toEqual([]);
    expect(Number(result.payload.cost_reversal)).toBe(0);

    const invRev = await db.vouchers.get(`jnl-inv-rev-${result.payload.invoice_id}`);
    expect(invRev).toBeFalsy();

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect((eventQueue[0].envelope as { eventType?: string })?.eventType).toBe(
      "supplier_debit_note_posted",
    );
  });

  it("idempotent replay returns same adjustment invoice", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;
    const cmd = adjCmd(original!.id, lineId, {
      requestId: "adj-idem",
      idempotencyKey: "adj-idem-key",
    });

    const first = await postPurchaseAdjustmentTransaction(cmd);
    const second = await postPurchaseAdjustmentTransaction({
      ...cmd,
      requestId: "adj-idem-2",
      commandId: "adj-cmd-2",
    });

    expect(first.type).toBe("posting_completed");
    expect(second.type).toBe("posting_completed");
    if (first.type === "posting_completed" && second.type === "posting_completed") {
      expect(second.payload.idempotent_replay).toBe(true);
      expect(second.payload.invoice_id).toBe(first.payload.invoice_id);
    }

    const returns = (await db.invoices.toArray()).filter((i) => i.type === "purchase-return");
    expect(returns.length).toBe(1);
  });

  it("preserves historical tax_rule_version from original purchase", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    expect(original).toBeTruthy();

    // Stamp a historical tax rule version on the posted purchase (immutable facts)
    const patchedLines = (original!.lines || []).map((l) => ({
      ...l,
      taxRuleVersion: "np-vat-2081",
    }));
    await db.invoices.update(original!.id, {
      taxRuleVersion: "np-vat-2081",
      lines: patchedLines,
    } as any);

    const lineId = original!.lines[0].id || `line-${original!.id}-0`;
    const result = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-tax-hist",
        idempotencyKey: "adj-tax-hist-idem",
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.tax_rule_version).toBe("np-vat-2081");
    const ret = await db.invoices.get(result.payload.invoice_id);
    expect((ret as { taxRuleVersion?: string })?.taxRuleVersion).toBe("np-vat-2081");
  });

  it("rejects stale expectedAdjustmentVersion (concurrent conflict)", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const first = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-ver-1",
        idempotencyKey: "adj-ver-1-idem",
        expectedAdjustmentVersion: 0,
        adjustment: {
          lines: [
            {
              originalPurchaseLineId: lineId,
              itemId: E2E_ITEM_ID,
              returnQuantity: 1,
            },
          ],
        },
      }),
    );
    expect(first.type).toBe("posting_completed");

    const stale = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-ver-stale",
        idempotencyKey: "adj-ver-stale-idem",
        expectedAdjustmentVersion: 0,
        adjustment: {
          lines: [
            {
              originalPurchaseLineId: lineId,
              itemId: E2E_ITEM_ID,
              returnQuantity: 1,
            },
          ],
        },
      }),
    );
    expect(stale.type).toBe("conflict");
    if (stale.status === "failed") {
      expect(stale.payload.error_code).toBe("stale_adjustment_version");
    }
  });

  it("clean purchase return and debit note pass local reconciliation", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const ret = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-recon-ret",
        idempotencyKey: "adj-recon-ret-idem",
      }),
    );
    expect(ret.type).toBe("posting_completed");
    if (ret.type !== "posting_completed") return;

    const dn = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-recon-dn",
        idempotencyKey: "adj-recon-dn-idem",
        expectedAdjustmentVersion: 1,
        adjustment: {
          adjustmentType: "financial_supplier_debit_note",
          settlementMethod: "reduce_payable",
          reasonCode: "pricing_error",
          narration: "Recon DN",
          lines: [
            {
              originalPurchaseLineId: lineId,
              itemId: E2E_ITEM_ID,
              financialAdjustment: "5000.00",
            },
          ],
        },
      }),
    );
    expect(dn.type).toBe("posting_completed");
    if (dn.type !== "posting_completed") return;

    const { runLocalReconciliation } = await import("@/platform/sync/reconciliation");
    const report = await runLocalReconciliation(E2E_COMPANY_ID);
    const errors = report.findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("reconciliation detects a purchase invoice with a missing journal", async () => {
    const db = getDB();
    const purchase = await postBasePurchase();
    const original = await db.invoices.get(purchase.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const ret = await postPurchaseAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-recon-bad",
        idempotencyKey: "adj-recon-bad-idem",
      }),
    );
    expect(ret.type).toBe("posting_completed");

    // Deliberately corrupt the original purchase journal link
    await db.vouchers.delete(`jnl-${original!.id}`);

    const { runLocalReconciliation } = await import("@/platform/sync/reconciliation");
    const report = await runLocalReconciliation(E2E_COMPANY_ID);
    const hit = report.findings.find(
      (f) => f.code === "unmatched_invoice_journal" && f.invoiceId === original!.id,
    );
    expect(hit).toBeTruthy();
  });
});
