/**
 * Phase UI-1 — Design-system lab visual + a11y validation.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-1");

type Entry = {
  component_group: string;
  viewport: string;
  theme: string;
  density: string;
  language: string;
  screenshot: string;
  test_status: string;
};

const manifest: Entry[] = [];

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ds-lab.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ds-lab-ready")).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ timeout: 240_000 });

test.describe("UI-1 design-system lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
  });

  test("axe: zero serious/critical on lab", async ({ page }) => {
    await openLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    fs.writeFileSync(
      path.join(OUT, "a11y-lab.json"),
      JSON.stringify({ violations: results.violations, serious_or_critical: bad }, null, 2),
    );
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test("keyboard: button, iconbutton, select", async ({ page }) => {
    await openLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const primary = page.getByRole("button", { name: /Save|बचत/ }).first();
    await primary.focus();
    await expect(primary).toBeFocused();
    await page.keyboard.press("Enter");

    const search = page.getByRole("button", { name: "Search" });
    await expect(search).toHaveAttribute("aria-label", "Search");

    await page.getByRole("combobox", { name: /Voucher type/i }).click();
    await expect(page.getByRole("option", { name: /Journal|जर्नल/ })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("capture lab matrices", async ({ page }) => {
    await openLab(page);
    fs.mkdirSync(OUT, { recursive: true });

    const shots: Array<{
      vp: { w: number; h: number; name: string };
      theme: "light" | "dark";
      density?: string;
      lang?: string;
    }> = [
      { vp: { w: 1440, h: 900, name: "1440x900" }, theme: "light" },
      { vp: { w: 1440, h: 900, name: "1440x900" }, theme: "dark" },
      { vp: { w: 1024, h: 768, name: "1024x768" }, theme: "light" },
      { vp: { w: 768, h: 1024, name: "768x1024" }, theme: "light" },
      { vp: { w: 390, h: 844, name: "390x844" }, theme: "light" },
      { vp: { w: 390, h: 844, name: "390x844" }, theme: "dark" },
    ];

    for (const s of shots) {
      await page.setViewportSize({ width: s.vp.w, height: s.vp.h });
      await page.getByRole("button", { name: s.theme === "light" ? "Light" : "Dark" }).click();
      await page.waitForTimeout(150);
      const file = `lab__${s.vp.name}__${s.theme}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      manifest.push({
        component_group: "lab-full",
        viewport: s.vp.name,
        theme: s.theme,
        density: "productive",
        language: "en",
        screenshot: `artifacts/ui-redesign/phase-ui-1/${file}`,
        test_status: "captured",
      });
    }

    // Density modes at desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Light" }).click();
    for (const d of ["comfortable", "productive", "compact"]) {
      await page.getByRole("button", { name: d, exact: true }).click();
      await page.waitForTimeout(120);
      const file = `lab__1440x900__light__${d}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      manifest.push({
        component_group: "lab-density",
        viewport: "1440x900",
        theme: "light",
        density: d,
        language: "en",
        screenshot: `artifacts/ui-redesign/phase-ui-1/${file}`,
        test_status: "captured",
      });
    }

    // Nepali
    await page.getByRole("button", { name: "नेपाली" }).click();
    await page.waitForTimeout(120);
    const neFile = "lab__1440x900__light__ne.png";
    await page.screenshot({ path: path.join(OUT, neFile), fullPage: true });
    manifest.push({
      component_group: "lab-nepali",
      viewport: "1440x900",
      theme: "light",
      density: "compact",
      language: "ne",
      screenshot: `artifacts/ui-redesign/phase-ui-1/${neFile}`,
      test_status: "captured",
    });
  });
});
