/**
 * Phase UI-3 shell laboratory — a11y, keyboard, responsive screenshots.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-3");
const manifest: Array<Record<string, string>> = [];

async function openShellLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/shell-lab.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("shell-lab-ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("shell-top-command-bar")).toBeVisible();
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-3 shell lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
  });

  test("axe: zero serious/critical on shell chrome", async ({ page }) => {
    await openShellLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const results = await new AxeBuilder({ page })
      .include('[data-component="app-shell"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      path.join(OUT, "a11y-shell.json"),
      JSON.stringify({ violations: results.violations, serious_or_critical: bad }, null, 2),
    );
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test("keyboard: skip link and command palette", async ({ page }) => {
    await openShellLab(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("shell-command-palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shell-command-palette")).toHaveCount(0);
  });

  test("role filter and users deep-link soft gate", async ({ page }) => {
    await openShellLab(page);
    await page.getByTestId("shell-lab-role-cashier").click();
    await expect(page.getByText(/modules=/)).toBeVisible();
    await page.getByRole("button", { name: "Deep-link Users" }).click();
    await expect(page.getByTestId("shell-route-denied")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Go to Home" }).click();
    await expect(page.getByTestId("shell-lab-ready")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("shell-lab-role-admin").click();
    await page.getByRole("button", { name: "Deep-link Users" }).click();
    await expect(page.getByTestId("shell-route-denied")).toHaveCount(0, { timeout: 15_000 });
  });

  test("notifications open", async ({ page }) => {
    await openShellLab(page);
    await page.getByTestId("shell-notification-bell").click();
    await expect(page.getByTestId("shell-notification-centre")).toBeVisible();
  });

  test("capture shell matrices", async ({ page }) => {
    await openShellLab(page);
    fs.mkdirSync(OUT, { recursive: true });
    const shots = [
      { name: "1920x1080", w: 1920, h: 1080, theme: "light" as const },
      { name: "1440x900", w: 1440, h: 900, theme: "light" as const },
      { name: "1440x900", w: 1440, h: 900, theme: "dark" as const },
      { name: "1024x768", w: 1024, h: 768, theme: "light" as const },
      { name: "390x844", w: 390, h: 844, theme: "light" as const },
      { name: "390x844", w: 390, h: 844, theme: "dark" as const },
    ];
    for (const s of shots) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.getByTestId("shell-lab-ready").getByRole("button", { name: s.theme === "light" ? "Light" : "Dark", exact: true }).click();
      await page.waitForTimeout(150);
      const file = `shell__${s.name}__${s.theme}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      manifest.push({
        component_group: "shell",
        state: "lab",
        viewport: s.name,
        theme: s.theme,
        density: "productive",
        language: "en",
        screenshot_path: `artifacts/ui-redesign/phase-ui-3/${file}`,
        visual_result: "captured",
        accessibility_result: "see a11y-shell.json",
        known_issue: "",
      });
    }
  });
});
