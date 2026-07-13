/**
 * Phase 5 two-device Purchase sync + duplicate/lost-ack gates.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010  (isolated from Vite :3000)
 *   Backend: ORBIX_SYNC_TEST_MODE=true on that port
 *   VITE_ORBIX_SYNC_TEST_MODE=true
 *   VITE_API_URL=<same backend URL>
 *
 * Skips clearly when configuration is absent.
 * Aborts if backend is not in test mode or reset targets a non-E2E company.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const enabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);

const backend = (
  process.env.ORBIX_SYNC_BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3010"
).replace(/\/$/, "");

const E2E_COMPANY = "orbix-e2e-company";
const ARTIFACTS = path.resolve("artifacts/orbix-sync");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

async function assertBackendReady() {
  const health = await fetch(`${backend}/api/health`);
  expect(health.ok, `health failed for ${backend}`).toBeTruthy();

  const ready = await fetch(`${backend}/api/sync/ready`);
  expect(ready.ok, "sync/ready failed").toBeTruthy();
  const body = (await ready.json()) as { data?: Record<string, unknown>; success?: boolean };
  const data = body.data ?? (body as unknown as Record<string, unknown>);
  expect(data.api).toBe(true);
  expect(data.sync_push_ready).toBe(true);
  expect(data.sync_pull_ready).toBe(true);
  expect(data.test_mode).toBe(true);
  if (data.test_mode !== true) {
    throw new Error("Abort: sync backend is not in ORBIX_SYNC_TEST_MODE");
  }
  return data;
}

async function resetRemoteE2E() {
  if (!E2E_COMPANY.includes("e2e") && !E2E_COMPANY.startsWith("orbix-")) {
    throw new Error("Abort: refuse remote reset for non-E2E company");
  }
  const reset = await fetch(`${backend}/api/sync/events/e2e-reset`, {
    method: "POST",
    headers: {
      Authorization: "Bearer orbix-sync-e2e-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyId: E2E_COMPANY }),
  });
  expect(reset.ok, `e2e-reset failed: ${reset.status}`).toBeTruthy();
}

test.describe("Phase 5 two-device accounting sync", () => {
  test.skip(!enabled, "Set ORBIX_SYNC_E2E=true and ORBIX_SYNC_BACKEND_URL to run");
  test.describe.configure({ timeout: 240_000 });

  test("G1 readiness: health + sync/ready in test mode", async () => {
    const data = await assertBackendReady();
    expect(data.persistence_mode).toBeTruthy();
    expect(String(data.authentication_mode)).toMatch(/test|jwt/i);
  });

  test("Device A post/push → Device B pull/apply → Day Book + no loop", async ({
    browser,
  }) => {
    ensureArtifacts();
    await assertBackendReady();
    await resetRemoteE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-sync-device-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-sync-device-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeed();
    });
    await pageB.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeed();
      // Device B starts clean of purchase invoices after seed
    });

    // Device A: authoritative purchase post
    const posted = await pageA.evaluate(async () => {
      return window.__orbixE2E!.postE2EPurchase({
        quantity: "1",
        amount: "50000.00",
        idempotencyKey: `e2e-sync-a-${Date.now()}`,
      });
    });
    expect(posted.type || (posted as { status?: string }).status).toMatch(/posting_completed|success/);
    const payload = (posted.payload || posted) as {
      invoice_id?: string;
      voucher_id?: string;
      sync_status?: string;
      sync_event_id?: string;
      amount?: string;
    };
    expect(payload.invoice_id).toBeTruthy();
    expect(payload.sync_status).toBe("pending");
    expect(payload.sync_event_id).toBeTruthy();

    const snapA = await pageA.evaluate(async () => window.__orbixE2E!.getSnapshot());
    expect(
      (snapA.invoices as unknown[]).filter(
        (i: { type?: string }) => (i as { type?: string }).type === "purchase-invoice",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    const queueABefore = await pageA.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    const eventRow = queueABefore.find((r) => r.eventId === payload.sync_event_id);
    expect(eventRow).toBeTruthy();
    expect(eventRow?.origin).toBe("local_user");

    // Push if still pending (auto worker may already have synced after post)
    if (eventRow?.status === "pending" || eventRow?.status === "failed") {
      const pushed = await pageA.evaluate(async () => window.__orbixE2E!.pushSyncPending());
      expect(pushed).toBeGreaterThanOrEqual(1);
    }

    const queueAAfter = await pageA.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    const syncedA = queueAAfter.find((r) => r.eventId === payload.sync_event_id);
    expect(syncedA?.status).toBe("synced");
    expect(syncedA?.acknowledgedAt || syncedA?.syncedAt).toBeTruthy();

    // Device B pull
    const applied = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    expect(applied).toBeGreaterThanOrEqual(1);

    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const invB = (snapB.invoices as Array<{ id?: string; invoiceNo?: string; type?: string }>).filter(
      (i) => i.type === "purchase-invoice",
    );
    expect(invB.length).toBeGreaterThanOrEqual(1);
    expect(invB.some((i) => i.id === payload.invoice_id)).toBeTruthy();

    const movesB = (
      snapB.stockMovements as Array<{ referenceId?: string; itemId?: string }>
    ).filter((m) => m.referenceId === payload.invoice_id || m.itemId === "item-e2e-test-bike");
    expect(movesB.length).toBeGreaterThanOrEqual(1);

    // Day Book / Purchase Register / Stock via UI
    await pageB.evaluate(() => window.__uiQaGoto?.("day-book"));
    await pageB.waitForTimeout(500);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "device-b-daybook.png") });

    await pageB.evaluate(() => window.__uiQaGoto?.("purchase-invoice"));
    await pageB.waitForTimeout(500);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "device-b-purchase-register.png") });

    await pageB.evaluate(() => window.__uiQaGoto?.("stock-book"));
    await pageB.waitForTimeout(500);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "device-b-stock.png") });

    // Loop prevention: no new local_user pending purchase_posted for same invoice
    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const outboundLoop = queueB.filter(
      (r) =>
        r.origin === "local_user" &&
        r.status === "pending" &&
        (r.eventId === payload.sync_event_id ||
          String((r.envelope as { eventType?: string } | undefined)?.eventType || "") ===
            "purchase_posted"),
    );
    expect(outboundLoop.length).toBe(0);

    const appliedMarkers = queueB.filter((r) => r.origin === "remote_sync");
    expect(appliedMarkers.length).toBeGreaterThanOrEqual(1);

    // Push from B must not create a new remote purchase for same event
    await pageB.evaluate(async () => window.__orbixE2E!.pushSyncPending());
    const pullA = await pageA.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    const snapA2 = await pageA.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const invACount = (snapA2.invoices as Array<{ type?: string }>).filter(
      (i) => i.type === "purchase-invoice",
    ).length;
    expect(invACount).toBe(
      (snapA.invoices as Array<{ type?: string }>).filter((i) => i.type === "purchase-invoice")
        .length,
    );
    void pullA;

    await contextA.close();
    await contextB.close();
  });

  test("Duplicate push and integrity mismatch", async ({ request }) => {
    await assertBackendReady();
    await resetRemoteE2E();

    const envelope = {
      eventId: "evt-dup-gate-1",
      eventType: "purchase_posted",
      aggregateType: "purchase",
      aggregateId: "inv-dup-1",
      aggregateVersion: 1,
      timestamp: new Date().toISOString(),
      hash: "eventhash-dup-1",
      payload: {
        company_id: E2E_COMPANY,
        idempotency_key: "idem-dup-gate-1",
        integrity: {
          payload_hash: "payloadhash-dup-1",
          event_hash: "eventhash-dup-1",
          previous_event_hash: null,
        },
        purchase: {
          invoice_id: "inv-dup-1",
          invoice_number: "PI-DUP-GATE-1",
          voucher_number: "1",
          totals: { grand_total: 100 },
        },
      },
    };

    const pushOnce = async (body: unknown) => {
      const res = await request.post(`${backend}/api/sync/events/push`, {
        headers: {
          Authorization: "Bearer orbix-sync-e2e-token",
          "Content-Type": "application/json",
        },
        data: {
          device_id: "device-dup-test",
          tenant_id: "local",
          company_id: E2E_COMPANY,
          envelopes: [body],
        },
      });
      expect(res.ok()).toBeTruthy();
      const json = await res.json();
      return json.data ?? json;
    };

    const first = await pushOnce(envelope);
    expect(first.results[0].status).toBe("accepted");

    const second = await pushOnce(envelope);
    expect(second.results[0].status).toBe("duplicate");
    expect(second.results[0].remoteSequence).toBe(first.results[0].remoteSequence);

    const tampered = await pushOnce({
      ...envelope,
      payload: {
        ...envelope.payload,
        integrity: {
          ...envelope.payload.integrity,
          payload_hash: "CHANGED",
        },
      },
    });
    expect(tampered.results[0].status).toBe("conflict");
    expect(String(tampered.results[0].errorCode)).toMatch(/integrity|hash/i);

    const differentContentSameIdem = await pushOnce({
      ...envelope,
      eventId: "evt-dup-gate-2",
      hash: "eventhash-dup-2",
      payload: {
        ...envelope.payload,
        idempotency_key: "idem-dup-gate-1",
        integrity: {
          payload_hash: "payloadhash-dup-2",
          event_hash: "eventhash-dup-2",
          previous_event_hash: null,
        },
        purchase: {
          ...envelope.payload.purchase,
          invoice_id: "inv-dup-2",
          invoice_number: "PI-DUP-GATE-2",
          totals: { grand_total: 999 },
        },
      },
    });
    expect(["conflict", "rejected", "duplicate"]).toContain(
      differentContentSameIdem.results[0].status,
    );
  });

  test("Lost acknowledgement recovers via duplicate replay", async ({ browser }) => {
    await assertBackendReady();
    await resetRemoteE2E();

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-sync-device-lost-ack");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await page.evaluate(async () => window.__orbixE2E!.resetAndSeed());

    const posted = await page.evaluate(async () =>
      window.__orbixE2E!.postE2EPurchase({
        idempotencyKey: `e2e-lost-ack-${Date.now()}`,
      }),
    );
    const payload = (posted.payload || posted) as { sync_event_id?: string };
    expect(payload.sync_event_id).toBeTruthy();

    // Wait until the outbox event is acknowledged (auto-worker or manual push)
    await expect
      .poll(
        async () => {
          const q = await page.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
          const row = q.find((r) => r.eventId === payload.sync_event_id);
          if (!row) return "missing";
          if (row.status === "synced") return "synced";
          await page.evaluate(async () => window.__orbixE2E!.pushSyncPending());
          return String(row.status);
        },
        { timeout: 45_000, intervals: [500, 1000, 2000] },
      )
      .toBe("synced");

    // Simulate lost local acknowledgement: force queue row back to pending
    await page.evaluate(async (eventId) => {
      const { getDB } = await import("/src/lib/db.ts");
      const db = getDB();
      await db.eventSyncQueue.update(eventId, {
        status: "pending",
        syncedAt: null,
        acknowledgedAt: null,
        remoteEventId: null,
        remoteSequence: null,
        syncAttempts: 1,
        claimOwner: null,
        claimExpiresAt: null,
        nextAttemptAt: null,
      });
    }, payload.sync_event_id);

    const mid = await page.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    expect(mid.find((r) => r.eventId === payload.sync_event_id)?.status).toBe("pending");

    // Resend — remote returns duplicate; local becomes synced
    await expect
      .poll(
        async () => {
          await page.evaluate(async () => window.__orbixE2E!.pushSyncPending());
          const q = await page.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
          return q.find((r) => r.eventId === payload.sync_event_id)?.status || "missing";
        },
        { timeout: 45_000, intervals: [500, 1000, 2000] },
      )
      .toBe("synced");

    await context.close();
  });
});

test.describe("Phase 6 two-device Sales sync", () => {
  test.skip(!enabled, "Set ORBIX_SYNC_E2E=true and ORBIX_SYNC_BACKEND_URL to run");
  test.describe.configure({ timeout: 240_000 });

  const SALES_COMPANY = "orbix-sales-e2e-company";

  async function resetRemoteSalesE2E() {
    const reset = await fetch(`${backend}/api/sync/events/e2e-reset`, {
      method: "POST",
      headers: {
        Authorization: "Bearer orbix-sync-e2e-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyId: SALES_COMPANY }),
    });
    expect(reset.ok, `sales e2e-reset failed: ${reset.status}`).toBeTruthy();
  }

  test("Device A sales push → Device B pull/apply → no outbound loop", async ({ browser }) => {
    ensureArtifacts();
    await assertBackendReady();
    await resetRemoteSalesE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-sales-sync-device-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-sales-sync-device-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeedSales();
    });
    await pageB.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeedSales();
    });

    const posted = await pageA.evaluate(async () => {
      return window.__orbixE2E!.postE2ESale({
        quantity: "1",
        amount: "60000.00",
        paymentMethod: "cash",
        idempotencyKey: `e2e-sales-sync-a-${Date.now()}`,
      });
    });
    expect(posted.type || (posted as { status?: string }).status).toMatch(/posting_completed|success/);
    const payload = (posted.payload || posted) as {
      invoice_id?: string;
      sync_status?: string;
      sync_event_id?: string;
      cogs_amount?: string;
      inventory_accounting?: string;
      valuation_method?: string;
    };
    expect(payload.invoice_id).toBeTruthy();
    expect(payload.sync_event_id).toBeTruthy();
    expect(payload.inventory_accounting).toBe("perpetual");
    expect(Number(payload.cogs_amount)).toBe(50000);

    // Prove Device B does not recalculate from mutable item cost
    await pageB.evaluate(async () => {
      const { getDB } = await import("/src/lib/db.ts");
      await getDB().items.update("item-e2e-test-bike", { costPrice: 99999 });
    });

    const queueABefore = await pageA.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    const eventRow = queueABefore.find((r) => r.eventId === payload.sync_event_id);
    expect(eventRow?.origin).toBe("local_user");
    const envelopeType =
      (eventRow?.envelope as { eventType?: string; event_type?: string } | undefined)?.eventType ||
      (eventRow?.envelope as { eventType?: string; event_type?: string } | undefined)?.event_type;
    const domainType = await pageA.evaluate(async (eventId) => {
      const { getDB } = await import("/src/lib/db.ts");
      const row = await getDB().domainEvents.get(eventId);
      return row?.eventType || null;
    }, payload.sync_event_id);
    expect(envelopeType || domainType).toBe("sales_posted");

    if (eventRow?.status === "pending" || eventRow?.status === "failed") {
      const pushed = await pageA.evaluate(async () => window.__orbixE2E!.pushSyncPending());
      expect(pushed).toBeGreaterThanOrEqual(1);
    }

    const queueAAfter = await pageA.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    expect(queueAAfter.find((r) => r.eventId === payload.sync_event_id)?.status).toBe("synced");

    const applied = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-sales-e2e-company"),
    );
    expect(applied).toBeGreaterThanOrEqual(1);

    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const invB = (snapB.invoices as Array<{ id?: string; type?: string }>).filter(
      (i) => i.type === "sales-invoice",
    );
    expect(invB.some((i) => i.id === payload.invoice_id)).toBeTruthy();

    const movesB = (
      snapB.stockMovements as Array<{ referenceId?: string; qty?: number; amount?: number; rate?: number }>
    ).filter((m) => m.referenceId === payload.invoice_id);
    expect(movesB.length).toBeGreaterThanOrEqual(1);
    expect(Number(movesB[0].qty)).toBeLessThan(0);
    expect(Number(movesB[0].amount)).toBe(50000);
    expect(Number(movesB[0].rate)).toBe(50000);

    const cogsB = await pageB.evaluate(async (invoiceId) => {
      const { getDB } = await import("/src/lib/db.ts");
      return getDB().vouchers.get(`jnl-cogs-${invoiceId}`);
    }, payload.invoice_id);
    expect(cogsB).toBeTruthy();
    expect(Number((cogsB as { totalDebit?: number }).totalDebit)).toBe(50000);

    const itemCostB = await pageB.evaluate(async () => {
      const { getDB } = await import("/src/lib/db.ts");
      const item = await getDB().items.get("item-e2e-test-bike");
      return Number((item as { costPrice?: number })?.costPrice);
    });
    expect(itemCostB).toBe(99999);

    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const outboundLoop = queueB.filter(
      (r) =>
        r.origin === "local_user" &&
        (r.envelope as { eventType?: string } | undefined)?.eventType === "sales_posted" &&
        r.status === "pending",
    );
    expect(outboundLoop.length).toBe(0);

    await contextA.close();
    await contextB.close();
  });
});
