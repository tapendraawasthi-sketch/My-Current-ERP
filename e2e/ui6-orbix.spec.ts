/**
 * Phase UI-6 — Orbix workspace lab E2E (structure, mode, trust, a11y).
 * Connected posting scenarios remain in e2e/orbix-connected.spec.ts.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-redesign/phase-ui-6");
const RESULTS = path.join(OUT, "orbix-e2e-results.json");
const manifest: Array<Record<string, string>> = [];
const results: Array<Record<string, unknown>> = [];

function record(
  scenario: string,
  status: "passed" | "failed" | "skipped",
  extra?: Record<string, unknown>,
) {
  results.push({
    scenario,
    status,
    pass: status === "passed",
    at: new Date().toISOString(),
    ...extra,
  });
}

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-orbix.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("orbix-lab-ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-6 Orbix workspace lab", () => {
  test.afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
    fs.writeFileSync(RESULTS, JSON.stringify({ results }, null, 2));
  });

  test("workspace shell renders with Ask Mode default", async ({ page }) => {
    try {
      await openLab(page);
      await expect(page.getByRole("heading", { name: "Orbix" })).toBeVisible();
      await expect(page.getByTestId("orbix-mode-selector")).toBeVisible();
      await expect(page.getByTestId("orbix-mode-ask")).toHaveAttribute("aria-selected", "true");
      record("workspace-shell", "passed", { mode: "ask" });
    } catch (err) {
      record("workspace-shell", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("Accountant Mode switch is visible and distinct", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.setMode("accountant"));
      await expect
        .poll(async () => page.getByTestId("orbix-mode-accountant").getAttribute("aria-selected"), {
          timeout: 30_000,
        })
        .toBe("true");
      const body = await page.locator('[data-component="orbix-workspace"]').innerText();
      expect(body).toMatch(/Accountant/i);
      expect(body).not.toMatch(/Provider:/i);
      record("mode-switch", "passed", { mode: "accountant" });
    } catch (err) {
      record("mode-switch", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("composer is labelled and reachable", async ({ page }) => {
    try {
      await openLab(page);
      const composer = page.getByTestId("orbix-composer");
      await expect(composer).toBeVisible();
      await expect(composer).toHaveAttribute("aria-label", /Orbix/i);
      await composer.focus();
      await expect(composer).toBeFocused();
      record("composer", "passed");
    } catch (err) {
      record("composer", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("Ask Mode explanation — no confirm chrome", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedExplanation());
      await expect(page.getByTestId("orbix-presentation-accounting_explanation")).toBeVisible();
      await expect(page.getByTestId("orbix-trust-label")).toContainText(/no posting/i);
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      record("ask-explanation", "passed", {
        response_type: "accounting_explanation",
        mutation_count: 0,
      });
    } catch (err) {
      record("ask-explanation", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("Ask Mode mutation restriction — no confirmable draft", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedModeRestriction());
      await expect(page.getByTestId("orbix-presentation-mode_restriction")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      await expect(page.getByTestId("orbix-transaction-preview")).toHaveCount(0);
      record("ask-mode-restriction", "passed", {
        response_type: "mode_restriction",
        confirmation_state: "blocked",
        mutation_count: 0,
      });
    } catch (err) {
      record("ask-mode-restriction", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("clarification — nothing posted", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedClarification());
      await expect(page.getByTestId("orbix-presentation-clarification_required")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      record("clarification", "passed", {
        response_type: "clarification_required",
        mutation_count: 0,
      });
    } catch (err) {
      record("clarification", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("authoritative preview — operation-specific confirm label", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedPreview());
      await expect(page.getByTestId("orbix-transaction-preview")).toBeVisible();
      await expect(page.getByTestId("orbix-journal-preview")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toBeEnabled();
      const label = await page.getByTestId("orbix-confirm-post").innerText();
      expect(label.toLowerCase()).not.toBe("yes");
      expect(label.toLowerCase()).not.toBe("ok");
      record("authoritative-preview", "passed", {
        mode: "accountant",
        confirmation_state: "ready",
        confirm_label: label,
      });
    } catch (err) {
      record("authoritative-preview", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("stale preview — confirm disabled", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedStalePreview());
      await expect(page.getByTestId("orbix-stale-preview")).toBeVisible();
      await expect(page.getByTestId("orbix-stale-preview-banner")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toBeDisabled();
      record("stale-preview", "passed", {
        confirmation_state: "disabled",
        mutation_count: 0,
      });
    } catch (err) {
      record("stale-preview", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("posting completed — pending distinct from synced and conflict", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedPostingCompleted("pending"));
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible();
      await expect(page.getByTestId("orbix-sync-status")).toHaveAttribute("data-sync-status", "pending");
      await expect(page.getByTestId("orbix-sync-status")).not.toHaveAttribute(
        "data-sync-status",
        "synced",
      );

      await page.evaluate(() => window.__orbixFixture?.seedPostingCompleted("synced"));
      await expect(page.getByTestId("orbix-sync-status")).toHaveAttribute("data-sync-status", "synced");

      await page.evaluate(() => window.__orbixFixture?.seedPostingCompleted("conflict"));
      await expect(page.getByTestId("orbix-sync-status")).toHaveAttribute("data-sync-status", "conflict");
      const conflictText = await page.getByTestId("orbix-sync-status").innerText();
      expect(conflictText.toLowerCase()).toMatch(/conflict/);
      expect(conflictText.toLowerCase()).not.toMatch(/^failed$/);

      record("posting-sync-states", "passed", {
        sync_states: ["pending", "synced", "conflict"],
      });
    } catch (err) {
      record("posting-sync-states", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("axe: zero serious/critical on Orbix fixture", async ({ page }) => {
    try {
      await openLab(page);
      await page.evaluate(() => window.__orbixFixture?.seedPreview());
      await page.setViewportSize({ width: 1440, height: 900 });
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad, JSON.stringify(bad, null, 2)).toHaveLength(0);
      record("axe-orbix", "passed", {
        accessibility_result: `violations=${axe.violations.length}; serious_critical=0`,
      });
    } catch (err) {
      record("axe-orbix", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  test("capture orbix screenshots", async ({ page }) => {
    try {
      fs.mkdirSync(OUT, { recursive: true });
      await openLab(page);
      await page.setViewportSize({ width: 1440, height: 900 });

      const light = path.join(OUT, "orbix-ask-light.png");
      await page.screenshot({ path: light, fullPage: true });
      manifest.push({ name: "orbix-ask-light", path: light });

      await page.evaluate(() => window.__orbixFixture?.seedExplanation());
      const explain = path.join(OUT, "orbix-explanation.png");
      await page.screenshot({ path: explain, fullPage: true });
      manifest.push({ name: "orbix-explanation", path: explain });

      await page.evaluate(() => window.__orbixFixture?.seedModeRestriction());
      const restrict = path.join(OUT, "orbix-ask-restriction.png");
      await page.screenshot({ path: restrict, fullPage: true });
      manifest.push({ name: "orbix-ask-restriction", path: restrict });

      await page.evaluate(() => {
        window.__orbixFixture?.setMode("accountant");
        window.__orbixFixture?.seedPreview();
      });
      const preview = path.join(OUT, "orbix-preview.png");
      await page.screenshot({ path: preview, fullPage: true });
      manifest.push({ name: "orbix-preview", path: preview });

      await page.evaluate(() => window.__orbixFixture?.seedStalePreview());
      const stale = path.join(OUT, "orbix-stale-preview.png");
      await page.screenshot({ path: stale, fullPage: true });
      manifest.push({ name: "orbix-stale-preview", path: stale });

      await page.evaluate(() => window.__orbixFixture?.seedPostingCompleted("pending"));
      const posted = path.join(OUT, "orbix-posted-pending.png");
      await page.screenshot({ path: posted, fullPage: true });
      manifest.push({ name: "orbix-posted-pending", path: posted });

      await page.evaluate(() => {
        window.__orbixFixture?.setTheme("dark");
        window.__orbixFixture?.seedPostingCompleted("conflict");
      });
      await page.waitForTimeout(400);
      const dark = path.join(OUT, "orbix-accountant-dark.png");
      await page.screenshot({ path: dark, fullPage: true });
      manifest.push({ name: "orbix-accountant-dark", path: dark });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.__orbixFixture?.setTheme("light"));
      await page.waitForTimeout(200);
      const mobile = path.join(OUT, "orbix-mobile.png");
      await page.screenshot({ path: mobile, fullPage: true });
      manifest.push({ name: "orbix-mobile", path: mobile });

      record("screenshots", "passed", { screenshot_count: manifest.length });
    } catch (err) {
      record("screenshots", "failed", {
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
});
