/**
 * Phase 4.12 — migrated ItemSelect / Stock Journal responsive + theme QA.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-qa/phase4-12");

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
}

async function shot(page: import("@playwright/test").Page, name: string) {
  ensureOut();
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("orbix_theme_pref", t);
    localStorage.setItem("sutra_theme", t);
  }, theme);
}

test.describe("Phase 4.12 migrated UI QA", () => {
  test.describe.configure({ timeout: 240_000 });

  test("ItemSelect + StockJournal across viewports and themes", async ({ page }) => {
    ensureOut();
    await openUiQa(page);

    const viewports = [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "768x1024", width: 768, height: 1024 },
      { name: "390x844", width: 390, height: 844 },
    ];

    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.evaluate(() => window.__uiQaGoto?.("stock-journal"));
        await expect(page.getByRole("heading", { name: "Stock Journal" })).toBeVisible({
          timeout: 20_000,
        });
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 2;
        });
        expect(overflow).toBe(false);
        await shot(page, `stock-journal-${theme}-${vp.name}`);

        const newBtn = page.getByRole("button", { name: /New stock journal/i });
        if (await newBtn.isVisible().catch(() => false)) {
          await newBtn.click();
        } else {
          await page.getByText(/New stock journal/i).first().click();
        }
        await expect(page.getByTestId("item-select").first()).toBeVisible({ timeout: 15_000 });
        await page.getByTestId("item-select").first().getByRole("button").first().click();
        await shot(page, `item-select-${theme}-${vp.name}`);

        await page.getByRole("button", { name: /Back to list/i }).click();
      }
    }
  });
});
