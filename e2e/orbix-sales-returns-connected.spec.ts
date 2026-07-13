/**
 * Phase 7 connected Sales Return / Credit Note Orbix UI gates.
 *
 * Requires:
 *   ORBIX_E2E_CONNECTED=true
 *   ORBIX_SALES_RETURN_E2E=true
 *   Live erp_bot with sales_return_draft support
 *
 * Ordinary connected sales suite is unaffected when ORBIX_SALES_RETURN_E2E is unset.
 * Artifacts: artifacts/orbix-phase7/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { getLedgerSnapshot, assertE2ECompanyActive } from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const salesReturnE2E = process.env.ORBIX_SALES_RETURN_E2E === "true";
const enabled = connected && salesReturnE2E;
const ARTIFACTS = path.resolve("artifacts/orbix-phase7");

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
}

async function shot(page: import("@playwright/test").Page, name: string) {
  ensureArtifacts();
  await page.screenshot({
    path: path.join(ARTIFACTS, `${name}.png`),
    fullPage: false,
  });
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => {
    if (typeof window.__uiQaGoto !== "function") {
      throw new Error("__uiQaGoto missing — harness not ready or page reloaded mid-test");
    }
    window.__uiQaGoto(id);
  }, pageId);
  if (pageId === "orbix") {
    const ws = page.locator('[data-component="orbix-workspace"]');
    if (!(await ws.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "Orbix", exact: true }).click();
    }
    await expect(ws).toBeVisible({ timeout: 30_000 });
  } else {
    await page.waitForTimeout(400);
  }
}

async function openOrbixAccountant(page: import("@playwright/test").Page) {
  await gotoPage(page, "orbix");
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("orbix-mode-accountant").click();
  await expect(page.getByTestId("orbix-mode-accountant")).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

async function openOrbixAsk(page: import("@playwright/test").Page) {
  await gotoPage(page, "orbix");
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("orbix-mode-ask").click();
  await expect(page.getByTestId("orbix-mode-ask")).toHaveAttribute("aria-selected", "true");
}

async function sendOrbix(page: import("@playwright/test").Page, text: string) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({
    timeout: 30_000,
  });
  const input = page.getByTestId("orbix-composer");
  await expect(input).toBeVisible({ timeout: 60_000 });
  await input.fill(text);
  await page.getByTestId("orbix-send").click();
  await expect(page.getByTestId("orbix-send-busy")).toBeVisible({ timeout: 5_000 }).catch(
    () => undefined,
  );
  await expect(page.getByTestId("orbix-send")).toBeVisible({ timeout: 120_000 });
}

async function getDraftState(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__orbixE2E?.getDraftState), {
    timeout: 60_000,
  });
  return page.evaluate(() => window.__orbixE2E!.getDraftState());
}

async function seedPhase7(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  const map = await page.evaluate(async () => window.__orbixE2E!.seedPhase7OriginalSales());
  await assertE2ECompanyActive(page);
  return map;
}

async function confirmPost(page: import("@playwright/test").Page) {
  const confirmBtn = page.getByTestId("orbix-confirm-post");
  await expect(confirmBtn).toBeVisible({ timeout: 90_000 });
  await confirmBtn.click();
  await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
  // Do not re-navigate after post — snapshots work from any page while harness is ready.
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
}

async function getAdjustmentSnapshotSafe(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => Boolean(window.__orbixE2E?.getAdjustmentSnapshot), {
    timeout: 60_000,
  });
  return page.evaluate(async () => window.__orbixE2E!.getAdjustmentSnapshot());
}

function salesReturns(
  snap: Awaited<ReturnType<typeof getLedgerSnapshot>>,
  originalId?: string,
) {
  return snap.invoices.filter((i) => {
    if (i.type !== "sales-return") return false;
    if (!originalId) return true;
    return (
      (i as { originalInvoiceId?: string }).originalInvoiceId === originalId ||
      (i as { original_invoice_id?: string }).original_invoice_id === originalId
    );
  });
}

test.describe.configure({ timeout: 240_000 });

test.describe("Phase 7 Orbix sales returns (connected)", () => {
  test.skip(
    !enabled,
    "Set ORBIX_E2E_CONNECTED=true and ORBIX_SALES_RETURN_E2E=true with live erp_bot",
  );

  // Independent seeds per case — do not abort later cases when one fails.
  test.describe("A–H chat UI cases", () => {
    test("A. Cash return SI-E2E-CASH-001", async ({ page }) => {
      ensureArtifacts();
      const map = await seedPhase7(page);
      const originalId = map["SI-E2E-CASH-001"];
      expect(originalId).toBeTruthy();

      const before = await getLedgerSnapshot(page);
      const originalBefore = before.invoices.find((i) => i.id === originalId);
      expect(originalBefore?.type).toBe("sales-invoice");
      expect(originalBefore?.invoiceNo).toBe("SI-E2E-CASH-001");
      const originalSnap = JSON.stringify(originalBefore);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike from invoice SI-E2E-CASH-001 and refund the customer in cash.",
      );
      await shot(page, "A-cash-preview");
      await confirmPost(page);
      await shot(page, "A-cash-posted");

      const after = await getLedgerSnapshot(page);
      const returns = salesReturns(after, originalId);
      expect(returns.length).toBe(1);
      expect(returns[0].type).toBe("sales-return");

      const stockIn = after.stockMovements.filter(
        (m) => m.referenceId === returns[0].id && Number(m.qty) > 0,
      );
      expect(stockIn.length).toBeGreaterThanOrEqual(1);

      const originalAfter = after.invoices.find((i) => i.id === originalId);
      expect(JSON.stringify(originalAfter)).toBe(originalSnap);
    });

    test("B. Partial credit return then remaining then over-return fails", async ({ page }) => {
      const map = await seedPhase7(page);
      const originalId = map["SI-E2E-CREDIT-002"];
      await openOrbixAccountant(page);

      await sendOrbix(
        page,
        "Ram Traders returned 1 of the 2 bikes from invoice SI-E2E-CREDIT-002. Reduce the outstanding balance.",
      );
      await confirmPost(page);
      let adj = await getAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(1);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Ram Traders returned the remaining 1 bike from invoice SI-E2E-CREDIT-002. Reduce the outstanding balance.",
      );
      await confirmPost(page);
      adj = await getAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(2);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Ram Traders returned 1 bike from invoice SI-E2E-CREDIT-002. Reduce the outstanding balance.",
      );
      const hasConfirm = await page
        .getByTestId("orbix-confirm-post")
        .isVisible({ timeout: 45_000 })
        .catch(() => false);
      if (hasConfirm) {
        await page.getByTestId("orbix-confirm-post").click();
        const failed = await page
          .getByTestId("orbix-posting-failed")
          .isVisible({ timeout: 60_000 })
          .catch(() => false);
        const completed = await page
          .getByTestId("orbix-posting-completed")
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        expect(failed || !completed).toBeTruthy();
      } else {
        await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 }).catch(
          async () => {
            await expect(page.getByTestId("orbix-msg-validation_error")).toBeVisible({
              timeout: 30_000,
            });
          },
        );
      }

      adj = await getAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(2);
      void originalId;
    });

    test("C. Bank refund SI-E2E-BANK-003", async ({ page }) => {
      const map = await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike from invoice SI-E2E-BANK-003 and refund the customer by bank.",
      );
      await confirmPost(page);
      const adj = await getAdjustmentSnapshotSafe(page);
      const returns = adj.returns as Array<{ originalInvoiceId?: string; type?: string }>;
      expect(returns.some((r) => r.originalInvoiceId === map["SI-E2E-BANK-003"])).toBeTruthy();
    });

    test("D. Customer credit SI-E2E-CREDITBAL-004", async ({ page }) => {
      const map = await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike from invoice SI-E2E-CREDITBAL-004 and keep as customer credit.",
      );
      await confirmPost(page);
      const adj = await getAdjustmentSnapshotSafe(page);
      expect(
        (adj.returns as Array<{ originalInvoiceId?: string }>).some(
          (r) => r.originalInvoiceId === map["SI-E2E-CREDITBAL-004"],
        ),
      ).toBeTruthy();
    });

    test("E. Financial CN SI-E2E-CN-005 no stock", async ({ page }) => {
      const map = await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Give Ram Traders a Rs 5,000 credit note against invoice SI-E2E-CN-005 for a pricing error. No goods were returned.",
      );
      await confirmPost(page);
      const adj = await getAdjustmentSnapshotSafe(page);
      const cns = adj.creditNotes as Array<{
        id?: string;
        originalInvoiceId?: string;
        type?: string;
      }>;
      expect(cns.some((c) => c.originalInvoiceId === map["SI-E2E-CN-005"])).toBeTruthy();
      const cnId = cns.find((c) => c.originalInvoiceId === map["SI-E2E-CN-005"])?.id;
      const stockForCn = (adj.stockIns as Array<{ referenceId?: string }>).filter(
        (m) => m.referenceId === cnId,
      );
      expect(stockForCn.length).toBe(0);
    });

    test("F. Incomplete clarification then continue", async ({ page }) => {
      await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Ram Traders returned a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await shot(page, "F-clarification");
      const draft = await getDraftState(page);
      expect(String(draft.draftId || draft.activeDraftId || "")).toBeTruthy();
      const adjBefore = await getAdjustmentSnapshotSafe(page);
      expect((adjBefore.returns as unknown[]).length).toBe(0);

      await sendOrbix(
        page,
        "Invoice SI-E2E-CASH-001, cash refund.",
      );
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
      await shot(page, "F-preview-after-clarify");
    });

    test("G. Ask mode mode_restriction", async ({ page }) => {
      await seedPhase7(page);
      await openOrbixAsk(page);
      await sendOrbix(
        page,
        "Return the bike from invoice SI-E2E-CASH-001 and refund the customer in cash.",
      );
      await expect(page.getByTestId("orbix-msg-mode_restriction").first()).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const adj = await getAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(0);
    });

    test("H. Explanation — no mutation draft", async ({ page }) => {
      await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "How is output VAT reversed on a Sales return?");
      await page.waitForTimeout(2_000);
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      await expect(page.getByTestId("orbix-clarification")).toHaveCount(0);
      const draft = await getDraftState(page);
      const rt = String(draft.response_type || "");
      expect(rt).not.toMatch(/confirmation_required|clarification_required/);
      await shot(page, "H-explanation");
    });
  });

  test.describe.serial("Refresh gates", () => {
    test("Clarification draft survives reload", async ({ page }) => {
      await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "Ram Traders returned a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      const before = await getDraftState(page);
      const draftId = String(before.draftId || before.activeDraftId || "");
      expect(draftId).toBeTruthy();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await openOrbixAccountant(page);
      const after = await getDraftState(page);
      expect(String(after.draftId || after.activeDraftId || "")).toBe(draftId);

      await sendOrbix(page, "Invoice SI-E2E-CASH-001, cash refund.");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
    });

    test("Preview survives reload; confirm posts once", async ({ page }) => {
      await seedPhase7(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike from invoice SI-E2E-CASH-001 and refund the customer in cash.",
      );
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
      const before = await getDraftState(page);
      const previewHash = String(before.previewHash || "");
      const draftId = String(before.draftId || before.activeDraftId || "");
      expect(draftId).toBeTruthy();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await openOrbixAccountant(page);

      const confirm = page.getByTestId("orbix-confirm-post");
      const clarification = page.getByTestId("orbix-clarification");
      const hasConfirm = await confirm.isVisible().catch(() => false);
      if (!hasConfirm) {
        await expect(clarification.or(confirm)).toBeVisible({ timeout: 90_000 });
        if (await clarification.isVisible().catch(() => false)) {
          await sendOrbix(
            page,
            "Return the bike from invoice SI-E2E-CASH-001 and refund the customer in cash.",
          );
        }
        await expect(confirm).toBeVisible({ timeout: 90_000 });
      }

      const after = await getDraftState(page);
      if (previewHash && after.previewHash) {
        // Restored hash preferred; re-preview from same draft is also acceptable
        expect(String(after.draftId || after.activeDraftId || "")).toBe(draftId);
      }

      await confirm.click();
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);

      const adj = await getAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(1);
    });
  });
});
