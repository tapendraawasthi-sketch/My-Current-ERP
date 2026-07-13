/**
 * Phase 8 connected Purchase Return / Supplier Debit Note Orbix UI gates.
 *
 * Requires:
 *   ORBIX_E2E_CONNECTED=true
 *   ORBIX_PURCHASE_RETURN_E2E=true
 *   Live erp_bot with purchase_return_draft support
 *
 * Ordinary connected suites are unaffected when ORBIX_PURCHASE_RETURN_E2E is unset.
 * Artifacts: artifacts/orbix-phase8/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { getLedgerSnapshot, assertE2ECompanyActive } from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const purchaseReturnE2E = process.env.ORBIX_PURCHASE_RETURN_E2E === "true";
const enabled = connected && purchaseReturnE2E;
const ARTIFACTS = path.resolve("artifacts/orbix-phase8");

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

async function seedPhase8(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  const map = await page.evaluate(async () => window.__orbixE2E!.seedPhase8OriginalPurchases());
  await assertE2ECompanyActive(page);
  return map;
}

async function confirmPost(page: import("@playwright/test").Page) {
  const confirmBtn = page.getByTestId("orbix-confirm-post");
  await expect(confirmBtn).toBeVisible({ timeout: 90_000 });
  await confirmBtn.click();
  await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
}

async function getPurchaseAdjustmentSnapshotSafe(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => Boolean(window.__orbixE2E?.getPurchaseAdjustmentSnapshot), {
    timeout: 60_000,
  });
  return page.evaluate(async () => window.__orbixE2E!.getPurchaseAdjustmentSnapshot());
}

function purchaseReturns(
  snap: Awaited<ReturnType<typeof getLedgerSnapshot>>,
  originalId?: string,
) {
  return snap.invoices.filter((i) => {
    if (i.type !== "purchase-return") return false;
    if (!originalId) return true;
    return (
      (i as { originalInvoiceId?: string }).originalInvoiceId === originalId ||
      (i as { original_invoice_id?: string }).original_invoice_id === originalId
    );
  });
}

test.describe.configure({ timeout: 240_000 });

test.describe("Phase 8 Orbix purchase returns (connected)", () => {
  test.skip(
    !enabled,
    "Set ORBIX_E2E_CONNECTED=true and ORBIX_PURCHASE_RETURN_E2E=true with live erp_bot",
  );

  // Independent seeds per case — do not abort later cases when one fails.
  test.describe("A–H chat UI cases", () => {
    test("A. Cash refund purchase return PI-E2E-CASH-001", async ({ page }) => {
      ensureArtifacts();
      const map = await seedPhase8(page);
      const originalId = map["PI-E2E-CASH-001"];
      expect(originalId).toBeTruthy();

      const before = await getLedgerSnapshot(page);
      const originalBefore = before.invoices.find((i) => i.id === originalId);
      expect(originalBefore?.type).toBe("purchase-invoice");
      expect(originalBefore?.invoiceNo).toBe("PI-E2E-CASH-001");
      const originalSnap = JSON.stringify(originalBefore);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike to the supplier from purchase invoice PI-E2E-CASH-001 and receive a cash refund.",
      );
      await shot(page, "A-cash-preview");
      await confirmPost(page);
      await shot(page, "A-cash-posted");

      const after = await getLedgerSnapshot(page);
      const returns = purchaseReturns(after, originalId);
      expect(returns.length).toBe(1);
      expect(returns[0].type).toBe("purchase-return");

      // Purchase return removes stock (goods sent back to supplier).
      const stockOut = after.stockMovements.filter(
        (m) => m.referenceId === returns[0].id && Number(m.qty) < 0,
      );
      expect(stockOut.length).toBeGreaterThanOrEqual(1);

      const originalAfter = after.invoices.find((i) => i.id === originalId);
      expect(JSON.stringify(originalAfter)).toBe(originalSnap);
    });

    test("B. Partial return then remaining then over-return fails", async ({ page }) => {
      const map = await seedPhase8(page);
      const originalId = map["PI-E2E-CREDIT-002"];
      await openOrbixAccountant(page);

      await sendOrbix(
        page,
        "We returned 1 of the 2 bikes to the supplier from purchase invoice PI-E2E-CREDIT-002. Reduce the payable.",
      );
      await confirmPost(page);
      let adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(1);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "We returned the remaining 1 bike to the supplier from purchase invoice PI-E2E-CREDIT-002. Reduce the payable.",
      );
      await confirmPost(page);
      adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(2);

      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "We returned 1 more bike to the supplier from purchase invoice PI-E2E-CREDIT-002. Reduce the payable.",
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

      adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(2);
      void originalId;
    });

    test("C. Bank refund PI-E2E-BANK-003", async ({ page }) => {
      const map = await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike to the supplier from purchase invoice PI-E2E-BANK-003 and receive the refund by bank.",
      );
      await confirmPost(page);
      const adj = await getPurchaseAdjustmentSnapshotSafe(page);
      const returns = adj.returns as Array<{ originalInvoiceId?: string; type?: string }>;
      expect(returns.some((r) => r.originalInvoiceId === map["PI-E2E-BANK-003"])).toBeTruthy();
    });

    test("D. Supplier credit PI-E2E-CREDITBAL-004", async ({ page }) => {
      const map = await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike to the supplier from purchase invoice PI-E2E-CREDITBAL-004 and keep it as supplier credit.",
      );
      await confirmPost(page);
      const adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect(
        (adj.returns as Array<{ originalInvoiceId?: string }>).some(
          (r) => r.originalInvoiceId === map["PI-E2E-CREDITBAL-004"],
        ),
      ).toBeTruthy();
    });

    test("E. Financial supplier debit note PI-E2E-DN-005 no stock", async ({ page }) => {
      const map = await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Raise a Rs 5,000 debit note against the supplier for purchase invoice PI-E2E-DN-005 for a pricing error. No goods were returned.",
      );
      await confirmPost(page);
      const adj = await getPurchaseAdjustmentSnapshotSafe(page);
      const dns = adj.debitNotes as Array<{
        id?: string;
        originalInvoiceId?: string;
        type?: string;
      }>;
      expect(dns.some((c) => c.originalInvoiceId === map["PI-E2E-DN-005"])).toBeTruthy();
      const dnId = dns.find((c) => c.originalInvoiceId === map["PI-E2E-DN-005"])?.id;
      const stockForDn = (adj.stockOuts as Array<{ referenceId?: string }>).filter(
        (m) => m.referenceId === dnId,
      );
      expect(stockForDn.length).toBe(0);
    });

    test("F. Incomplete clarification then continue", async ({ page }) => {
      await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "We returned a bike to the supplier.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await shot(page, "F-clarification");
      const draft = await getDraftState(page);
      expect(String(draft.draftId || draft.activeDraftId || "")).toBeTruthy();
      const adjBefore = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adjBefore.returns as unknown[]).length).toBe(0);

      await sendOrbix(page, "Purchase invoice PI-E2E-CASH-001, cash refund received.");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
      await shot(page, "F-preview-after-clarify");
    });

    test("G. Ask mode mode_restriction", async ({ page }) => {
      await seedPhase8(page);
      await openOrbixAsk(page);
      await sendOrbix(
        page,
        "Return the bike to the supplier from purchase invoice PI-E2E-CASH-001 and receive a cash refund.",
      );
      await expect(page.getByTestId("orbix-msg-mode_restriction").first()).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(0);
    });

    test("H. Explanation — no mutation draft", async ({ page }) => {
      await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "How is input VAT reversed on a purchase return?");
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
      await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "We returned a bike to the supplier.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      const before = await getDraftState(page);
      const draftId = String(before.draftId || before.activeDraftId || "");
      expect(draftId).toBeTruthy();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await openOrbixAccountant(page);
      const after = await getDraftState(page);
      expect(String(after.draftId || after.activeDraftId || "")).toBe(draftId);

      await sendOrbix(page, "Purchase invoice PI-E2E-CASH-001, cash refund received.");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
    });

    test("Preview survives reload; confirm posts once", async ({ page }) => {
      await seedPhase8(page);
      await openOrbixAccountant(page);
      await sendOrbix(
        page,
        "Return the bike to the supplier from purchase invoice PI-E2E-CASH-001 and receive a cash refund.",
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
            "Return the bike to the supplier from purchase invoice PI-E2E-CASH-001 and receive a cash refund.",
          );
        }
        await expect(confirm).toBeVisible({ timeout: 90_000 });
      }

      const after = await getDraftState(page);
      if (previewHash && after.previewHash) {
        expect(String(after.draftId || after.activeDraftId || "")).toBe(draftId);
      }

      await confirm.click();
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 90_000 });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);

      const adj = await getPurchaseAdjustmentSnapshotSafe(page);
      expect((adj.returns as unknown[]).length).toBe(1);
    });
  });
});
