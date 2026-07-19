import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  postPurchaseTransaction,
  seedOrbixE2ECompany,
  E2E_COMPANY_ID,
  E2E_ITEM_ID,
  E2E_USER_AUTHORIZED,
} from "@/domains/purchase";
import {
  postSalesTransaction,
  seedOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_ITEM_ID,
  E2E_SALES_USER_AUTHORIZED,
} from "@/domains/sales";
import {
  DUAL_SILENT_WRITERS_FORBIDDEN,
  E2E_LAUNCH_SLICE_ADR,
  LAUNCH_SLICE_EVENT_IDS,
  NL_ASSENT_POSTS,
  PRODUCT_CONFIRM_PATH,
  QUEUED_MUST_NOT_LABEL_SYNCED,
  e2eLaunchSliceHonestySnapshot,
  mayLabelSynced,
} from "@/platform/launch/e2eLaunchSlicePolicy";
import {
  getPresentationMeta,
  mayShowConfirmControl,
  syncStatusPresentation,
} from "@/features/orbix/presentation";
import { postingSuccessHasReceipt } from "@/lib/ekhata/confirmPathAuthority";
import type { OrbixResponse } from "@/lib/ekhata/orbixResponseTypes";

async function preparePurchaseDb() {
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
    id: "fy-e2e-aligned",
    name: "E2E aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

async function prepareSalesDb() {
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

describe("NEXT-12 E2E launch slice honesty", () => {
  it("declares three frozen events and Model B confirm path", () => {
    const snap = e2eLaunchSliceHonestySnapshot();
    expect(snap.authority).toBe(E2E_LAUNCH_SLICE_ADR);
    expect(snap.productConfirmPath).toBe(PRODUCT_CONFIRM_PATH);
    expect(snap.dualSilentWritersForbidden).toBe(true);
    expect(DUAL_SILENT_WRITERS_FORBIDDEN).toBe(true);
    expect(snap.nlAssentPosts).toBe(false);
    expect(NL_ASSENT_POSTS).toBe(false);
    expect(snap.queuedMustNotLabelSynced).toBe(true);
    expect(QUEUED_MUST_NOT_LABEL_SYNCED).toBe(true);
    expect(snap.productionApproved).toBe(false);
    expect(snap.settlementInSlice).toBe(false);
    expect([...snap.launchEventIds].sort()).toEqual([...LAUNCH_SLICE_EVENT_IDS].sort());
  });

  it("never labels pending as synced", () => {
    expect(mayLabelSynced("pending")).toBe(false);
    expect(mayLabelSynced("syncing")).toBe(false);
    expect(mayLabelSynced(undefined)).toBe(false);
    expect(mayLabelSynced("synced")).toBe(true);
    expect(syncStatusPresentation("pending").testId).toBe("pending");
    expect(syncStatusPresentation("pending").label.toLowerCase()).not.toBe("synced");
  });

  it("Ask report path has no confirm / mutation affordance", () => {
    const report = {
      response_type: "report_result",
      payload: { report_type: "balance_sheet" },
    } as OrbixResponse;
    const meta = getPresentationMeta(report);
    expect(meta.allowsConfirm).toBe(false);
    expect(meta.allowsMutation).toBe(false);
    expect(mayShowConfirmControl(meta, "ask")).toBe(false);
    expect(mayShowConfirmControl(meta, "accountant")).toBe(false);
  });

  it("requires receipt surfaces for posting success claims", () => {
    expect(
      postingSuccessHasReceipt({
        posting_id: "p1",
        voucher_number: "PI-1",
      }),
    ).toBe(true);
    expect(postingSuccessHasReceipt({ posting_id: "p1" })).toBe(false);
  });
});

describe("NEXT-12 purchase vertical — receipt + audit + sync honesty", () => {
  beforeEach(async () => {
    await preparePurchaseDb();
  });

  it("posts purchase with receipt, audit lineage, pending sync", async () => {
    const db = getDB();
    const result = await postPurchaseTransaction({
      commandId: "n12-purchase-1",
      requestId: "n12-req-purchase",
      draftId: "n12-draft-purchase",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "n12-hash-purchase",
      idempotencyKey: "n12-idem-purchase",
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
        narration: "NEXT-12 mixed purchase vertical",
      },
    } as any);

    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }

    const payload = result.payload;
    expect(payload.invoice_id).toBeTruthy();
    expect(payload.voucher_id).toBeTruthy();
    expect(payload.sync_status).toBe("pending");
    expect(mayLabelSynced(payload.sync_status)).toBe(false);
    expect(
      postingSuccessHasReceipt({
        posting_id: String(payload.posting_id || "n12-req-purchase"),
        voucher_number: String(payload.voucher_number || "x"),
      }),
    ).toBe(true);

    const audits = await db.auditLogs
      .filter((a) => a.entityId === payload.invoice_id)
      .toArray();
    expect(audits.length).toBeGreaterThanOrEqual(1);

    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === payload.sync_event_id)
      .toArray();
    expect(eventQueue.length).toBe(1);
    expect(syncStatusPresentation("pending").testId).toBe("pending");

    const receipt = await db.orbixPostingReceipts.get(payload.receipt_id!);
    expect(receipt?.status).toBe("completed");
  });
});

describe("NEXT-12 sales vertical — receipt lineage", () => {
  beforeEach(async () => {
    await prepareSalesDb();
  });

  it("posts sales with posting_completed and event-sync queue (not legacy outbox)", async () => {
    const db = getDB();
    const result = await postSalesTransaction({
      commandId: "n12-sales-1",
      requestId: "n12-req-sales",
      draftId: "n12-draft-sales",
      draftVersion: 2,
      previewVersion: 2,
      previewHash: "n12-hash-sales",
      idempotencyKey: "n12-idem-sales",
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
        narration: "NEXT-12 sales vertical",
      },
    } as any);

    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") {
      throw new Error(JSON.stringify(result));
    }
    expect(result.payload.invoice_id).toBeTruthy();
    const syncOutbox = await db.syncOutbox
      .filter((s) => s.entityId === result.payload.invoice_id)
      .toArray();
    expect(syncOutbox.length).toBe(0);
    const eventQueue = await db.eventSyncQueue
      .filter((r: { eventId?: string }) => r.eventId === result.payload.sync_event_id)
      .toArray();
    expect(eventQueue.length).toBe(1);
    expect(mayLabelSynced("pending")).toBe(false);
  });
});
