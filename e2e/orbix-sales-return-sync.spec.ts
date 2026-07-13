/**
 * Phase 7 two-device Sales Return sync gates.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010
 *   ORBIX_SALES_RETURN_E2E=true  OR  ORBIX_RETURN_CONFLICT_E2E=true
 *   Backend ORBIX_SYNC_TEST_MODE=true
 *
 * Company: orbix-sales-e2e-company only.
 * Artifacts: artifacts/orbix-phase7/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const syncEnabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);
const returnGate =
  process.env.ORBIX_SALES_RETURN_E2E === "true" ||
  process.env.ORBIX_RETURN_CONFLICT_E2E === "true";
const enabled = syncEnabled && returnGate;

const backend = (
  process.env.ORBIX_SYNC_BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3010"
).replace(/\/$/, "");

const E2E_SALES_COMPANY = "orbix-sales-e2e-company";
const ARTIFACTS = path.resolve("artifacts/orbix-phase7");

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

async function resetRemoteSalesE2E() {
  if (!E2E_SALES_COMPANY.includes("e2e") && !E2E_SALES_COMPANY.startsWith("orbix-")) {
    throw new Error("Abort: refuse remote reset for non-E2E company");
  }
  const reset = await fetch(`${backend}/api/sync/events/e2e-reset`, {
    method: "POST",
    headers: {
      Authorization: "Bearer orbix-sync-e2e-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyId: E2E_SALES_COMPANY }),
  });
  expect(reset.ok, `e2e-reset failed: ${reset.status}`).toBeTruthy();
}

async function gotoOrbix(page: import("@playwright/test").Page) {
  await page.evaluate(() => window.__uiQaGoto?.("orbix"));
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("orbix-mode-accountant").click();
}

async function sendOrbix(page: import("@playwright/test").Page, text: string) {
  const input = page.getByTestId("orbix-composer");
  await input.fill(text);
  await page.getByTestId("orbix-send").click();
  await expect(page.getByTestId("orbix-send")).toBeVisible({ timeout: 120_000 });
}

async function pushIfPending(page: import("@playwright/test").Page, eventId?: string | null) {
  const queue = await page.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
  const row = eventId
    ? queue.find((r) => r.eventId === eventId)
    : queue.find(
        (r) =>
          r.status === "pending" ||
          r.status === "failed",
      );
  if (row && (row.status === "pending" || row.status === "failed")) {
    const pushed = await page.evaluate(async () => window.__orbixE2E!.pushSyncPending());
    expect(pushed).toBeGreaterThanOrEqual(1);
  }
}

test.describe("Phase 7 sales return two-device sync", () => {
  test.skip(
    !enabled,
    "Set ORBIX_SYNC_E2E=true and ORBIX_SALES_RETURN_E2E=true (or ORBIX_RETURN_CONFLICT_E2E=true)",
  );
  test.describe.configure({ timeout: 240_000 });

  test("Device A partial return push → Device B pull identical facts, no loop", async ({
    browser,
  }) => {
    ensureArtifacts();
    await assertBackendReady();
    await resetRemoteSalesE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-return-sync-device-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-return-sync-device-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    const map = await pageA.evaluate(async () => window.__orbixE2E!.seedPhase7OriginalSales());
    expect(map["SI-E2E-CREDIT-002"]).toBeTruthy();

    // Push original sales so Device B can pull the invoice
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    await pageB.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeedSales();
    });
    const appliedSales = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-sales-e2e-company"),
    );
    expect(appliedSales).toBeGreaterThanOrEqual(1);
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    // Device A: Orbix UI partial return
    await gotoOrbix(pageA);
    await sendOrbix(
      pageA,
      "Ram Traders returned 1 of the 2 bikes from invoice SI-E2E-CREDIT-002. Reduce the outstanding balance.",
    );
    await expect(pageA.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
    await pageA.getByTestId("orbix-confirm-post").click();
    await expect(pageA.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });

    const adjA = await pageA.evaluate(async () => window.__orbixE2E!.getAdjustmentSnapshot());
    const returnA = (adjA.returns as Array<{ id?: string; originalInvoiceId?: string }>)[0];
    expect(returnA?.id).toBeTruthy();
    expect(returnA?.originalInvoiceId).toBe(map["SI-E2E-CREDIT-002"]);

    const draft = await pageA.evaluate(() => window.__orbixE2E!.getDraftState());
    const syncEventId = String(
      (draft.lastPostingResult as { payload?: { sync_event_id?: string } } | null)?.payload
        ?.sync_event_id || "",
    );
    const queueA = await pageA.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const returnEvent =
      queueA.find((r) => r.eventId === syncEventId) ||
      queueA.find((r) => {
        const env = r.envelope as { eventType?: string; event_type?: string } | undefined;
        const et = env?.eventType || env?.event_type;
        return et === "sales_return_posted" && r.origin !== "remote_sync";
      });
    expect(syncEventId || returnEvent).toBeTruthy();
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));

    const appliedReturn = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-sales-e2e-company"),
    );
    expect(appliedReturn).toBeGreaterThanOrEqual(1);
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    const adjB = await pageB.evaluate(async () => window.__orbixE2E!.getAdjustmentSnapshot());
    const returnB = (adjB.returns as Array<{ id?: string; originalInvoiceId?: string }>).find(
      (r) => r.id === returnA.id,
    );
    expect(returnB).toBeTruthy();
    expect(returnB?.originalInvoiceId).toBe(map["SI-E2E-CREDIT-002"]);

    const stockB = (adjB.stockIns as Array<{ referenceId?: string; qty?: number }>).filter(
      (m) => m.referenceId === returnA.id,
    );
    expect(stockB.length).toBeGreaterThanOrEqual(1);

    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const outboundLoop = queueB.filter(
      (r) =>
        r.origin === "local_user" &&
        r.status === "pending" &&
        (r.envelope as { eventType?: string } | undefined)?.eventType === "sales_return_posted",
    );
    expect(outboundLoop.length).toBe(0);

    await pageB.screenshot({ path: path.join(ARTIFACTS, "return-sync-device-b.png") });

    await contextA.close();
    await contextB.close();
  });

  test("Duplicate sales_return_posted push", async ({ request }) => {
    await assertBackendReady();
    await resetRemoteSalesE2E();

    const envelope = {
      eventId: "evt-return-dup-1",
      eventType: "sales_return_posted",
      aggregateType: "sale",
      aggregateId: "inv-return-dup-1",
      aggregateVersion: 1,
      timestamp: new Date().toISOString(),
      hash: "eventhash-return-dup-1",
      payload: {
        company_id: E2E_SALES_COMPANY,
        idempotency_key: "idem-return-dup-1",
        integrity: {
          payload_hash: "payloadhash-return-dup-1",
          event_hash: "eventhash-return-dup-1",
          previous_event_hash: null,
        },
        sale_adjustment: {
          invoice_id: "inv-return-dup-1",
          invoice_number: "SR-DUP-1",
          original_invoice_id: "inv-orig-dup-1",
          original_invoice_number: "SI-E2E-CREDIT-002",
          adjustment_type: "inventory_sales_return",
          adjustment_version_before: 0,
          aggregate_version: 1,
          item_lines: [{ quantity: 1, item_id: "item-e2e-test-bike" }],
          totals: { grand_total: 60000 },
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
          device_id: "device-return-dup",
          tenant_id: "local",
          company_id: E2E_SALES_COMPANY,
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
  });

  test("Financial CN two-device shorter path", async ({ browser }) => {
    await assertBackendReady();
    await resetRemoteSalesE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-cn-sync-device-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-cn-sync-device-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    const map = await pageA.evaluate(async () => window.__orbixE2E!.seedPhase7OriginalSales());
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    await pageB.evaluate(async () => window.__orbixE2E!.resetAndSeedSales());
    await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-sales-e2e-company"),
    );

    await gotoOrbix(pageA);
    await sendOrbix(
      pageA,
      "Give Ram Traders a Rs 5,000 credit note against invoice SI-E2E-CN-005 for a pricing error. No goods were returned.",
    );
    await expect(pageA.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
    await pageA.getByTestId("orbix-confirm-post").click();
    await expect(pageA.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));
    await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-sales-e2e-company"),
    );
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    const adjB = await pageB.evaluate(async () => window.__orbixE2E!.getAdjustmentSnapshot());
    expect(
      (adjB.creditNotes as Array<{ originalInvoiceId?: string }>).some(
        (c) => c.originalInvoiceId === map["SI-E2E-CN-005"],
      ),
    ).toBeTruthy();
    expect((adjB.stockIns as unknown[]).length).toBe(0);

    await contextA.close();
    await contextB.close();
  });
});
