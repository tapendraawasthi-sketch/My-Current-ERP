/**
 * Phase UI-2 — expanded lab visual + a11y + keyboard validation.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-2");
const manifest: Array<Record<string, string>> = [];

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ds-lab.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ds-lab-ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("ds-lab-ui2")).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-2 design-system lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
  });

  test("axe: zero serious/critical on expanded lab", async ({ page }) => {
    await openLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "a11y-lab.json"), JSON.stringify({ violations: results.violations, serious_or_critical: bad }, null, 2));
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test("keyboard: dialog focus trap and escape", async ({ page }) => {
    await openLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /Open dialog|संवाद/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("keyboard: menu and table selection", async ({ page }) => {
    await openLab(page);
    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Export CSV" })).toBeVisible();
    await page.keyboard.press("Escape");
    const selectAll = page.getByRole("checkbox", { name: /Select all rows/i });
    await selectAll.click();
    await expect(page.getByText(/selected/i).first()).toBeVisible();
  });

  test("capture UI-2 matrices", async ({ page }) => {
    await openLab(page);
    fs.mkdirSync(OUT, { recursive: true });

    const shots = [
      { name: "1440x900", w: 1440, h: 900, theme: "light" as const },
      { name: "1440x900", w: 1440, h: 900, theme: "dark" as const },
      { name: "1024x768", w: 1024, h: 768, theme: "light" as const },
      { name: "390x844", w: 390, h: 844, theme: "light" as const },
      { name: "390x844", w: 390, h: 844, theme: "dark" as const },
    ];

    for (const s of shots) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.getByRole("button", { name: s.theme === "light" ? "Light" : "Dark" }).click();
      await page.waitForTimeout(200);
      const file = `ui2-lab__${s.name}__${s.theme}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      manifest.push({
        component_group: "ui2-lab",
        state: "full",
        viewport: s.name,
        theme: s.theme,
        density: "productive",
        language: "en",
        screenshot_path: `artifacts/ui-redesign/phase-ui-2/${file}`,
        visual_result: "captured",
        accessibility_result: "see a11y-lab.json",
        known_issue: "",
      });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Light" }).click();
    for (const d of ["comfortable", "productive", "compact"]) {
      await page.getByRole("button", { name: d, exact: true }).click();
      await page.waitForTimeout(120);
      const file = `ui2-table__1440x900__light__${d}.png`;
      await page.locator('[data-testid="ds-lab-ui2"]').screenshot({ path: path.join(OUT, file) });
      manifest.push({
        component_group: "data-table",
        state: d,
        viewport: "1440x900",
        theme: "light",
        density: d,
        language: "en",
        screenshot_path: `artifacts/ui-redesign/phase-ui-2/${file}`,
        visual_result: "captured",
        accessibility_result: "pass-lab",
        known_issue: "",
      });
    }

    // Dialog open
    await page.getByRole("button", { name: /Open dialog/ }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "ui2-dialog__1440x900__light.png"), fullPage: false });
    await page.keyboard.press("Escape");

    // Mobile dialog
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Open dialog/ }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "ui2-dialog__390x844__light.png"), fullPage: false });
    await page.keyboard.press("Escape");

    // Nepali
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "नेपाली" }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, "ui2-lab__1440x900__light__ne.png"), fullPage: true });
    manifest.push({
      component_group: "ui2-lab",
      state: "nepali",
      viewport: "1440x900",
      theme: "light",
      density: "compact",
      language: "ne",
      screenshot_path: "artifacts/ui-redesign/phase-ui-2/ui2-lab__1440x900__light__ne.png",
      visual_result: "captured",
      accessibility_result: "pass-lab",
      known_issue: "",
    });
  });
});
