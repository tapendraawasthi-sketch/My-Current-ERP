import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-qa/after");

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
}

test("after-fix key screenshots", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await openUiQa(page);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });

  await page.evaluate(() => window.__uiQaGoto?.("dashboard"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "home-1366-light.png") });

  await page.evaluate(() => window.__uiQaGoto?.("orbix"));
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "orbix-empty-1366-light.png") });

  // Confirm FAB hidden on Orbix page
  await expect(page.getByLabel("Open Orbix AI accounting workspace")).toHaveCount(0);

  await page.locator('[data-component="ekhata-input"]').fill("I bought peanuts for Rs 500.");
  await page.locator('[aria-label="Send message"]').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "orbix-offline-or-restriction-1366.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__uiQaGoto?.("dashboard"));
  await page.waitForTimeout(300);
  await page.getByLabel("Open navigation").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "mobile-nav-drawer.png") });
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toHaveCount(0);

  await page.evaluate(() => window.__uiQaGoto?.("orbix"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "mobile-orbix-390.png") });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);
});
