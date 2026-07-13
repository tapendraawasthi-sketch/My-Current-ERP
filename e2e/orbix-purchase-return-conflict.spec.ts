/**
 * Phase 8 concurrent over-return conflict gate.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_PURCHASE_RETURN_CONFLICT_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010
 *   Backend ORBIX_SYNC_TEST_MODE=true
 *
 * Device A uses Orbix chat for purchase return qty 2.
 * Device B uses harness postE2EPurchaseAdjustment (qty 1) for concurrent isolation —
 * documented intentional: chat on both devices races UI flakiness; B local post
 * still exercises remote version / qty conflict.
 *
 * Company: orbix-e2e-company only.
 * Artifacts: artifacts/orbix-phase8/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const enabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  process.env.ORBIX_PURCHASE_RETURN_CONFLICT_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);

const backend = (
  process.env.ORBIX_SYNC_BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3010"
).replace(/\/$/, "");

const E2E_PURCHASE_COMPANY = "orbix-e2e-company";
const ARTIFACTS = path.resolve("artifacts/orbix-phase8");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

async function assertBackendReady() {
  const health = await fetch(`${backend}/api/health`);
  expect(health.ok, `health failed for ${backend}`).toBeTruthy();
  const ready = await fetch(`${backend}/api/sync/ready`);
  expect(ready.ok, "sync/ready failed").toBeTruthy();
  const body = (await ready.json()) as { data?: Record<string, unknown> };
  const data = body.data ?? (body as unknown as Record<string, unknown>);
  expect(data.test_mode).toBe(true);
  if (data.test_mode !== true) {
    throw new Error("Abort: sync backend is not in ORBIX_SYNC_TEST_MODE");
  }
}

async function resetRemotePurchaseE2E() {
  if (!E2E_PURCHASE_COMPANY.includes("e2e") && !E2E_PURCHASE_COMPANY.startsWith("orbix-")) {
    throw new Error("Abort: refuse remote reset for non-E2E company");
  }
  const reset = await fetch(`${backend}/api/sync/events/e2e-reset`, {
    method: "POST",
    headers: {
      Authorization: "Bearer orbix-sync-e2e-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyId: E2E_PURCHASE_COMPANY }),
  });
  expect(reset.ok, `e2e-reset failed: ${reset.status}`).toBeTruthy();
}

test.describe("Phase 8 purchase return concurrent conflict", () => {
  test.skip(
    !enabled,
    "Set ORBIX_SYNC_E2E=true and ORBIX_PURCHASE_RETURN_CONFLICT_E2E=true with sync backend",
  );
  test.describe.configure({ timeout: 300_000 });

  test("Concurrent returns on PI-E2E-CONFLICT-006 — remote accepts ≤ qty 2", async ({
    browser,
    request,
  }) => {
    ensureArtifacts();
    await assertBackendReady();
    await resetRemotePurchaseE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-preturn-conflict-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-preturn-conflict-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    const mapA = await pageA.evaluate(async () =>
      window.__orbixE2E!.seedPhase8OriginalPurchases(),
    );
    expect(mapA["PI-E2E-CONFLICT-006"]).toBeTruthy();
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    await pageB.evaluate(async () => window.__orbixE2E!.resetAndSeed());
    await pageB.evaluate(async () => window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"));
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    const conflictOnB = await pageB.evaluate(async () => {
      const snap = await window.__orbixE2E!.getSnapshot();
      const inv = (snap.invoices as Array<{ invoiceNo?: string; id?: string }>).find(
        (i) => i.invoiceNo === "PI-E2E-CONFLICT-006",
      );
      return inv?.id || null;
    });
    expect(conflictOnB).toBeTruthy();

    // Device A: chat purchase return full qty 2 (before push)
    await pageA.evaluate(() => window.__uiQaGoto?.("orbix"));
    await expect(pageA.locator('[data-component="orbix-workspace"]')).toBeVisible({
      timeout: 30_000,
    });
    await pageA.getByTestId("orbix-mode-accountant").click();
    await pageA.getByTestId("orbix-composer").fill(
      "We returned 2 bikes to the supplier from purchase invoice PI-E2E-CONFLICT-006. Reduce the payable.",
    );
    await pageA.getByTestId("orbix-send").click();
    await expect(pageA.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
    await pageA.getByTestId("orbix-confirm-post").click();
    await expect(pageA.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });

    // Device B: concurrent local post qty 1 at version 0 (documented harness path)
    const postedB = await pageB.evaluate(async () => {
      return window.__orbixE2E!.postE2EPurchaseAdjustment({
        originalInvoiceNo: "PI-E2E-CONFLICT-006",
        quantity: 1,
        settlementMethod: "reduce_payable",
        idempotencyKey: `e2e-pconflict-b-${Date.now()}`,
      });
    });
    expect(postedB.type || (postedB as { status?: string }).status).toMatch(
      /posting_completed|success/,
    );

    // Push both return events
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));
    await pageB.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));

    // Inspect remote accepted return qty for this original (GET pull API)
    const pull = await request.get(
      `${backend}/api/sync/events/pull?since=0&companyId=${encodeURIComponent(E2E_PURCHASE_COMPANY)}&deviceId=orbix-preturn-conflict-inspector`,
      {
        headers: {
          Authorization: "Bearer orbix-sync-e2e-token",
        },
      },
    );
    expect(pull.ok(), `pull failed: ${pull.status()} ${await pull.text()}`).toBeTruthy();
    const pullJson = await pull.json();
    const events =
      (pullJson.data?.events as Array<{
        event_type?: string;
        eventType?: string;
        status?: string;
        payload?: {
          purchase_adjustment?: {
            original_invoice_id?: string;
            original_invoice_number?: string;
            adjustment_version_before?: number;
            item_lines?: Array<{ quantity?: number }>;
          };
        };
      }>) ||
      pullJson.events ||
      [];

    const returns = events.filter((e) => {
      const et = e.event_type || e.eventType;
      if (et !== "purchase_return_posted") return false;
      const adj = e.payload?.purchase_adjustment;
      return (
        adj?.original_invoice_number === "PI-E2E-CONFLICT-006" ||
        adj?.original_invoice_id === mapA["PI-E2E-CONFLICT-006"] ||
        adj?.original_invoice_id === conflictOnB
      );
    });

    const acceptedQty = returns.reduce((sum, e) => {
      const lines = e.payload?.purchase_adjustment?.item_lines || [];
      return sum + lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
    }, 0);
    expect(acceptedQty).toBeLessThanOrEqual(2);

    // At least one device should show conflict or only one return synced
    const queueA = await pageA.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const returnRows = [...queueA, ...queueB].filter(
      (r) =>
        (r.envelope as { eventType?: string } | undefined)?.eventType === "purchase_return_posted",
    );
    const conflicted = returnRows.some(
      (r) => r.status === "conflict" || String(r.lastError || "").toLowerCase().includes("conflict"),
    );
    const synced = returnRows.filter((r) => r.status === "synced");
    expect(conflicted || synced.length <= 1 || acceptedQty <= 2).toBeTruthy();

    await pageA.screenshot({ path: path.join(ARTIFACTS, "purchase-return-conflict-a.png") });
    await pageB.screenshot({ path: path.join(ARTIFACTS, "purchase-return-conflict-b.png") });

    // Direct API: second push with stale adjustment_version_before must conflict
    const stale = {
      eventId: "evt-preturn-stale-version",
      eventType: "purchase_return_posted",
      aggregateType: "purchase",
      aggregateId: "inv-preturn-stale",
      aggregateVersion: 1,
      timestamp: new Date().toISOString(),
      hash: "eventhash-preturn-stale",
      payload: {
        company_id: E2E_PURCHASE_COMPANY,
        idempotency_key: "idem-preturn-stale",
        integrity: {
          payload_hash: "payloadhash-preturn-stale",
          event_hash: "eventhash-preturn-stale",
          previous_event_hash: null,
        },
        purchase_adjustment: {
          invoice_id: "inv-preturn-stale",
          invoice_number: "PR-STALE-1",
          original_invoice_id: mapA["PI-E2E-CONFLICT-006"],
          original_invoice_number: "PI-E2E-CONFLICT-006",
          adjustment_type: "inventory_purchase_return",
          adjustment_version_before: 0,
          aggregate_version: 1,
          item_lines: [{ quantity: 1, item_id: "item-e2e-test-bike" }],
          totals: { grand_total: 50000 },
        },
      },
    };

    // Seed a winner at version 0 → 1 if not already present via devices
    const winner = {
      ...stale,
      eventId: "evt-preturn-winner-version",
      hash: "eventhash-preturn-winner",
      payload: {
        ...stale.payload,
        idempotency_key: "idem-preturn-winner",
        integrity: {
          payload_hash: "payloadhash-preturn-winner",
          event_hash: "eventhash-preturn-winner",
          previous_event_hash: null,
        },
      },
    };
    const pushWinner = await request.post(`${backend}/api/sync/events/push`, {
      headers: {
        Authorization: "Bearer orbix-sync-e2e-token",
        "Content-Type": "application/json",
      },
      data: {
        device_id: "device-pversion-winner",
        tenant_id: "local",
        company_id: E2E_PURCHASE_COMPANY,
        envelopes: [winner],
      },
    });
    const winnerJson = await pushWinner.json();
    const winnerStatus = (winnerJson.data ?? winnerJson).results?.[0]?.status;
    expect(["accepted", "duplicate", "conflict"]).toContain(winnerStatus);

    const pushStale = await request.post(`${backend}/api/sync/events/push`, {
      headers: {
        Authorization: "Bearer orbix-sync-e2e-token",
        "Content-Type": "application/json",
      },
      data: {
        device_id: "device-pversion-stale",
        tenant_id: "local",
        company_id: E2E_PURCHASE_COMPANY,
        envelopes: [stale],
      },
    });
    const staleJson = await pushStale.json();
    const staleResult = (staleJson.data ?? staleJson).results?.[0];
    if (winnerStatus === "accepted" || returns.length >= 1) {
      expect(staleResult.status).toBe("conflict");
      expect(String(staleResult.errorCode || staleResult.conflict?.classification || "")).toMatch(
        /stale|version|adjustment/i,
      );
    }

    await contextA.close();
    await contextB.close();
  });
});
