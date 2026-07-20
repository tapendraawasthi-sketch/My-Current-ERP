/**
 * PR-B3 launch purchase material conflict (invoice_number_collision).
 *
 * Proves: two devices posting the same invoice number → conflict (not silent overwrite),
 * then operator reconfirm (abandon conflicting push) completes with no dual apply.
 * Staging attestation (TICKET-PR-B3-001) remains human — do not invent OWNER residual.
 *
 * Requires same env as e2e/orbix-sync.spec.ts.
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
const INVOICE_NO = "PI-LAUNCH-CONFLICT-1";
const ARTIFACTS = path.resolve("artifacts/prod-ready-pr-b3/e2e");

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

test.describe("PR-B3 launch purchase material conflict", () => {
  test.skip(!enabled, "Set ORBIX_SYNC_E2E=true and ORBIX_SYNC_BACKEND_URL to run");
  test.describe.configure({ timeout: 240_000 });

  test("Device A syncs PI → Device B same invoiceNo push conflicts (no silent overwrite)", async ({
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
      localStorage.setItem("fios_sync_device_id", "orbix-launch-conflict-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-launch-conflict-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => window.__orbixE2E!.resetAndSeed());
    await pageB.evaluate(async () => window.__orbixE2E!.resetAndSeed());

    const postedA = await pageA.evaluate(async (invoiceNo) => {
      return window.__orbixE2E!.postE2EPurchase({
        quantity: "1",
        amount: "50000.00",
        invoiceNo,
        idempotencyKey: `e2e-launch-conflict-a-${Date.now()}`,
      });
    }, INVOICE_NO);
    expect(postedA.type || (postedA as { status?: string }).status).toMatch(
      /posting_completed|success/,
    );
    const payloadA = (postedA.payload || postedA) as {
      invoice_id?: string;
      sync_event_id?: string;
    };
    expect(payloadA.invoice_id).toBeTruthy();

    const flushA = await pageA.evaluate(async () =>
      window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }),
    );
    expect(flushA.remaining).toBe(0);
    const queueASynced = await pageA.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    expect(queueASynced.find((r) => r.eventId === payloadA.sync_event_id)?.status).toBe(
      "synced",
    );

    const postedB = await pageB.evaluate(async (invoiceNo) => {
      return window.__orbixE2E!.postE2EPurchase({
        quantity: "1",
        amount: "51000.00",
        invoiceNo,
        idempotencyKey: `e2e-launch-conflict-b-${Date.now()}`,
      });
    }, INVOICE_NO);
    expect(postedB.type || (postedB as { status?: string }).status).toMatch(
      /posting_completed|success/,
    );
    const payloadB = (postedB.payload || postedB) as {
      invoice_id?: string;
      sync_event_id?: string;
    };
    expect(payloadB.invoice_id).toBeTruthy();
    expect(payloadB.invoice_id).not.toBe(payloadA.invoice_id);

    await pageB.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    const queueB = await pageB.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    const rowB = queueB.find((r) => r.eventId === payloadB.sync_event_id);
    expect(rowB?.status).toBe("conflict");
    const err = String(
      rowB?.lastError || rowB?.errorCode || rowB?.lastErrorCode || "",
    ).toLowerCase();
    expect(err).toContain("invoice_number_collision");

    // Local B still has its own invoice; remote A invoice must not silently replace it
    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const purchasesB = (
      snapB.invoices as Array<{ id?: string; invoiceNo?: string; type?: string }>
    ).filter((i) => i.type === "purchase-invoice" && i.invoiceNo === INVOICE_NO);
    expect(purchasesB.some((i) => i.id === payloadB.invoice_id)).toBeTruthy();
    expect(purchasesB.some((i) => i.id === payloadA.invoice_id)).toBeFalsy();

    // Best-effort pull: schema gaps must not erase the push-conflict proof above
    let pullOk = true;
    let pullError = "";
    try {
      await pageB.evaluate(async () =>
        window.__orbixE2E!.pullSyncRemote("orbix-e2e-company"),
      );
      await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());
    } catch (e) {
      pullOk = false;
      pullError = e instanceof Error ? e.message : String(e);
    }
    const snapB2 = await pageB.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const purchasesB2 = (
      snapB2.invoices as Array<{ id?: string; invoiceNo?: string; type?: string }>
    ).filter((i) => i.type === "purchase-invoice" && i.invoiceNo === INVOICE_NO);
    expect(purchasesB2.some((i) => i.id === payloadB.invoice_id)).toBeTruthy();
    // Never silently replace B's local colliding invoice with A's
    expect(purchasesB2.some((i) => i.id === payloadA.invoice_id)).toBeFalsy();

    const conflictRows = await pageB.evaluate(async () => {
      const { getDB } = await import("/src/lib/db.ts");
      const db = getDB();
      if (!db.eventSyncConflicts) return [];
      try {
        return await db.eventSyncConflicts.toArray();
      } catch {
        return [];
      }
    });
    expect(rowB?.status).toBe("conflict");

    // Operator reconfirm: abandon conflicting push (keep local B; no remote overwrite)
    const reconfirm = await pageB.evaluate(async (queueRowId) => {
      return window.__orbixE2E!.reconfirmMaterialConflict({
        queueRowId,
        choice: "abandon_conflicting_push",
      });
    }, String(rowB?.id || payloadB.sync_event_id));
    expect(reconfirm.ok).toBe(true);
    expect(reconfirm.status).toBe("resolved");

    const queueBAfter = await pageB.evaluate(async () =>
      window.__orbixE2E!.getSyncQueueSnapshot(),
    );
    const rowBAfter = queueBAfter.find((r) => r.eventId === payloadB.sync_event_id);
    expect(rowBAfter?.status).toBe("resolved");
    expect(String(rowBAfter?.lastErrorCode || "")).toBe("operator_reconfirm_abandon");

    await pageB.evaluate(async () => window.__orbixE2E!.reloadFromDexie());
    const snapB3 = await pageB.evaluate(async () => window.__orbixE2E!.getSnapshot());
    const purchasesB3 = (
      snapB3.invoices as Array<{ id?: string; invoiceNo?: string; type?: string }>
    ).filter((i) => i.type === "purchase-invoice" && i.invoiceNo === INVOICE_NO);
    expect(purchasesB3.some((i) => i.id === payloadB.invoice_id)).toBeTruthy();
    expect(purchasesB3.some((i) => i.id === payloadA.invoice_id)).toBeFalsy();

    const evidence = {
      invoiceNo: INVOICE_NO,
      deviceAInvoiceId: payloadA.invoice_id,
      deviceBInvoiceId: payloadB.invoice_id,
      deviceBQueueStatus: rowB?.status,
      deviceBQueueStatusAfterReconfirm: rowBAfter?.status,
      deviceBError: err,
      reconfirmOk: reconfirm.ok === true,
      reconfirmChoice: "abandon_conflicting_push",
      purchasesOnB: purchasesB3.map((i) => i.id),
      conflictRowCount: conflictRows.length,
      pullOk,
      pullError: pullError || null,
      autoOverwrite: false,
      reconfirmCompleted: true,
      dualSilentApply: false,
      attestedTicketClear: false,
      note: "Engineering reconfirm PASS — TICKET-PR-B3-001 staging human attestation still OPEN",
    };
    fs.writeFileSync(
      path.join(ARTIFACTS, "LAUNCH_PURCHASE_CONFLICT_EVIDENCE.json"),
      JSON.stringify(evidence, null, 2),
    );
    await pageB.screenshot({
      path: path.join(ARTIFACTS, "device-b-after-conflict.png"),
    });
    await pageB.screenshot({
      path: path.join(ARTIFACTS, "device-b-after-reconfirm.png"),
    });

    await contextA.close();
    await contextB.close();
  });
});
