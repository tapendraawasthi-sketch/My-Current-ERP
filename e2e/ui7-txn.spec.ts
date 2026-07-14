/**
 * Phase UI-7 — shared transaction workspace lab E2E.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-7");
const RESULTS = path.join(OUT, "transaction-e2e-results.json");
const manifest: Array<Record<string, string>> = [];
const results: Array<Record<string, unknown>> = [];

function record(scenario: string, status: "passed" | "failed", extra?: Record<string, unknown>) {
  results.push({ scenario, status, pass: status === "passed", at: new Date().toISOString(), ...extra });
}

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-txn.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("txn-lab-ready")).toBeVisible({ timeout: 90_000 });
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-7 transaction workspace lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
    fs.writeFileSync(RESULTS, JSON.stringify({ results }, null, 2));
  });

  test("workspace shell renders for sales", async ({ page }) => {
    try {
      await openLab(page);
      await expect(page.getByTestId("txn-workspace-sales")).toBeVisible();
      await expect(page.getByTestId("txn-document-canvas")).toBeVisible();
      await expect(page.getByTestId("txn-company")).toContainText(/Himalayan/i);
      record("sales-shell", "passed", { family: "sales" });
    } catch (err) {
      record("sales-shell", "failed", { notes: String(err) });
      throw err;
    }
  });

  for (const family of ["purchase", "receipt", "payment", "contra", "journal"]) {
    test(`workspace switches to ${family}`, async ({ page }) => {
      try {
        await openLab(page);
        await page.evaluate((f) => window.__txnFixture?.setFamily(f), family);
        await expect(page.getByTestId(`txn-workspace-${family}`)).toBeVisible();
        record(`${family}-shell`, "passed", { family });
      } catch (err) {
        record(`${family}-shell`, "failed", { notes: String(err) });
        throw err;
      }
    });
  }

  test("posted locally distinct from synced and conflict", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__txnFixture?.seedPosted("pending"));
      await expect(page.getByTestId("txn-posting-result")).toBeVisible();
      await expect(page.getByTestId("txn-lifecycle")).toHaveAttribute("data-lifecycle", "pending");

      await page.evaluate(() => window.__txnFixture?.seedPosted("synced"));
      await expect(page.getByTestId("txn-lifecycle")).toHaveAttribute("data-lifecycle", "synced");

      await page.evaluate(() => window.__txnFixture?.seedPosted("conflict"));
      await expect(page.getByTestId("txn-lifecycle")).toHaveAttribute("data-lifecycle", "conflict");
      record("sync-truth", "passed");
    } catch (err) {
      record("sync-truth", "failed", { notes: String(err) });
      throw err;
    }
  });

  test("axe: zero serious/critical on transaction fixture", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__txnFixture?.seedPosted("pending"));
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad, JSON.stringify(bad, null, 2)).toHaveLength(0);
      record("axe-txn", "passed", { accessibility_result: `serious_critical=0` });
    } catch (err) {
      record("axe-txn", "failed", { notes: String(err) });
      throw err;
    }
  });

  test("capture screenshots", async ({ page }) => {
    try {
      fs.mkdirSync(OUT, { recursive: true });
      await openLab(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      const light = path.join(OUT, "txn-sales-light.png");
      await page.screenshot({ path: light, fullPage: true });
      manifest.push({ name: "txn-sales-light", path: light });

      await page.evaluate(() => {
        window.__txnFixture?.setFamily("journal");
        window.__txnFixture?.seedPosted("pending");
        window.__txnFixture?.setTheme("dark");
      });
      await page.waitForTimeout(400);
      const dark = path.join(OUT, "txn-journal-dark.png");
      await page.screenshot({ path: dark, fullPage: true });
      manifest.push({ name: "txn-journal-dark", path: dark });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.__txnFixture?.setTheme("light"));
      const mobile = path.join(OUT, "txn-mobile.png");
      await page.screenshot({ path: mobile, fullPage: true });
      manifest.push({ name: "txn-mobile", path: mobile });

      record("screenshots", "passed", { screenshot_count: manifest.length });
    } catch (err) {
      record("screenshots", "failed", { notes: String(err) });
      throw err;
    }
  });
});
