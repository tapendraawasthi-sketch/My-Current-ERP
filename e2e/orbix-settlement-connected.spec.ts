/**
 * Phase 9 connected Settlement Orbix UI gates.
 *
 * Requires:
 *   ORBIX_E2E_CONNECTED=true
 *   ORBIX_SETTLEMENT_E2E=true
 *   Live erp_bot with financial_draft support
 *
 * Artifacts: artifacts/orbix-phase9/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { assertE2ECompanyActive } from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const settlementE2E = process.env.ORBIX_SETTLEMENT_E2E === "true";
const enabled = connected && settlementE2E;
const ARTIFACTS = path.resolve("artifacts/orbix-phase9");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

async function shot(page: import("@playwright/test").Page, name: string) {
  ensureArtifacts();
  await page.screenshot({
    path: path.join(ARTIFACTS, `${name}.png`),
    fullPage: false,
  });
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

async function seedPhase9(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  const map = await page.evaluate(async () => window.__orbixE2E!.seedPhase9SettlementDocs());
  await assertE2ECompanyActive(page);
  return map;
}

async function confirmPost(page: import("@playwright/test").Page) {
  const confirmBtn = page.getByTestId("orbix-confirm-post");
  await expect(confirmBtn).toBeVisible({ timeout: 90_000 });
  await confirmBtn.click();
  await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
}

async function getSettlementSnapshot(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => Boolean(window.__orbixE2E?.getSettlementSnapshot), {
    timeout: 60_000,
  });
  return page.evaluate(async () => window.__orbixE2E!.getSettlementSnapshot());
}

test.describe.configure({ timeout: 240_000 });

test.describe("Phase 9 Orbix settlement (connected)", () => {
  test.skip(
    !enabled,
    "Set ORBIX_E2E_CONNECTED=true and ORBIX_SETTLEMENT_E2E=true with live erp_bot",
  );

  test.describe("A–L chat UI cases", () => {
    test("A. Partial customer receipt SI-E2E-001 Rs 50000 bank", async ({ page }) => {
      ensureArtifacts();
      const seeded = await seedPhase9(page);
      expect(seeded.invoiceIds["SI-E2E-001"]).toBeTruthy();

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Received Rs 50,000 from Ram Traders against SI-E2E-001 by bank",
      );
      await shot(page, "A-receipt-preview");
      await confirmPost(page);
      await shot(page, "A-receipt-posted");

      const snap = await getSettlementSnapshot(page);
      expect((snap.receipts as unknown[]).length).toBeGreaterThanOrEqual(1);
      const out = snap.outstanding as Record<string, { outstanding_paisa?: number }>;
      expect(out["SI-E2E-001"]).toBeTruthy();
    });

    test("B. Multi-invoice receipt", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Adjust Rs 60,000 against SI-E2E-002 and Rs 40,000 against SI-E2E-003 received from Ram Traders by bank",
      );
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.receipts as unknown[]).length).toBeGreaterThanOrEqual(1);
      expect((snap.allocations as unknown[]).length).toBeGreaterThanOrEqual(2);
    });

    test("C. Customer advance cash 25000", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Received Rs 25,000 from Ram Traders as advance in cash");
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.receipts as unknown[]).length).toBeGreaterThanOrEqual(1);
      expect((snap.advances as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("D. Partial supplier payment", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Paid ABC Suppliers Rs 40,000 against PI-E2E-001 by cash");
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.payments as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("E. Supplier payment with withholding 1500", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Paid ABC Suppliers Rs 40,000 against PI-E2E-001 by bank with withholding Rs 1,500",
      );
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.payments as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("F. Supplier advance", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Paid ABC Suppliers Rs 15,000 as advance by cash");
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.payments as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("G. Cash-to-bank contra", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Deposit cash Rs 10,000 to bank");
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.contras as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("H. Bank-to-bank with charge", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Transfer Rs 20,000 from E2E bank A to E2E bank B with bank charge Rs 50",
      );
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.contras as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("I. General journal rent", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "General journal: Debit Rent Expense Rs 10,000 and credit Outstanding Expenses Rs 10,000",
      );
      await confirmPost(page);
      const snap = await getSettlementSnapshot(page);
      expect((snap.journals as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    test("J. Incomplete receipt clarification", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Received from Ram Traders");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await shot(page, "J-clarification");
      const draft = await page.evaluate(() => window.__orbixE2E!.getDraftState());
      expect(String(draft.draftId || draft.activeDraftId || "")).toBeTruthy();

      await sendOrbix(page, "Rs 50,000 against SI-E2E-001 by bank");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
      await shot(page, "J-preview-after-clarify");
    });

    test("K. Ask mode denial", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAsk(page);
      await sendOrbix(
        page,
        "Received Rs 50,000 from Ram Traders against SI-E2E-001 by bank",
      );
      await expect(page.getByTestId("orbix-msg-mode_restriction").first()).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const snap = await getSettlementSnapshot(page);
      expect((snap.receipts as unknown[]).length).toBe(0);
    });

    test("L. Explanation — no mutation draft", async ({ page }) => {
      await seedPhase9(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "How does a customer receipt allocate against invoices?");
      await page.waitForTimeout(2_000);
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      await expect(page.getByTestId("orbix-clarification")).toHaveCount(0);
      const draft = await page.evaluate(() => window.__orbixE2E!.getDraftState());
      const rt = String(draft.response_type || "");
      expect(rt).not.toMatch(/confirmation_required|clarification_required/);
      await shot(page, "L-explanation");
    });
  });
});
