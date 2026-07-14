/**
 * Phase UI-5 Home laboratory — role workspaces, a11y, artifacts.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-5");
const RESULTS = path.join(OUT, "home-e2e-results.json");
const manifest: Array<Record<string, string>> = [];
const results: Array<Record<string, unknown>> = [];

function record(name: string, status: "passed" | "failed" | "skipped", detail?: string) {
  results.push({ name, status, detail: detail || null, at: new Date().toISOString() });
}

async function openHomeLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-home.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("home-lab-ready")).toBeVisible({ timeout: 90_000 });
}

async function setRole(page: import("@playwright/test").Page, role: string) {
  await page.evaluate((r) => {
    window.__homeFixture?.setRole(r);
  }, role);
  await expect(page.getByTestId("home-page")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(async () => page.locator('[data-testid="home-lab-ready"]').innerText(), {
      timeout: 30_000,
    })
    .toContain(`role=${role}`);
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-5 home lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
    fs.writeFileSync(RESULTS, JSON.stringify({ results }, null, 2));
  });

  const roles: Array<{ role: string; workspace: string }> = [
    { role: "owner", workspace: "owner" },
    { role: "accountant", workspace: "accountant" },
    { role: "cashier", workspace: "cashier" },
    { role: "auditor", workspace: "auditor" },
    { role: "administrator", workspace: "administrator" },
    { role: "viewer", workspace: "restricted" },
  ];

  for (const { role, workspace } of roles) {
    test(`role ${role} shows home workspace ${workspace}`, async ({ page }) => {
      try {
        await openHomeLab(page);
        await page.setViewportSize({ width: 1440, height: 900 });
        await setRole(page, role);
        await expect(page.getByTestId("home-page")).toBeVisible();
        await expect
          .poll(async () => page.getByTestId("home-page").getAttribute("data-home-workspace"), {
            timeout: 60_000,
          })
          .toBe(workspace);
        record(`role-${role}`, "passed", `workspace=${workspace}`);
      } catch (err) {
        record(`role-${role}`, "failed", err instanceof Error ? err.message : String(err));
        throw err;
      }
    });
  }

  test("cashier workspace hides Net result", async ({ page }) => {
    try {
      await openHomeLab(page);
      await setRole(page, "cashier");
      await expect
        .poll(async () => page.getByTestId("home-page").getAttribute("data-home-workspace"), {
          timeout: 60_000,
        })
        .toBe("cashier");
      const metrics = page.getByTestId("home-financial-metrics");
      if (await metrics.count()) {
        const metricIds = (await metrics.getAttribute("data-metric-ids")) || "";
        const ids = metricIds.split(",").filter(Boolean);
        expect(ids).not.toContain("net_result");
        expect(ids).not.toContain("sales_period");
        expect(ids).not.toContain("inventory_value");
        record("cashier-no-net-result", "passed", `metrics=${metricIds}`);
      } else {
        // Permission-limited empty overview is acceptable for cashier without create/view grants
        record("cashier-no-net-result", "passed", "no financial metrics rendered");
      }
    } catch (err) {
      record("cashier-no-net-result", "failed", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  test("axe: zero serious/critical on home fixture", async ({ page }) => {
    try {
      await openHomeLab(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await setRole(page, "accountant");
      await expect(page.getByTestId("home-page")).toBeVisible({ timeout: 60_000 });
      await expect
        .poll(async () => page.getByTestId("home-page").getAttribute("data-home-workspace"), {
          timeout: 60_000,
        })
        .toBeTruthy();
      const resultsAxe = await new AxeBuilder({ page })
        .include('[data-testid="home-page"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const bad = resultsAxe.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(
        path.join(OUT, "a11y-home.json"),
        JSON.stringify({ violations: resultsAxe.violations, serious_or_critical: bad }, null, 2),
      );
      expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
      record("axe-home", "passed", `violations=${resultsAxe.violations.length}`);
    } catch (err) {
      record("axe-home", "failed", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  test("capture home screenshots", async ({ page }) => {
    try {
      await openHomeLab(page);
      fs.mkdirSync(OUT, { recursive: true });
      const shots = [
        { name: "1440x900", w: 1440, h: 900, role: "owner", theme: "light" as const },
        { name: "1440x900", w: 1440, h: 900, role: "cashier", theme: "light" as const },
        { name: "390x844", w: 390, h: 844, role: "accountant", theme: "light" as const },
        { name: "1440x900", w: 1440, h: 900, role: "auditor", theme: "dark" as const },
      ];
      for (const s of shots) {
        await page.setViewportSize({ width: s.w, height: s.h });
        await page.evaluate((theme) => {
          window.__homeFixture?.setTheme(theme);
        }, s.theme);
        await setRole(page, s.role);
        await page.waitForTimeout(200);
        const file = `home__${s.role}__${s.name}__${s.theme}.png`;
        await page.screenshot({ path: path.join(OUT, file), fullPage: true });
        manifest.push({
          component_group: "home",
          state: s.role,
          viewport: s.name,
          theme: s.theme,
          density: "productive",
          language: "en",
          screenshot_path: `artifacts/ui-redesign/phase-ui-5/${file}`,
          visual_result: "captured",
          accessibility_result: "see a11y-home.json",
          known_issue: "",
        });
      }
      record("screenshots", "passed", `count=${shots.length}`);
    } catch (err) {
      record("screenshots", "failed", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
});
