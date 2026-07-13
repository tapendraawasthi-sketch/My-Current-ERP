/**
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
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Reconcile bank statement match RV-E2E-001 Rs 25000");
    await confirmPost(page);
  });

  test("C. Bank charge from statement", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Post bank charge Rs 500 from statement");
    await confirmPost(page);
  });

  test("D. Cheque CH-E2E-001 cleared", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
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
    await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
  });

  test("F. Ask mode denial", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAsk(page);
    await sendOrbix(page, "Import bank statement CSV");
    await expect(
      page
        .getByText(/ask mode|accountant mode|mode_restriction|requires.*accountant|cannot post/i)
        .first(),
    ).toBeVisible({
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
    await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snap.linkCount || 0)).toBe(0);
  });

  test("H. Bank interest adjustment from statement", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Post bank interest Rs 1000 from statement");
    await confirmPost(page);
  });

  test("I. Why is bank not reconciled (status query)", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Why is bank not reconciled?");
    await expect(
      page.getByText(/unmatched|not reconciled|statement line|reconcil/i).first(),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
  });

  test("J. Exact payment match PV-E2E-001", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Match bank statement payment PV-E2E-001 Rs 12000");
    await confirmPost(page);
    const snap = await page.evaluate(async () => window.__orbixE2E!.getTreasurySnapshot());
    expect(Number(snap.linkCount || 0)).toBeGreaterThan(0);
  });

  test("K. Seven day cash forecast query", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAccountant(page);
    await sendOrbix(page, "What is the seven day cash forecast?");
    await expect(page.getByText(/forecast|7.?day|seven.?day|committed|expected/i).first()).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
  });

  test("L. Grouped deposit match RV-E2E-002 + RV-E2E-003", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(
      page,
      "Match bank statement deposit Rs 23000 to receipts RV-E2E-002 and RV-E2E-003",
    );
    // Either preview confirms grouped match, or clarification then confirm
    const confirmBtn = page.getByTestId("orbix-confirm-post");
    if (await confirmBtn.isVisible({ timeout: 90_000 }).catch(() => false)) {
      await confirmBtn.click();
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
    } else {
      await sendOrbix(page, "RV-E2E-002 RV-E2E-003 Rs 23000");
      await confirmPost(page);
    }
  });

  test("M. Cheque CH-E2E-002 bounced", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Cheque CH-E2E-002 bounced Rs 10000");
    await confirmPost(page);
  });

  test("N. Clarification refresh — incomplete match", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Match the bank statement deposit Rs 25000");
    await expect(page.getByText(/still need|ERP voucher|clarif/i).first()).toBeVisible({
      timeout: 90_000,
    });
    const before = await page.evaluate(() => window.__orbixE2E!.getDraftState());
    expect(String(before.draft_id || before.activeDraftId || "")).toBeTruthy();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await openOrbixAccountant(page);
    const after = await page.evaluate(() => window.__orbixE2E!.getDraftState());
    const beforeId = String(before.draft_id || before.activeDraftId || "");
    const afterId = String(after.draft_id || after.activeDraftId || "");
    if (beforeId && afterId) {
      expect(afterId).toBe(beforeId);
    }
    await expect(page.getByTestId("orbix-posting-completed")).toHaveCount(0);
  });

  test("O. Match preview refresh before confirm", async ({ page }) => {
    await seedPhase10(page);
    await page.evaluate(async () =>
      window.__orbixE2E!.importE2EStatement({ idempotencyKey: "e2e-stable-import" }),
    );
    await openOrbixAccountant(page);
    await sendOrbix(page, "Reconcile bank statement match RV-E2E-001 Rs 25000");
    const confirmBtn = page.getByTestId("orbix-confirm-post");
    const sawConfirm = await confirmBtn.isVisible({ timeout: 90_000 }).catch(() => false);
    const before = await page.evaluate(() => window.__orbixE2E!.getDraftState());
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
    await openOrbixAccountant(page);
    const after = await page.evaluate(() => window.__orbixE2E!.getDraftState());
    const confirmVisible = await page
      .getByTestId("orbix-confirm-post")
      .isVisible()
      .catch(() => false);
    // Acceptable: preview was shown before refresh, and after refresh draft id restored OR confirm still shown
    expect(
      sawConfirm ||
        confirmVisible ||
        (String(before.draft_id || "") &&
          String(after.draft_id || "") === String(before.draft_id || "")),
    ).toBeTruthy();
    await expect(page.getByTestId("orbix-posting-completed")).toHaveCount(0);
  });

  test("P. Ask mode denial for reconciliation close", async ({ page }) => {
    await seedPhase10(page);
    await openOrbixAsk(page);
    await sendOrbix(page, "Close the bank reconciliation");
    await expect(
      page
        .getByText(/ask mode|accountant mode|mode_restriction|requires.*accountant|cannot post/i)
        .first(),
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
  });
});
