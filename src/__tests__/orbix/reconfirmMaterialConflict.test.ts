import "fake-indexeddb/auto";
import { describe, it, beforeEach, expect } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { reconfirmMaterialConflict } from "@/platform/sync/reconfirmMaterialConflict";

describe("reconfirmMaterialConflict", () => {
  beforeEach(async () => {
    await Dexie.delete("SutraERPDatabase");
    const db = await resetDB();
    await db.open();
  });

  it("abandons conflicting push without removing local invoice", async () => {
    const db = getDB();
    await db.invoices.put({
      id: "inv-local-b",
      invoiceNo: "PI-LAUNCH-CONFLICT-1",
      type: "purchase-invoice",
      date: "2026-07-12",
      status: "posted",
      grandTotal: 51000,
    } as never);
    await db.eventSyncQueue.put({
      id: "evt-b",
      eventId: "evt-b",
      globalSequence: 2,
      tenantId: "local",
      companyId: "orbix-e2e-company",
      status: "conflict",
      syncAttempts: 1,
      createdAt: new Date().toISOString(),
      lastError: "invoice_number_collision",
      lastErrorCode: "invoice_number_collision",
      origin: "local_user",
      envelope: {
        eventId: "evt-b",
        payload: { invoice_id: "inv-local-b", invoice_number: "PI-LAUNCH-CONFLICT-1" },
      },
    } as never);

    const result = await reconfirmMaterialConflict({
      queueRowId: "evt-b",
      choice: "abandon_conflicting_push",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("resolved");
      expect(result.localInvoiceId).toBe("inv-local-b");
    }

    const row = await db.eventSyncQueue.get("evt-b");
    expect((row as { status?: string })?.status).toBe("resolved");
    expect((row as { lastErrorCode?: string })?.lastErrorCode).toBe("operator_reconfirm_abandon");

    const inv = await db.invoices.get("inv-local-b");
    expect(inv).toBeTruthy();
    expect((inv as { invoiceNo?: string }).invoiceNo).toBe("PI-LAUNCH-CONFLICT-1");
  });

  it("rejects non-conflict rows", async () => {
    const db = getDB();
    await db.eventSyncQueue.put({
      id: "evt-pending",
      eventId: "evt-pending",
      globalSequence: 1,
      tenantId: "local",
      status: "pending",
      syncAttempts: 0,
      createdAt: new Date().toISOString(),
      origin: "local_user",
    } as never);
    const result = await reconfirmMaterialConflict({
      queueRowId: "evt-pending",
      choice: "abandon_conflicting_push",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("not_in_conflict");
  });
});
