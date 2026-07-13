/**
 * Phase 10 two-device bank recon sync gates.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_BANK_RECON_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010
 *   Backend ORBIX_SYNC_TEST_MODE=true
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const syncEnabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);
const bankGate = process.env.ORBIX_BANK_RECON_E2E === "true";
const enabled = syncEnabled && bankGate;

const backend = (
  process.env.ORBIX_SYNC_BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3010"
).replace(/\/$/, "");

const E2E_COMPANY = "orbix-e2e-company";
const ARTIFACTS = path.resolve("artifacts/orbix-phase10");

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

test.describe("Phase 10 bank recon two-device sync", () => {
  test.skip(!enabled, "Set ORBIX_SYNC_E2E=true and ORBIX_BANK_RECON_E2E=true");
  test.describe.configure({ timeout: 240_000 });

  test("Device A import+match push → Device B pull identical, no rematch", async ({
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
      localStorage.setItem("fios_sync_device_id", "orbix-bank-sync-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-sync-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageA.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );
    const flushA = await pageA.evaluate(async () =>
      window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }),
    );
    expect(Number(flushA.pushed || 0)).toBeGreaterThan(0);

    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    const appliedB = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    expect(Number(appliedB || 0)).toBeGreaterThan(0);
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snapB.linkCount || 0)).toBeGreaterThan(0);

    // No-loop: Device B must not enqueue outbound bank match/import after pull
    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const outboundBusiness = (queueB as Record<string, unknown>[]).filter((r) => {
      const origin = String((r as { origin?: string }).origin || "");
      const status = String(r.status || "");
      const type = String(
        (r as { eventType?: string; event_type?: string; type?: string }).eventType ||
          (r as { event_type?: string }).event_type ||
          (r as { type?: string }).type ||
          "",
      );
      return (
        origin !== "remote_sync" &&
        /bank|recon|match|statement|cheque/i.test(type) &&
        /pending|queued|syncing|retry/i.test(status)
      );
    });
    expect(outboundBusiness.length).toBe(0);

    await contextA.close();
    await contextB.close();
  });

  test("Device A cheque clear push → Device B pull cleared, no duplicate", async ({
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
      localStorage.setItem("fios_sync_device_id", "orbix-bank-chq-sync-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-chq-sync-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageA.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    const cleared = await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EChequeTransition({
        chequeNumber: "CH-E2E-001",
        nextStatus: "cleared",
        expectedInstrumentVersion: 1,
      }),
    );
    expect(String((cleared as { type?: string }).type || "")).toContain("completed");
    const flushChq = await pageA.evaluate(async () =>
      window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }),
    );
    expect(Number(flushChq.pushed || 0)).toBeGreaterThan(0);

    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    const appliedChq = await pageB.evaluate(async () =>
      window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
    );
    expect(Number(appliedChq || 0)).toBeGreaterThan(0);
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(String(snapB.chequeClearedStatus || "")).toMatch(/cleared/i);

    // No duplicate: second clear with stale version must conflict / fail
    const dup = await pageB.evaluate(async () =>
      window.__orbixE2E!.postE2EChequeTransition({
        chequeNumber: "CH-E2E-001",
        nextStatus: "cleared",
        expectedInstrumentVersion: 1,
      }),
    );
    expect(String((dup as { type?: string }).type || "")).toMatch(
      /posting_conflict|posting_failed|posting_denied/,
    );

    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-cheque-sync-result.json"),
      JSON.stringify({ cleared, snapB, dup }, null, 2),
      "utf-8",
    );

    await contextA.close();
    await contextB.close();
  });

  test("Duplicate statement import is idempotent locally", async ({ page }) => {
    ensureArtifacts();
    await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await page.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    const first = await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-dup-import" }),
    );
    const second = await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-dup-import-2" }),
    );
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(String((first as { type?: string }).type || "")).toMatch(/completed|success/i);
    expect(Number(snap.batchCount || 0)).toBe(1);
    expect(String((second as { type?: string }).type || "")).toMatch(
      /conflict|failed|denied|completed/i,
    );
    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-dup-import-result.json"),
      JSON.stringify({ first, second, snap }, null, 2),
      "utf-8",
    );
  });
});
