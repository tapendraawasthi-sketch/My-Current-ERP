/**
 * Phase 9 two-device settlement sync gates.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_SETTLEMENT_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010
 *   Backend ORBIX_SYNC_TEST_MODE=true
 *
 * Artifacts: artifacts/orbix-phase9/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const syncEnabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);
const settlementGate = process.env.ORBIX_SETTLEMENT_E2E === "true";
const enabled = syncEnabled && settlementGate;

const backend = (
  process.env.ORBIX_SYNC_BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3010"
).replace(/\/$/, "");

const E2E_COMPANY = "orbix-e2e-company";
const ARTIFACTS = path.resolve("artifacts/orbix-phase9");

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

async function resetRemoteE2E() {
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

test.describe("Phase 9 settlement two-device sync", () => {
  test.skip(
    !enabled,
    "Set ORBIX_SYNC_E2E=true and ORBIX_SETTLEMENT_E2E=true with sync backend",
  );
  test.describe.configure({ timeout: 240_000 });

  test("Device A receipt push → Device B pull identical, no outbound loop", async ({
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
      localStorage.setItem("fios_sync_device_id", "orbix-settle-sync-device-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-settle-sync-device-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    const seeded = await pageA.evaluate(async () =>
      window.__orbixE2E!.seedPhase9SettlementDocs(),
    );
    expect(seeded.invoiceIds["SI-E2E-001"]).toBeTruthy();

    // Push seed invoices so B can pull them
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    await pageB.evaluate(async () => {
      await window.__orbixE2E!.resetAndSeed();
      await window.__orbixE2E!.seedPhase9SettlementDocs();
    });
    // Prefer pull of A's events over re-seed — re-seed then pull
    await pageB.evaluate(async () => window.__orbixE2E!.resetAndSeed());
    const appliedSeed = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    // If pull brings nothing (seed invoices may be local-only), seed locally on B too
    if (appliedSeed < 1) {
      await pageB.evaluate(async () => window.__orbixE2E!.seedPhase9SettlementDocs());
    }
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    // Device A: harness receipt (deterministic for sync isolation)
    const posted = await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EReceipt({
        invoiceNo: "SI-E2E-001",
        amount: "50000.00",
        cashOrBankAccountId: "acc-bank",
        idempotencyKey: `e2e-settle-sync-a-${Date.now()}`,
      }),
    );
    expect(String((posted as { type?: string }).type || "")).toMatch(/posting_completed|success/);

    const snapA = await pageA.evaluate(async () => window.__orbixE2E!.getSettlementSnapshot());
    expect((snapA.receipts as unknown[]).length).toBeGreaterThanOrEqual(1);
    const receiptA = (snapA.receipts as Array<{ id?: string }>)[0];
    expect(receiptA?.id).toBeTruthy();

    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));

    const applied = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    expect(applied).toBeGreaterThanOrEqual(1);
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());

    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getSettlementSnapshot());
    const receiptB = (snapB.receipts as Array<{ id?: string }>).find((r) => r.id === receiptA.id);
    expect(receiptB).toBeTruthy();

    const allocA = (snapA.allocations as Array<{ targetDocumentId?: string }>).length;
    const allocB = (snapB.allocations as Array<{ targetDocumentId?: string }>).length;
    expect(allocB).toBe(allocA);

    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const outboundLoop = queueB.filter((r) => {
      const et =
        (r.envelope as { eventType?: string } | undefined)?.eventType ||
        String((r as { eventType?: string }).eventType || "");
      return (
        r.origin === "local_user" &&
        r.status === "pending" &&
        (et === "receipt_posted" || et.includes("receipt"))
      );
    });
    expect(outboundLoop.length).toBe(0);

    await pageB.screenshot({
      path: path.join(ARTIFACTS, "settlement-sync-device-b.png"),
    });
    fs.writeFileSync(
      path.join(ARTIFACTS, "settlement-sync-final.txt"),
      JSON.stringify({ receiptA, receiptB, allocA, allocB, applied }, null, 2),
      "utf-8",
    );

    await contextA.close();
    await contextB.close();
  });
});
