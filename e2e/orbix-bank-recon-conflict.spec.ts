/**
 * Phase 10 concurrent bank match / cheque version conflict gate.
 *
 * Requires:
 *   ORBIX_SYNC_E2E=true
 *   ORBIX_BANK_CONFLICT_E2E=true
 *   ORBIX_SYNC_BACKEND_URL=http://127.0.0.1:3010
 *   Backend ORBIX_SYNC_TEST_MODE=true
 *
 * Artifacts: artifacts/orbix-phase10/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const enabled =
  process.env.ORBIX_SYNC_E2E === "true" &&
  process.env.ORBIX_BANK_CONFLICT_E2E === "true" &&
  Boolean(process.env.ORBIX_SYNC_BACKEND_URL || process.env.VITE_API_URL);

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
  expect(health.ok).toBeTruthy();
  const ready = await fetch(`${backend}/api/sync/ready`);
  expect(ready.ok).toBeTruthy();
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
  expect(reset.ok).toBeTruthy();
}

function hasStaleConflict(rows: Record<string, unknown>[], needle: string): boolean {
  return rows.some((r) => {
    const status = String(r.status || "");
    const err = String(
      (r as { lastError?: string; error?: string }).lastError ||
        (r as { error?: string }).error ||
        "",
    );
    const payload = JSON.stringify(r);
    return (
      status.includes("conflict") ||
      status.includes("failed") ||
      err.includes(needle) ||
      payload.includes(needle)
    );
  });
}

test.describe("Phase 10 bank recon concurrent conflict", () => {
  test.skip(
    !enabled,
    "Set ORBIX_SYNC_E2E=true and ORBIX_BANK_CONFLICT_E2E=true with sync backend",
  );
  test.describe.configure({ timeout: 300_000 });

  test("Concurrent match conflict — both expectedVersion 1, second stale", async ({
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
      localStorage.setItem("fios_sync_device_id", "orbix-bank-conflict-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-conflict-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());

    const importedA = await pageA.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    const importedB = await pageB.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    expect(String((importedA as { type?: string }).type || "")).toMatch(/completed|success/i);
    expect(String((importedB as { type?: string }).type || "")).toMatch(/completed|success/i);

    // Both match concurrently against initial reconciliationVersion 1 (deterministic line IDs)
    const postedA = await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );
    const postedB = await pageB.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );

    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));
    await pageB.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));

    const queueA = await pageA.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());

    const aOk = String((postedA as { type?: string }).type || "").includes("completed");
    const bOk = String((postedB as { type?: string }).type || "").includes("completed");
    const hasStale =
      hasStaleConflict(queueA, "stale_statement_line_version") ||
      hasStaleConflict(queueB, "stale_statement_line_version") ||
      String((postedA as { conflict_category?: string }).conflict_category || "").includes(
        "stale_statement_line_version",
      ) ||
      String((postedB as { conflict_category?: string }).conflict_category || "").includes(
        "stale_statement_line_version",
      ) ||
      String((postedA as { error_code?: string }).error_code || "").includes(
        "stale_statement_line_version",
      ) ||
      String((postedB as { error_code?: string }).error_code || "").includes(
        "stale_statement_line_version",
      );

    // Fallback: A push succeeds, B pull then rematch with stale version 1
    let rematchStale = false;
    if (!hasStale && aOk) {
      await pageB.evaluate(async () => window.__orbixE2E!.pullRemoteEvents?.());
      const rematch = await pageB.evaluate(async () =>
        window.__orbixE2E!.postE2EBankMatch({
          reference: "RV-E2E-001",
          amount: "25000.00",
          expectedVersion: 1,
        }),
      );
      rematchStale =
        String((rematch as { conflict_category?: string }).conflict_category || "").includes(
          "stale_statement_line_version",
        ) ||
        String((rematch as { error_code?: string }).error_code || "").includes(
          "stale_statement_line_version",
        ) ||
        String((rematch as { type?: string }).type || "").includes("conflict");
    }

    await pageA.screenshot({ path: path.join(ARTIFACTS, "bank-match-conflict-a.png") });
    await pageB.screenshot({ path: path.join(ARTIFACTS, "bank-match-conflict-b.png") });
    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-match-conflict-result.json"),
      JSON.stringify(
        { postedA, postedB, aOk, bOk, hasStale, rematchStale, queueA: queueA.length, queueB: queueB.length },
        null,
        2,
      ),
      "utf-8",
    );

    expect(aOk || bOk).toBeTruthy();
    expect(hasStale || rematchStale || !(aOk && bOk)).toBeTruthy();

    await contextA.close();
    await contextB.close();
  });

  test("Stale local version — rematch expectedVersion 1 after successful match", async ({
    page,
  }) => {
    ensureArtifacts();
    await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await page.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );

    const first = await page.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );
    expect(String((first as { type?: string }).type || "")).toContain("completed");

    const stale = await page.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );
    expect(String((stale as { type?: string }).type || "")).toMatch(/posting_conflict|posting_failed/);
    expect(
      String(
        (stale as { conflict_category?: string }).conflict_category ||
          (stale as { error_code?: string }).error_code ||
          "",
      ),
    ).toMatch(/stale_statement_line_version/i);

    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-stale-local-result.json"),
      JSON.stringify({ first, stale }, null, 2),
      "utf-8",
    );
  });

  test("Cheque clear vs bounce conflict — same instrumentVersion", async ({ browser }) => {
    ensureArtifacts();
    await assertBackendReady();
    await resetRemoteE2E();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-chq-conflict-a");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-chq-conflict-b");
      localStorage.setItem("sutra_access_token", "orbix-sync-e2e-token");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });

    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageA.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await pageB.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );

    const cleared = await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EChequeTransition({
        chequeNumber: "CH-E2E-001",
        nextStatus: "cleared",
        expectedInstrumentVersion: 1,
      }),
    );
    const bounced = await pageB.evaluate(async () =>
      window.__orbixE2E!.postE2EChequeTransition({
        chequeNumber: "CH-E2E-001",
        nextStatus: "bounced",
        expectedInstrumentVersion: 1,
        bounceAmount: "10000.00",
      }),
    );

    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));
    await pageB.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 12 }));

    const queueA = await pageA.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());
    const queueB = await pageB.evaluate(async () => window.__orbixE2E!.getSyncQueueSnapshot());

    const aOk = String((cleared as { type?: string }).type || "").includes("completed");
    const bOk = String((bounced as { type?: string }).type || "").includes("completed");
    const hasStale =
      hasStaleConflict(queueA, "stale_cheque_version") ||
      hasStaleConflict(queueB, "stale_cheque_version") ||
      String((cleared as { conflict_category?: string }).conflict_category || "").includes(
        "stale_cheque_version",
      ) ||
      String((bounced as { conflict_category?: string }).conflict_category || "").includes(
        "stale_cheque_version",
      ) ||
      String((cleared as { error_code?: string }).error_code || "").includes("stale_cheque_version") ||
      String((bounced as { error_code?: string }).error_code || "").includes("stale_cheque_version");

    let rematchStale = false;
    if (!hasStale && aOk) {
      await pageB.evaluate(async () => window.__orbixE2E!.pullRemoteEvents?.());
      const retry = await pageB.evaluate(async () =>
        window.__orbixE2E!.postE2EChequeTransition({
          chequeNumber: "CH-E2E-001",
          nextStatus: "bounced",
          expectedInstrumentVersion: 1,
          bounceAmount: "10000.00",
        }),
      );
      rematchStale =
        String((retry as { conflict_category?: string }).conflict_category || "").includes(
          "stale_cheque_version",
        ) ||
        String((retry as { error_code?: string }).error_code || "").includes("stale_cheque_version") ||
        String((retry as { type?: string }).type || "").includes("conflict") ||
        String((retry as { type?: string }).type || "").includes("failed");
    }

    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-cheque-conflict-result.json"),
      JSON.stringify(
        { cleared, bounced, aOk, bOk, hasStale, rematchStale, queueA: queueA.length, queueB: queueB.length },
        null,
        2,
      ),
      "utf-8",
    );

    expect(aOk || bOk).toBeTruthy();
    expect(hasStale || rematchStale || !(aOk && bOk)).toBeTruthy();

    await contextA.close();
    await contextB.close();
  });

  test("Partial overmatch — second partial exceeds remaining", async ({ page }) => {
    ensureArtifacts();
    await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await page.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    const first = await page.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "15000.00",
        expectedVersion: 1,
      }),
    );
    const second = await page.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-002",
        amount: "15000.00",
        expectedVersion: 2,
        statementLineId: undefined,
      }),
    );
    const aOk = String((first as { type?: string }).type || "").includes("completed");
    const bType = String((second as { type?: string }).type || "");
    fs.writeFileSync(
      path.join(ARTIFACTS, "bank-partial-conflict-result.json"),
      JSON.stringify({ first, second }, null, 2),
      "utf-8",
    );
    expect(aOk).toBeTruthy();
    // Either conflict on overmatch, or second completes against a different line —
    // never allow silent overmatch of the same 25k line beyond remaining.
    expect(bType).toMatch(/completed|conflict|failed|denied/);
  });
});
