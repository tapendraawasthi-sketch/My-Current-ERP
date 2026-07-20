/**
 * Phase 6 connected Sales E2E — skipped unless ORBIX_E2E_CONNECTED=true.
 */
import { test, expect } from "@playwright/test";
import { getLedgerSnapshot, type LedgerSnapshot } from "./helpers/orbixE2E";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const botURL = (
  process.env.ERP_BOT_BACKEND_URL ||
  process.env.ORBIX_BOT_URL ||
  process.env.VITE_ERP_BOT_URL ||
  "http://127.0.0.1:8765"
).replace(/\/$/, "");

async function readSseComplete(text: string): Promise<Record<string, unknown> | null> {
  for (const block of text.split("\n\n")) {
    const line = block.trim();
    if (!line.startsWith("data: ")) continue;
    try {
      const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (payload.type === "complete") return payload;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function sendOrbix(page: import("@playwright/test").Page, message: string) {
  await page.getByTestId("orbix-chat-input").fill(message);
  await page.getByTestId("orbix-send").click();
}

function bikeSales(snap: LedgerSnapshot) {
  return snap.invoices.filter(
    (i) =>
      i.type === "sales-invoice" &&
      (i.lines || []).some(
        (l) => l.itemId === "item-e2e-test-bike" || l.itemName === "E2E Test Bike",
      ),
  );
}

function bikeOutMoves(snap: LedgerSnapshot) {
  return snap.stockMovements.filter(
    (m) =>
      (m.itemId === "item-e2e-test-bike" || m.itemName === "E2E Test Bike") &&
      Number(m.qty) < 0,
  );
}

test.describe("Phase 6 connected Sales", () => {
  test.skip(!connected, "Set ORBIX_E2E_CONNECTED=true with a live erp_bot to run");
  test.describe.configure({ timeout: 180_000 });

  test.describe("API language flows", () => {
    test("Ask mode blocks sale mutation", async ({ request }) => {
      const resp = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "Record a cash sale of Rs 60000.",
          session_id: `e2e-sale-ask-${Date.now()}`,
          orbix_mode: "ask",
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60_000,
      });
      expect(resp.ok()).toBeTruthy();
      const complete = await readSseComplete(await resp.text());
      expect(complete?.response_type || (complete?.error as { type?: string })?.type).toMatch(
        /mode_restriction/,
      );
    });

    test("Incomplete sale clarification + continuation", async ({ request }) => {
      const sessionId = `e2e-sale-draft-${Date.now()}`;
      const r1 = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "I sold a bike.",
          session_id: sessionId,
          orbix_mode: "accountant",
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60_000,
      });
      expect(r1.ok()).toBeTruthy();
      const c1 = await readSseComplete(await r1.text());
      const err = (c1?.error || c1) as Record<string, unknown>;
      expect(String(err.type || c1?.response_type || "")).toMatch(/clarification/);
      const draftId = String(err.draft_id || c1?.draft_id || "");
      expect(draftId).toBeTruthy();
      expect(err.transaction_type).toBe("sale");

      const r2 = await request.post(`${botURL}/orbix/chat/stream`, {
        data: {
          message: "1, 60000 cash",
          session_id: sessionId,
          orbix_mode: "accountant",
          draft_id: draftId,
          context: {},
        },
        headers: { Accept: "text/event-stream" },
        timeout: 60_000,
      });
      expect(r2.ok()).toBeTruthy();
      const c2 = await readSseComplete(await r2.text());
      expect(String(c2?.draft_id || "")).toBe(draftId);
      expect(c2?.card || (c2 as { confirmation_card?: unknown })?.confirmation_card).toBeTruthy();
    });
  });

  test.describe("Browser posting", () => {
    test("Cash sale post + stock-out via harness", async ({ page }) => {
      await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
      await page.evaluate(async () => {
        await window.__orbixE2E!.resetAndSeedSales();
      });
      const posted = await page.evaluate(async () => {
        return window.__orbixE2E!.postE2ESale({
          quantity: "1",
          amount: "60000.00",
          paymentMethod: "cash",
        });
      });
      expect(posted.type || (posted as { status?: string }).status).toMatch(
        /posting_completed|success/,
      );
      const snap = await getLedgerSnapshot(page);
      expect(bikeSales(snap).length).toBeGreaterThanOrEqual(1);
      expect(bikeOutMoves(snap).length).toBeGreaterThanOrEqual(1);
    });
  });
});
