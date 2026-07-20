/**
 * Regression: native selects on billing / journal / bank-reconciliation must have accessible names.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
}

test.describe.configure({ timeout: 180_000 });

test("select-name is clean on billing, journal, bank reconciliation", async ({ page }) => {
  await openUiQa(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const id of ["billing", "journal", "bank-reconciliation"]) {
    await page.evaluate((pageId) => window.__uiQaGoto?.(pageId), id);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withRules(["select-name"]).analyze();
    const nodeCount = results.violations
      .filter((v) => v.id === "select-name")
      .reduce((n, v) => n + v.nodes.length, 0);
    expect(nodeCount, `${id} select-name`).toBe(0);
  }
});
