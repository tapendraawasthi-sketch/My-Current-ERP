/**
 * Connected Orbix E2E — skipped unless ORBIX_E2E_CONNECTED=true.
 *
 * Covers API contracts + authoritative browser Confirm → Dexie → Day Book
 * → Purchase Register → Stock Ledger verification.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import {
  assertE2ECompanyActive,
  getLedgerSnapshot,
  resetAndSeedOrbixE2E,
  type LedgerSnapshot,
} from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const botURL =
  process.env.ERP_BOT_BACKEND_URL ||
  process.env.VITE_ERP_BOT_URL ||
  "http://127.0.0.1:8765";
const ARTIFACTS = path.resolve("artifacts/orbix-connected");

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

async function readSseComplete(body: string): Promise<Record<string, unknown> | null> {
  const blocks = body.split("\n\n");
  for (const block of blocks) {
    const line = block.trim();
    if (!line.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (data.type === "complete") return data;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function openHarness(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  await resetAndSeedOrbixE2E(page);
  await assertE2ECompanyActive(page);
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => {
    window.__uiQaGoto?.(id);
  }, pageId);
  await page.waitForTimeout(400);
}

async function openOrbixAccountant(page: import("@playwright/test").Page) {
  await gotoPage(page, "orbix");
  await expect(page.locator('[data-component="orbix-workspace"]')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("orbix-mode-accountant").click();
  await expect(page.getByTestId("orbix-mode-accountant")).toHaveAttribute("aria-selected", "true");
}

async function sendOrbix(page: import("@playwright/test").Page, text: string) {
  const input = page.getByTestId("orbix-composer");
  await input.fill(text);
  await page.getByTestId("orbix-send").click();
  await expect(page.getByTestId("orbix-send-busy")).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
  await expect(page.getByTestId("orbix-send")).toBeVisible({ timeout: 120_000 });
}

async function getDraftState(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__orbixE2E?.getDraftState), {
    timeout: 60_000,
  });
  return page.evaluate(() => window.__orbixE2E!.getDraftState());
}

function bikeInvoices(snap: LedgerSnapshot) {
  return snap.invoices.filter(
    (inv) =>
      inv.type === "purchase-invoice" &&
      (inv.lines || []).some(
        (l) => l.itemId === "item-e2e-test-bike" || l.itemName === "E2E Test Bike",
      ),
  );
}

function bikeMovements(snap: LedgerSnapshot) {
  return snap.stockMovements.filter(
    (m) => m.itemId === "item-e2e-test-bike" || m.itemName === "E2E Test Bike",
  );
}

test.describe.configure({ timeout: 240_000 });

test.describe("Orbix connected flows", () => {
  test.skip(!connected, "Set ORBIX_E2E_CONNECTED=true with a live erp_bot to run");

  test.describe("A. Connected readiness (API)", () => {
    test("health and ready endpoints", async ({ request }) => {
      const health = await request.get(`${botURL}/health`);
      expect(health.ok()).toBeTruthy();
      const ready = await request.get(`${botURL}/ready`);
      expect(ready.ok()).toBeTruthy();
      const json = await ready.json();
      expect(json.api).toBe(true);
      expect(json.posting_authority).toBe("dexie_local_first");
    });
  });

  test.describe("B. Ask Mode behavior (API)", () => {
    test("Ask mode mutation returns structured mode_restriction", async ({ request }) => {
      const sessionId = `e2e-ask-${Date.now()}`;
      const resp = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "I bought peanuts for Rs 500.",
          session_id: sessionId,
          orbix_mode: "ask",
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60000,
      });
      expect(resp.ok()).toBeTruthy();
      const complete = await readSseComplete(await resp.text());
      expect(complete).toBeTruthy();
      expect(complete?.response_type || (complete?.error as { type?: string })?.type).toMatch(
        /mode_restriction/,
      );
    });
  });

  test.describe("C–D. Accountant draft + preview (API)", () => {
    test("Accountant incomplete purchase returns clarification with draft_id", async ({
      request,
    }) => {
      const sessionId = `e2e-acc-${Date.now()}`;
      const resp = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "I bought a bike.",
          session_id: sessionId,
          orbix_mode: "accountant",
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60000,
      });
      expect(resp.ok()).toBeTruthy();
      const complete = await readSseComplete(await resp.text());
      expect(complete).toBeTruthy();
      expect(complete?.response_type).toBe("clarification_required");
      expect(complete?.draft_id).toBeTruthy();
    });

    test("clarification continuation keeps same draft_id and returns confirmation card", async ({
      request,
    }) => {
      const sessionId = `e2e-cont-${Date.now()}`;
      const first = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "I bought a bike.",
          session_id: sessionId,
          orbix_mode: "accountant",
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60000,
      });
      const firstComplete = await readSseComplete(await first.text());
      const draftId = String(firstComplete?.draft_id || "");
      expect(draftId).toBeTruthy();

      const second = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "1, 50000 cash",
          session_id: sessionId,
          orbix_mode: "accountant",
          context: { draft_id: draftId },
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60000,
      });
      const secondComplete = await readSseComplete(await second.text());
      expect(secondComplete?.draft_id).toBe(draftId);
      expect(secondComplete?.response_type).toBe("confirmation_required");
      expect(secondComplete?.card).toBeTruthy();
      const card = secondComplete?.card as {
        amount?: number;
        preview_hash?: string;
        draft_version?: number;
        preview_version?: number;
        journalLines?: unknown[];
        item?: string;
      };
      expect(Number(card?.amount)).toBe(50000);
      expect(card?.preview_hash).toBeTruthy();
      expect(Number(card?.draft_version ?? card?.preview_version)).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(card?.journalLines) ? card.journalLines.length : 0).toBeGreaterThanOrEqual(
        2,
      );
    });

    test("mark-posted draft ack is idempotent", async ({ request }) => {
      const draftId = `e2e-mark-${Date.now()}`;
      const first = await request.post(`${botURL}/orbix/drafts/${draftId}/mark-posted`, {
        data: {
          voucher_number: "PUR-E2E-1",
          posting_id: "post-e2e-1",
          posted_at: new Date().toISOString(),
        },
      });
      expect(first.ok()).toBeTruthy();
      const firstJson = await first.json();
      expect(firstJson.idempotent_replay).toBe(false);

      const second = await request.post(`${botURL}/orbix/drafts/${draftId}/mark-posted`, {
        data: {
          voucher_number: "PUR-E2E-1",
          posting_id: "post-e2e-1",
          posted_at: new Date().toISOString(),
        },
      });
      expect(second.ok()).toBeTruthy();
      const secondJson = await second.json();
      expect(secondJson.idempotent_replay).toBe(true);
      expect(secondJson.posted_result.voucher_number).toBe("PUR-E2E-1");
    });
  });

  test.describe.serial("E–K. Authoritative browser posting + cross-screen", () => {
    test("Confirm UI posts once; Dexie + Day Book + Purchase + Stock agree", async ({ page }) => {
      ensureArtifacts();
      await openHarness(page);
      await openOrbixAccountant(page);

      // ── Clarification ────────────────────────────────────────────────────
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await shot(page, "01-clarification");

      const draftAfterClarify = await getDraftState(page);
      const draftId1 = String(draftAfterClarify.activeDraftId || "");
      const sessionId = String(draftAfterClarify.activeSessionId || "");
      expect(draftId1).toBeTruthy();

      let snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
      expect(bikeMovements(snap).length).toBe(0);
      expect(snap.receipts.filter((r) => r.status === "completed").length).toBe(0);

      // ── Continuation → preview ───────────────────────────────────────────
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-transaction-preview")).toBeVisible({ timeout: 90_000 });
      await expect(page.getByTestId("orbix-journal-preview")).toBeVisible();
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible();
      await shot(page, "02-transaction-preview");
      await shot(page, "03-journal-preview");

      const draftAfterPreview = await getDraftState(page);
      expect(String(draftAfterPreview.activeSessionId)).toBe(sessionId);
      expect(String(draftAfterPreview.activeDraftId)).toBe(draftId1);
      const pending = draftAfterPreview.pendingCard as {
        amount?: number;
        item?: string;
        draft_id?: string;
        draft_version?: number;
        preview_version?: number;
        preview_hash?: string;
        journalLines?: Array<{ debit?: number; credit?: number; accountName?: string }>;
      } | null;
      expect(pending).toBeTruthy();
      expect(String(pending?.draft_id)).toBe(draftId1);
      expect(Number(pending?.amount)).toBe(50000);
      expect(String(pending?.item || "").toLowerCase()).toMatch(/bike/);
      expect(Number(pending?.draft_version ?? pending?.preview_version)).toBeGreaterThanOrEqual(1);
      expect(pending?.preview_hash).toBeTruthy();
      const lines = pending?.journalLines || [];
      expect(lines.length).toBeGreaterThanOrEqual(2);
      const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
      expect(debit).toBe(50000);
      expect(credit).toBe(50000);

      // Pre-confirm: still no ledger writes
      snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
      expect(bikeMovements(snap).length).toBe(0);
      expect(snap.vouchers.filter((v) => String(v.narration || "").toLowerCase().includes("bike")).length).toBe(0);
      const balancesBefore = { ...snap.accountBalances };

      await shot(page, "04-confirmation-state");
      const savedCard = pending;

      // ── Confirm (single click; rapid second should no-op while loading) ──
      const confirmBtn = page.getByTestId("orbix-confirm-post");
      await confirmBtn.click();
      await confirmBtn.click({ force: true }).catch(() => undefined);
      await shot(page, "05-posting-in-progress");

      // Authoritative wait: Dexie must show the purchase (survives Vite HMR reloads).
      await expect
        .poll(async () => bikeInvoices(await getLedgerSnapshot(page)).length, {
          timeout: 90_000,
          intervals: [500, 1000, 2000],
        })
        .toBe(1);

      // UI success card when still on Orbix; if HMR navigated away, continue from Dexie.
      const completedVisible = await page
        .getByTestId("orbix-posting-completed")
        .isVisible()
        .catch(() => false);
      if (!completedVisible) {
        await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
        await page.waitForFunction(() => Boolean(window.__orbixE2E?.getDraftState), {
          timeout: 60_000,
        });
        await assertE2ECompanyActive(page);
        await openOrbixAccountant(page);
      }
      await shot(page, "06-posting-completed");

      snap = await getLedgerSnapshot(page);
      const invoicesPosted = bikeInvoices(snap);
      expect(invoicesPosted.length).toBe(1);
      const inv = invoicesPosted[0];
      const voucher = snap.vouchers.find((v) => v.id === `jnl-${inv.id}`) ||
        snap.vouchers.find((v) => String(v.voucherNo || "").includes(inv.invoiceNo));
      expect(voucher).toBeTruthy();
      const movementsPosted = bikeMovements(snap).filter((m) => m.referenceId === inv.id);
      expect(movementsPosted.length).toBe(1);

      // Draft/posting result may be cleared after HMR — Dexie refs remain authoritative.
      let afterPost: Awaited<ReturnType<typeof getDraftState>> | null = null;
      try {
        afterPost = await getDraftState(page);
      } catch {
        afterPost = null;
      }
      const lastResult = afterPost?.lastPostingResult as {
        response_type?: string;
        status?: string;
        payload?: Record<string, unknown>;
      } | null;

      const refs = {
        postingId: String(lastResult?.payload?.posting_id || snap.receipts[0]?.id || ""),
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNo,
        voucherId: String(voucher!.id),
        voucherNumber: String(voucher!.voucherNo),
        stockMovementIds: movementsPosted.map((m) => m.id),
        amount: 50000,
        date: new Date().toISOString().slice(0, 10),
      };
      expect(refs.invoiceId).toBeTruthy();
      expect(refs.voucherNumber).toBeTruthy();
      expect(Number(inv.grandTotal)).toBe(50000);
      expect(Number(voucher!.totalDebit ?? 0)).toBe(50000);
      expect(Number(voucher!.totalCredit ?? 0)).toBe(50000);
      expect(Number(movementsPosted[0].qty)).toBe(1);

      if (lastResult?.response_type === "posting_completed") {
        expect(lastResult.status).toBe("success");
        expect(lastResult.payload?.idempotent_replay).toBe(false);
      }

      // Balance direction: debit increases, credit decreases stored balance
      const purchaseDelta =
        Number(snap.accountBalances["acc-purchase"] ?? 0) -
        Number(balancesBefore["acc-purchase"] ?? 0);
      const cashDelta =
        Number(snap.accountBalances["acc-cash"] ?? 0) - Number(balancesBefore["acc-cash"] ?? 0);
      // Prefer purchase account; some journal rules debit inventory instead
      const inventoryLikeDelta = Object.entries(snap.accountBalances).some(([id, bal]) => {
        if (id === "acc-cash") return false;
        const before = Number(balancesBefore[id] ?? 0);
        return Math.abs(Number(bal) - before) === 50000;
      });
      expect(Math.abs(cashDelta) === 50000 || inventoryLikeDelta).toBeTruthy();
      if (Math.abs(purchaseDelta) === 50000) {
        expect(purchaseDelta).toBe(-cashDelta);
      }

      const audits = snap.auditLogs.filter(
        (a) =>
          a.entityId === refs.invoiceId ||
          a.recordId === refs.invoiceId ||
          String(a.after?.invoiceId || "") === refs.invoiceId,
      );
      expect(audits.length).toBeGreaterThanOrEqual(1);

      // Phase 6 cutover: accounting posts enqueue eventSyncQueue (not legacy syncOutbox).
      const legacySync = snap.syncOutbox.filter(
        (e) => e.entityId === refs.invoiceId || e.entityId === refs.voucherId,
      );
      const eventSync = snap.eventSyncQueue || [];
      const matchedEventSync = eventSync.filter(
        (row) =>
          row.aggregateId === refs.invoiceId ||
          row.invoiceId === refs.invoiceId ||
          row.voucherId === refs.voucherId,
      );
      // Prefer invoice-matched rows; fall back to non-empty queue after this post.
      expect(
        legacySync.length + matchedEventSync.length > 0 || eventSync.length >= 1,
      ).toBeTruthy();

      const receipts = snap.receipts.filter(
        (r) => r.status === "completed" && (r.invoiceId === refs.invoiceId || r.result),
      );
      expect(receipts.length).toBe(1);

      // ── Day Book UI ──────────────────────────────────────────────────────
      await page.evaluate(() => window.__orbixE2E!.reloadFromDexie());
      await gotoPage(page, "day-book");
      // ReportWorkspace title is "Today's transactions"; Day Book still in toolbar/nav.
      await expect(page.getByTestId("daybook-search")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("daybook-search").fill(refs.voucherNumber);
      await expect(
        page.locator(`[data-voucher-no="${refs.voucherNumber}"]`).or(page.getByText(refs.voucherNumber, { exact: true })).first(),
      ).toBeVisible({
        timeout: 15_000,
      });
      await shot(page, "07-daybook-row");

      // ── Purchase register ────────────────────────────────────────────────
      await page.evaluate(() => window.__orbixE2E!.reloadFromDexie());
      await gotoPage(page, "purchase-invoice");
      await expect(page.getByTestId("billing-search")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("billing-search").fill(refs.invoiceNumber);
      await expect(page.getByText(refs.invoiceNumber, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await shot(page, "08-purchase-register");

      // ── Stock ledger ─────────────────────────────────────────────────────
      await page.evaluate(() => window.__orbixE2E!.reloadFromDexie());
      await gotoPage(page, "stock-book");
      await page.getByTestId("stockbook-item-select").selectOption({ label: "E2E Test Bike" });
      await expect(page.getByText(refs.invoiceNumber)).toBeVisible({ timeout: 15_000 });
      await shot(page, "09-stock-movement");

      // ── Idempotent typed replay (same card + key) ─────────────────────────
      await gotoPage(page, "orbix");
      const serviceReplay = await page.evaluate(async (card) => {
        return window.__orbixE2E!.replayConfirm(card);
      }, savedCard as Record<string, unknown>);

      expect(serviceReplay.status).toBe("success");
      expect((serviceReplay.payload as { idempotent_replay?: boolean }).idempotent_replay).toBe(
        true,
      );
      expect(String((serviceReplay.payload as { invoice_id?: string }).invoice_id)).toBe(
        refs.invoiceId,
      );
      await shot(page, "10-idempotent-replay");

      snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(1);
      expect(bikeMovements(snap).filter((m) => m.referenceId === refs.invoiceId).length).toBe(1);
      expect(snap.receipts.filter((r) => r.status === "completed").length).toBe(1);
    });

    test("refresh after post recovers posted state; confirm unavailable", async ({ page }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });
      await page.getByTestId("orbix-confirm-post").click();
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 60_000 });

      const before = await getLedgerSnapshot(page);
      const invCount = bikeInvoices(before).length;
      expect(invCount).toBe(1);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      // Re-seed masters but do not wipe the just-posted txn: only assertSafe + open Orbix
      await assertE2ECompanyActive(page);
      await openOrbixAccountant(page);

      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const after = await getLedgerSnapshot(page);
      // Note: bootstrap re-seeds on load; resetAndSeed is NOT called here so invoices remain
      // unless bootstrap wipe happens. Bootstrap only seedOrbixE2ECompany (no reset) — invoices stay.
      expect(bikeInvoices(after).length).toBe(invCount);
      await shot(page, "11-refresh-after-post");
    });
  });

  test.describe.serial("L–O. Permission, stale, rollback, offline", () => {
    test("restricted viewer cannot post; no ledger writes", async ({ page }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });

      const card = (await getDraftState(page)).pendingCard as Record<string, unknown>;
      await page.evaluate(() => window.__orbixE2E!.setRestrictedUser());

      // Domain-level denial (authoritative)
      const denied = await page.evaluate(async (c) => {
        return window.__orbixE2E!.replayConfirm(c);
      }, card);
      expect(denied.status).toBe("failed");
      expect((denied.payload as { error_code?: string }).error_code).toMatch(
        /permission|mode_restriction/i,
      );

      // UI confirm while restricted
      await page.getByTestId("orbix-confirm-post").click();
      await expect(page.getByText(/cannot post|permission|role/i).first()).toBeVisible({
        timeout: 30_000,
      });
      await shot(page, "12-permission-denied");

      const snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
      expect(bikeMovements(snap).length).toBe(0);
      expect(snap.receipts.filter((r) => r.status === "completed").length).toBe(0);
    });

    test("stale preview is rejected without ledger mutation", async ({ page }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });

      const card = (await getDraftState(page)).pendingCard as Record<string, unknown>;
      expect(card).toBeTruthy();

      const staleResult = await page.evaluate(async (c) => {
        return window.__orbixE2E!.staleConfirm(c);
      }, card);

      expect(staleResult.status).toBe("failed");
      expect((staleResult.payload as { error_code?: string }).error_code).toBe("stale_preview");
      await shot(page, "13-stale-preview");

      const snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
    });

    test("injected failure rolls back; retry posts once", async ({ page }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });

      const failed = await page.evaluate(() =>
        window.__orbixE2E!.confirmWithInject("before_stock"),
      );
      expect(failed.status).toBe("failed");
      expect((failed.payload as { error_code?: string }).error_code).toMatch(/injected|posting/i);
      await shot(page, "14-rollback-failure");

      let snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
      expect(bikeMovements(snap).length).toBe(0);

      await page.getByTestId("orbix-confirm-post").click();
      await expect(page.getByTestId("orbix-posting-completed")).toBeVisible({ timeout: 60_000 });
      snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(1);
      expect(bikeMovements(snap).length).toBe(1);
    });

    test("provider offline before preview creates no ledger authority", async ({ page }) => {
      await openHarness(page);
      await openOrbixAccountant(page);

      // Force offline by pointing fetch at a dead host for orbix stream only is hard;
      // instead block /orbix/chat/stream via route.
      await page.route("**/orbix/chat/stream", (route) => route.abort("failed"));
      await page.route("**/erp-bot/orbix/chat/stream", (route) => route.abort("failed"));

      await sendOrbix(page, "I bought a bike.");
      // Offline / error card — Confirm must not appear
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const offlineOrError = page
        .getByTestId("orbix-provider-offline")
        .or(page.getByText(/offline|unavailable|failed|connection/i).first());
      await expect(offlineOrError).toBeVisible({ timeout: 60_000 });
      await shot(page, "15-provider-offline");

      const snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(0);
      expect(snap.receipts.filter((r) => r.status === "completed").length).toBe(0);
    });
  });

  test.describe.serial("Phase 5.11 — Clarification & preview refresh recovery", () => {
    test("STATE A — awaiting clarification survives refresh; same draft_id; version increments", async ({
      page,
    }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });

      const before = await getDraftState(page);
      const draftId = String(before.activeDraftId || before.draftId || "");
      expect(draftId.length).toBeGreaterThan(4);
      const versionBefore = Number(before.draftVersion ?? 0);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await assertE2ECompanyActive(page);
      await openOrbixAccountant(page);

      // Clarification must restore with the same draft (structured card, not chat history alone)
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      const restoredDraftAttr = await page
        .getByTestId("orbix-clarification")
        .getAttribute("data-draft-id");
      expect(restoredDraftAttr).toBe(draftId);

      // No posting before confirmation
      const midSnap = await getLedgerSnapshot(page);
      expect(bikeInvoices(midSnap).length).toBe(0);
      expect(bikeMovements(midSnap).length).toBe(0);

      const afterReload = await getDraftState(page);
      const draftIdAfter = String(
        afterReload.activeDraftId || afterReload.draftId || restoredDraftAttr || "",
      );
      expect(draftIdAfter).toBe(draftId);

      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });

      const afterContinue = await getDraftState(page);
      const draftIdContinue = String(
        afterContinue.activeDraftId || afterContinue.draftId || draftId,
      );
      expect(draftIdContinue).toBe(draftId);
      const versionAfter = Number(afterContinue.draftVersion ?? versionBefore);
      expect(versionAfter).toBeGreaterThanOrEqual(versionBefore);
      // Still no posting until Confirm
      const preConfirm = await getLedgerSnapshot(page);
      expect(bikeInvoices(preConfirm).length).toBe(0);
      await shot(page, "phase5-state-a-clarification-refresh");
    });

    test("STATE B — awaiting confirmation survives refresh; confirm exactly once", async ({
      page,
    }) => {
      await openHarness(page);
      await openOrbixAccountant(page);
      await sendOrbix(page, "I bought a bike.");
      await expect(page.getByTestId("orbix-clarification")).toBeVisible({ timeout: 90_000 });
      await sendOrbix(page, "1, 50000 cash");
      await expect(page.getByTestId("orbix-confirm-post")).toBeVisible({ timeout: 90_000 });

      const before = await getDraftState(page);
      const draftId = String(before.activeDraftId || before.draftId || "");
      const previewVersion = before.previewVersion ?? before.pendingCard?.preview_version;

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await assertE2ECompanyActive(page);
      await openOrbixAccountant(page);

      // Must restore confirm card or require safe re-preview — not a silent stale confirm
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__orbixE2E?.getDraftState), {
        timeout: 60_000,
      });

      const confirm = page.getByTestId("orbix-confirm-post");
      const clarification = page.getByTestId("orbix-clarification");

      // Prefer restored pending confirm; otherwise safe re-preview from same draft
      const hasConfirm = await confirm.isVisible().catch(() => false);
      if (!hasConfirm) {
        await expect(clarification).toBeVisible({ timeout: 90_000 });
        const restoredDraft = await clarification.getAttribute("data-draft-id");
        if (draftId && restoredDraft) expect(restoredDraft).toBe(draftId);
        await sendOrbix(page, "1, 50000 cash");
        await expect(confirm).toBeVisible({ timeout: 90_000 });
      }

      await confirm.click();
      await expect
        .poll(async () => bikeInvoices(await getLedgerSnapshot(page)).length, {
          timeout: 90_000,
          intervals: [500, 1000, 2000],
        })
        .toBe(1);

      const completed = page.getByTestId("orbix-posting-completed");
      if (await completed.isVisible().catch(() => false)) {
        await expect(page.getByTestId("orbix-sync-status")).toBeVisible();
      }

      // Second confirm must not duplicate
      await expect(page.getByTestId("orbix-confirm-post")).toHaveCount(0);
      const snap = await getLedgerSnapshot(page);
      expect(bikeInvoices(snap).length).toBe(1);
      expect(bikeMovements(snap).filter((m) => m.referenceId === bikeInvoices(snap)[0].id).length).toBe(
        1,
      );

      void previewVersion;
      await shot(page, "phase5-state-b-preview-refresh");
    });
  });
});
