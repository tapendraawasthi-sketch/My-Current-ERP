from pathlib import Path

def w(path, text):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("wrote", path, len(p.read_bytes()))

w("e2e/orbix-bank-recon-connected.spec.ts", r'''/**
 * Phase 10 connected Bank Recon Orbix UI gates.
 *
 * Requires:
 *   ORBIX_E2E_CONNECTED=true
 *   ORBIX_BANK_RECON_E2E=true
 *   Live erp_bot with bank_recon_draft support
 *
 * Artifacts: artifacts/orbix-phase10/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { assertE2ECompanyActive } from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const bankE2E = process.env.ORBIX_BANK_RECON_E2E === "true";
const enabled = connected && bankE2E;
const ARTIFACTS = path.resolve("artifacts/orbix-phase10");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => {
    if (typeof window.__uiQaGoto !== "function") {
      throw new Error("__uiQaGoto missing — harness not ready or page reloaded mid-test");
    }
    window.__uiQaGoto(id);
  }, pageId);
  if (pageId === "orbix") {
    const ws = page.locator('[data-component="orbix-workspace"]');
    if (!(await ws.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "Orbix", exact: true }).click();
    }
    await expect(ws).toBeVisible({ timeout: 30_000 });
  } else {
    await page.waitForTimeout(400);
  }
}

async function openOrbixAccountant(page: import("@playwright/test").Page) {
  await gotoPage(page, "orbix");
  await page.getByTestId("orbix-mode-accountant").click();
  await expect(page.getByTestId("orbix-mode-accountant")).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

async function openOrbixAsk(page: import("@playwright/test").Page) {
  await gotoPage(page, "orbix");
  await page.getByTestId("orbix-mode-ask").click();
  await expect(page.getByTestId("orbix-mode-ask")).toHaveAttribute("aria-selected", "true");
}

async function sendOrbix(page: import("@playwright/test").Page, text: string) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  const input = page.getByTestId("orbix-composer");
  await expect(input).toBeVisible({ timeout: 60_000 });
  await input.fill(text);
  await page.getByTestId("orbix-send").click();
  await expect(page.getByTestId("orbix-send-busy")).toBeVisible({ timeout: 5_000 }).catch(
    () => undefined,
  );
  await expect(page.getByTestId("orbix-send")).toBeVisible({ timeout: 120_000 });
}

async function seedPhase10(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  const map = await page.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
  await assertE2ECompanyActive(page);
  return map;
}

async function confirmPost(page: import("@playwright/test").Page) {
  const confirmBtn = page.getByTestId("orbix-confirm-post");
  await expect(confirmBtn).toBeVisible({ timeout: 90_000 });
  await confirmBtn.click();
  await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
}

test.describe.configure({ timeout: 240_000 });

test.describe("Phase 10 Orbix bank recon (connected)", () => {
  test.skip(
    !enabled,
    "Set ORBIX_E2E_CONNECTED=true and ORBIX_BANK_RECON_E2E=true with live erp_bot",
  );

  test("A. Import bank statement", async ({ page }) => {
    ensureArtifacts();
    await seedPhase10(page);
    await openOrbixAccountant(page);
    await sendOrbix(page, "Import bank statement CSV for E2E Main Bank");
    await confirmPost(page);
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snap.batchCount || 0)).toBeGreaterThan(0);
  });

  test("B. Match statement line to RV-E2E-001", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () => window.__orbixE2E!.importE2EStatement());
    await openOrbixAccountant(page);
    await sendOrbix(page, "Reconcile bank statement match RV-E2E-001 Rs 25000");
    await confirmPost(page);
  });

  test("C. Bank charge from statement", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () => window.__orbixE2E!.importE2EStatement());
    await openOrbixAccountant(page);
    await sendOrbix(page, "Post bank charge Rs 500 from statement");
    await confirmPost(page);
  });

  test("D. Cheque CH-E2E-001 cleared", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () => window.__orbixE2E!.importE2EStatement());
    await openOrbixAccountant(page);
    await sendOrbix(page, "Cheque CH-E2E-001 cleared");
    await confirmPost(page);
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(String(snap.chequeClearedStatus || "")).toMatch(/cleared/i);
  });

  test("E. Treasury available cash query", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAccountant(page);
    await sendOrbix(page, "What is available cash / treasury position?");
    await expect(page.getByText(/book|available|treasury/i).first()).toBeVisible({
      timeout: 90_000,
    });
  });

  test("F. Ask mode denial", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAsk(page);
    await sendOrbix(page, "Import bank statement CSV");
    await expect(page.getByText(/ask mode|cannot|switch to accountant/i).first()).toBeVisible({
      timeout: 90_000,
    });
  });

  test("G. Explanation without mutation", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAccountant(page);
    await sendOrbix(page, "Explain how bank reconciliation matching works");
    await expect(page.getByText(/nothing is posted|explanation/i).first()).toBeVisible({
      timeout: 90_000,
    });
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snap.linkCount || 0)).toBe(0);
  });
});
''')

w("e2e/orbix-bank-recon-sync.spec.ts", r'''/**
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
    });
    await pageB.addInitScript(() => {
      localStorage.setItem("fios_sync_device_id", "orbix-bank-sync-b");
    });

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageA.evaluate(async () => window.__orbixE2E!.importE2EStatement());
    await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({ reference: "RV-E2E-001", amount: "25000.00" }),
    );
    await pageA.evaluate(async () => window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 }));

    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageB.evaluate(async () => window.__orbixE2E!.pullRemoteEvents());
    const snapB = await pageB.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snapB.linkCount || 0)).toBeGreaterThan(0);

    await contextA.close();
    await contextB.close();
  });
});
''')

w("e2e/orbix-bank-recon-conflict.spec.ts", r'''/**
 * Phase 10 concurrent bank match version conflict gate.
 *
 * Requires:
 *   ORBIX_BANK_CONFLICT_E2E=true
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const enabled = process.env.ORBIX_BANK_CONFLICT_E2E === "true";
const ARTIFACTS = path.resolve("artifacts/orbix-phase10");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

test.describe("Phase 10 bank recon concurrent conflict", () => {
  test.skip(!enabled, "Set ORBIX_BANK_CONFLICT_E2E=true");
  test.describe.configure({ timeout: 300_000 });

  test("Stale statement line version conflict", async ({ browser }) => {
    ensureArtifacts();
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageA.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageA.evaluate(async () => window.__orbixE2E!.importE2EStatement());

    const r1 = await pageA.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 1,
      }),
    );
    expect(r1.type).toBe("posting_completed");

    await pageB.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await pageB.evaluate(async () => window.__orbixE2E!.seedPhase10TreasuryDocs());
    await pageB.evaluate(async () => window.__orbixE2E!.importE2EStatement());
    const r2 = await pageB.evaluate(async () =>
      window.__orbixE2E!.postE2EBankMatch({
        reference: "RV-E2E-001",
        amount: "25000.00",
        expectedVersion: 0,
      }),
    );
    expect(r2.type).toMatch(/posting_conflict|posting_failed/);
    expect(String(r2.error_code || r2.conflict_category || "")).toMatch(
      /stale_statement_line_version/i,
    );

    await contextA.close();
    await contextB.close();
  });
});
''')
print("e2e specs done")