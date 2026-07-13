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

function saleCmd(overrides: Record<string, unknown> = {}) {
  return {
    commandId: "sale-cmd-adj-base",
    requestId: "sale-req-adj-base",
    draftId: "draft-sale-adj-base",
    draftVersion: 1,
    previewVersion: 1,
    previewHash: "sale-adj-base-hash",
    idempotencyKey: "sale-adj-base-idem",
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
          quantity: "2",
          unit: "pcs",
          rate: "60000.00",
          lineAmount: "120000.00",
        },
      ],
      subtotal: "120000.00",
      grandTotal: "120000.00",
      currency: "NPR",
      narration: "E2E bike sale for adjustment",
    },
    ...overrides,
  };
}

async function postBaseSale() {
  const result = await postSalesTransaction(saleCmd());
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
    companyId: E2E_SALES_COMPANY_ID,
    userId: E2E_SALES_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "orbix" as const,
    expectedAdjustmentVersion: 0,
    adjustment: {
      adjustmentType: "inventory_sales_return" as const,
      originalInvoiceId,
      transactionDate: "2026-07-12",
      settlementMethod: "cash_refund" as const,
      settlementAccountId: "acc-cash",
      destinationWarehouseId: "wh-main",
      reasonCode: "defective",
      narration: "E2E sales return",
      lines: [
        {
          originalSalesLineId: originalLineId,
          itemId: E2E_SALES_ITEM_ID,
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

describe("postSalesAdjustmentTransaction", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("full inventory return posts and leaves original immutable", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    expect(original).toBeTruthy();
    const originalJson = JSON.stringify(original);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-return-full",
        idempotencyKey: "adj-return-full-idem",
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.operation).toBe("post_sales_return");
    expect(result.payload.original_invoice_id).toBe(original!.id);

    const ret = await db.invoices.get(result.payload.invoice_id);
    expect(ret?.type).toBe("sales-return");
    expect((ret as { originalInvoiceId?: string })?.originalInvoiceId).toBe(original!.id);

    const afterOriginal = await db.invoices.get(original!.id);
    expect(JSON.stringify(afterOriginal)).toBe(originalJson);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    expect(movements.length).toBe(1);
    expect(Number(movements[0].qty)).toBeGreaterThan(0);

    const journal = await db.vouchers.get(result.payload.voucher_id);
    expect(journal?.status).toBe("posted");

    const cogsRev = await db.vouchers.get(`jnl-cogs-rev-${result.payload.invoice_id}`);
    expect(cogsRev).toBeTruthy();

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(eventQueue.length).toBe(1);
    expect((eventQueue[0].envelope as { eventType?: string })?.eventType).toBe(
      "sales_return_posted",
    );

    const state = await db.salesInvoiceAdjustmentState.get(original!.id);
    expect(state?.adjustmentVersion).toBe(1);
  });

  it("rejects over-return quantity", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-over",
        idempotencyKey: "adj-over-idem",
        adjustment: {
          lines: [
            {
              originalSalesLineId: lineId,
              itemId: E2E_SALES_ITEM_ID,
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

  it("financial credit note posts without stock movement", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const result = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-cn",
        idempotencyKey: "adj-cn-idem",
        adjustment: {
          adjustmentType: "financial_credit_note",
          settlementMethod: "reduce_receivable",
          reasonCode: "pricing_error",
          narration: "E2E credit note",
          lines: [
            {
              originalSalesLineId: lineId,
              itemId: E2E_SALES_ITEM_ID,
              financialAdjustment: "10000.00",
            },
          ],
        },
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.operation).toBe("post_sales_credit_note");
    const cn = await db.invoices.get(result.payload.invoice_id);
    expect(cn?.type).toBe("credit-note");
    expect(cn?.invoiceNo?.startsWith("CN-")).toBe(true);

    const movements = await db.stockMovements
      .where("referenceId")
      .equals(result.payload.invoice_id)
      .toArray();
    expect(movements.length).toBe(0);
    expect(result.payload.stock_movement_ids).toEqual([]);
    expect(Number(result.payload.cogs_reversal)).toBe(0);

    const cogsRev = await db.vouchers.get(`jnl-cogs-rev-${result.payload.invoice_id}`);
    expect(cogsRev).toBeFalsy();

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect((eventQueue[0].envelope as { eventType?: string })?.eventType).toBe(
      "sales_credit_note_posted",
    );
  });

  it("idempotent replay returns same adjustment invoice", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;
    const cmd = adjCmd(original!.id, lineId, {
      requestId: "adj-idem",
      idempotencyKey: "adj-idem-key",
    });

    const first = await postSalesAdjustmentTransaction(cmd);
    const second = await postSalesAdjustmentTransaction({
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

    const returns = (await db.invoices.toArray()).filter((i) => i.type === "sales-return");
    expect(returns.length).toBe(1);
  });

  it("preserves historical tax_rule_version from original sale", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    expect(original).toBeTruthy();
    const originalTaxVersion =
      (original as { taxRuleVersion?: string }).taxRuleVersion ||
      (original!.lines?.[0] as { taxRuleVersion?: string } | undefined)?.taxRuleVersion;
    expect(originalTaxVersion).toBeTruthy();

    const lineId = original!.lines[0].id || `line-${original!.id}-0`;
    const result = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-tax-hist",
        idempotencyKey: "adj-tax-hist-idem",
      }),
    );
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    expect(result.payload.tax_rule_version).toBe(originalTaxVersion);
    const ret = await db.invoices.get(result.payload.invoice_id);
    expect((ret as { taxRuleVersion?: string })?.taxRuleVersion).toBe(originalTaxVersion);
  });

  it("rejects stale expectedAdjustmentVersion (concurrent conflict)", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const first = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-ver-1",
        idempotencyKey: "adj-ver-1-idem",
        expectedAdjustmentVersion: 0,
        adjustment: {
          lines: [
            {
              originalSalesLineId: lineId,
              itemId: E2E_SALES_ITEM_ID,
              returnQuantity: 1,
            },
          ],
        },
      }),
    );
    expect(first.type).toBe("posting_completed");

    const stale = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-ver-stale",
        idempotencyKey: "adj-ver-stale-idem",
        expectedAdjustmentVersion: 0,
        adjustment: {
          lines: [
            {
              originalSalesLineId: lineId,
              itemId: E2E_SALES_ITEM_ID,
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

  it("clean inventory return and credit note pass sales reconciliation", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const ret = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-recon-ret",
        idempotencyKey: "adj-recon-ret-idem",
      }),
    );
    expect(ret.type).toBe("posting_completed");
    if (ret.type !== "posting_completed") return;

    const cnSale = await postSalesTransaction(
      saleCmd({
        commandId: "sale-cmd-recon-cn",
        requestId: "sale-recon-cn-base",
        draftId: "draft-sale-recon-cn",
        previewHash: "sale-recon-cn-hash",
        idempotencyKey: "sale-recon-cn-base-idem",
      }),
    );
    expect(cnSale.type).toBe("posting_completed");
    if (cnSale.type !== "posting_completed") return;

    const cnOriginal = await db.invoices.get(cnSale.payload.invoice_id);
    const cnLineId = cnOriginal!.lines[0].id || `line-${cnOriginal!.id}-0`;
    const cn = await postSalesAdjustmentTransaction(
      adjCmd(cnOriginal!.id, cnLineId, {
        requestId: "adj-recon-cn",
        idempotencyKey: "adj-recon-cn-idem",
        adjustment: {
          adjustmentType: "financial_credit_note",
          settlementMethod: "reduce_receivable",
          reasonCode: "pricing_error",
          narration: "Recon CN",
          lines: [
            {
              originalSalesLineId: cnLineId,
              itemId: E2E_SALES_ITEM_ID,
              financialAdjustment: "10000.00",
            },
          ],
        },
      }),
    );
    expect(cn.type).toBe("posting_completed");
    if (cn.type !== "posting_completed") return;

    const { runSalesReconciliation } = await import("@/platform/sync/reconciliation");
    const report = await runSalesReconciliation(E2E_SALES_COMPANY_ID);
    const material = report.findings.filter(
      (f) =>
        f.severity === "error" &&
        (f.invoiceId === ret.payload.invoice_id ||
          f.invoiceId === cn.payload.invoice_id ||
          f.invoiceId === original!.id ||
          f.invoiceId === cnOriginal!.id ||
          f.entityId === original!.id ||
          f.entityId === cnOriginal!.id),
    );
    expect(material).toEqual([]);
  });

  it("reconciliation detects deliberate financial CN stock mismatch", async () => {
    const db = getDB();
    const sale = await postBaseSale();
    const original = await db.invoices.get(sale.payload.invoice_id);
    const lineId = original!.lines[0].id || `line-${original!.id}-0`;

    const cn = await postSalesAdjustmentTransaction(
      adjCmd(original!.id, lineId, {
        requestId: "adj-recon-bad-cn",
        idempotencyKey: "adj-recon-bad-cn-idem",
        adjustment: {
          adjustmentType: "financial_credit_note",
          settlementMethod: "reduce_receivable",
          reasonCode: "pricing_error",
          narration: "Deliberate mismatch CN",
          lines: [
            {
              originalSalesLineId: lineId,
              itemId: E2E_SALES_ITEM_ID,
              financialAdjustment: "5000.00",
            },
          ],
        },
      }),
    );
    expect(cn.type).toBe("posting_completed");
    if (cn.type !== "posting_completed") return;

    await db.stockMovements.add({
      id: `sm-bad-cn-${cn.payload.invoice_id}`,
      itemId: E2E_SALES_ITEM_ID,
      warehouseId: "wh-main",
      date: new Date().toISOString().slice(0, 10),
      type: "in",
      qty: 1,
      rate: 50000,
      amount: 50000,
      referenceType: "invoice",
      referenceId: cn.payload.invoice_id,
      createdAt: new Date().toISOString(),
    } as any);

    const { runSalesReconciliation } = await import("@/platform/sync/reconciliation");
    const report = await runSalesReconciliation(E2E_SALES_COMPANY_ID);
    const hit = report.findings.find(
      (f) =>
        f.code === "financial_credit_note_with_unexpected_stock" &&
        f.invoiceId === cn.payload.invoice_id,
    );
    expect(hit).toBeTruthy();
  });
});
