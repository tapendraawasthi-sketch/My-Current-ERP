import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-qa");

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-component="app-shell"]')).toBeVisible();
}

async function shot(
  page: import("@playwright/test").Page,
  name: string,
) {
  ensureOut();
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
}

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("orbix_theme_pref", t);
    localStorage.setItem("sutra_theme", t);
  }, theme);
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => {
    window.__uiQaGoto?.(id);
  }, pageId);
  await page.waitForTimeout(350);
}

async function measureOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 2,
    };
  });
}

test.describe.configure({ timeout: 180_000 });

test.describe("Orbix UI visual QA", () => {
  test.beforeEach(async ({ page }) => {
    ensureOut();
    await openUiQa(page);
  });

  test("shell + home + orbix across viewports and themes", async ({ page }) => {
    const matrix: Array<{
      screen: string;
      viewport: string;
      theme: string;
      overflow: boolean;
      file: string;
    }> = [];

    const viewports = [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "1280x720", width: 1280, height: 720 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "768x1024", width: 768, height: 1024 },
      { name: "390x844", width: 390, height: 844 },
    ];

    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        await gotoPage(page, "dashboard");
        let overflow = await measureOverflow(page);
        let file = `home-${theme}-${vp.name}`;
        await shot(page, file);
        matrix.push({
          screen: "home",
          viewport: vp.name,
          theme,
          overflow: overflow.overflowX,
          file: `${file}.png`,
        });
        expect(overflow.overflowX, `home overflow ${theme} ${vp.name}`).toBe(false);

        await gotoPage(page, "orbix");
        await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({
          timeout: 15_000,
        });
        overflow = await measureOverflow(page);
        file = `orbix-empty-${theme}-${vp.name}`;
        await shot(page, file);
        matrix.push({
          screen: "orbix-empty",
          viewport: vp.name,
          theme,
          overflow: overflow.overflowX,
          file: `${file}.png`,
        });
        expect(overflow.overflowX, `orbix overflow ${theme} ${vp.name}`).toBe(false);
      }
    }

    // Focused interaction captures at 1366
    await page.setViewportSize({ width: 1366, height: 768 });
    await setTheme(page, "light");
    await gotoPage(page, "orbix");

    // Mode switcher visible
    await expect(page.locator('[data-component="orbix-mode-selector"]')).toBeVisible();
    await shot(page, "orbix-mode-selector-1366-light");

    // Ask mode restriction card path (local store may answer without LLM)
    const input = page.locator('[data-component="ekhata-input"]');
    await input.fill("I bought peanuts for Rs 500.");
    await page.locator('[aria-label="Send message"]').click();
    await page.waitForTimeout(2500);
    await shot(page, "orbix-ask-mutation-attempt-1366");

    // Switch accountant
    await page.getByRole("tab", { name: /Accountant/i }).click();
    await page.waitForTimeout(300);
    await shot(page, "orbix-accountant-mode-1366");

    // Command palette
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: /Command palette/i })).toBeVisible();
    await shot(page, "command-palette-1366");
    await page.keyboard.press("Escape");

    // Sync popover
    await page.locator('[aria-label^="Sync status"]').click();
    await page.waitForTimeout(200);
    await shot(page, "sync-popover-1366");
    await page.getByLabel("Close sync panel").click();
    await page.waitForTimeout(150);

    // ERP pages
    for (const p of ["parties", "journal", "billing", "accounts", "balance-sheet", "items"]) {
      await gotoPage(page, p);
      await shot(page, `erp-${p}-1366-light`);
      const o = await measureOverflow(page);
      expect(o.overflowX, `${p} overflow`).toBe(false);
    }

    // Mobile nav drawer
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, "dashboard");
    await page.getByLabel("Open navigation").click();
    await page.waitForTimeout(300);
    await shot(page, "mobile-nav-drawer-open");
    await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toHaveCount(0);

    await gotoPage(page, "orbix");
    await shot(page, "mobile-orbix-390");

    fs.writeFileSync(path.join(OUT, "qa-matrix.json"), JSON.stringify(matrix, null, 2));
  });

  test("collapsed sidenav and inspector density at 1366", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await setTheme(page, "light");
    await gotoPage(page, "dashboard");

    const collapse = page.getByLabel("Collapse navigation");
    if (await collapse.isVisible()) {
      await collapse.click();
      await page.waitForTimeout(250);
    }
    await shot(page, "sidenav-collapsed-1366");
    const overflow = await measureOverflow(page);
    expect(overflow.overflowX).toBe(false);
  });
});
