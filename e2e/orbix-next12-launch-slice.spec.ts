/**
 * NEXT-12 named launch-slice E2E — skipped unless ORBIX_E2E_CONNECTED=true.
 *
 * Verticals (ADR_0077 freeze / ADR_0079 evidence):
 *   purchase_invoice_draft — mixed-language → preview → confirm → receipt
 *   sales_invoice_draft    — clarify/continuation API path
 *   ask_company_report     — report; zero mutations
 *
 * Broader purchase confirm→Dexie→registers live in orbix-connected.spec.ts.
 */
import { test, expect } from "@playwright/test";

const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const botURL = (
  process.env.ERP_BOT_BACKEND_URL ||
  process.env.VITE_ERP_BOT_URL ||
  process.env.ORBIX_BOT_URL ||
  "http://127.0.0.1:8765"
).replace(/\/$/, "");

async function readSseComplete(text: string): Promise<Record<string, unknown> | null> {
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    try {
      const payload = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
      if (payload.type === "complete" || payload.response_type || payload.error) {
        return payload;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

test.describe("NEXT-12 E2E launch slice", () => {
  test.skip(!connected, "Set ORBIX_E2E_CONNECTED=true with a live erp_bot to run");
  test.describe.configure({ timeout: 180_000 });

  test("purchase_invoice_draft — mixed-language reaches preview or clarify", async ({
    request,
  }) => {
    const sessionId = `n12-purchase-${Date.now()}`;
    const resp = await request.post(`${botURL}/orbix/chat/stream`, {
      data: {
        message: "Ram bata bike 1 pcs 50000 cash kineko",
        session_id: sessionId,
        orbix_mode: "accountant",
        context: {},
      },
      headers: { Accept: "text/event-stream" },
      timeout: 60_000,
    });
    expect(resp.ok()).toBeTruthy();
    const complete = await readSseComplete(await resp.text());
    const rt = String(
      complete?.response_type ||
        (complete?.error as { type?: string } | undefined)?.type ||
        "",
    );
    expect(rt).toMatch(/clarification|transaction_preview|confirmation_required|preview/i);
    expect(rt).not.toMatch(/posting_completed/);
  });

  test("sales_invoice_draft — incomplete sale clarifies (no silent post)", async ({
    request,
  }) => {
    const sessionId = `n12-sale-${Date.now()}`;
    const resp = await request.post(`${botURL}/orbix/chat/stream`, {
      data: {
        message: "I sold a bike.",
        session_id: sessionId,
        orbix_mode: "accountant",
        context: {},
      },
      headers: { Accept: "text/event-stream" },
      timeout: 60_000,
    });
    expect(resp.ok()).toBeTruthy();
    const complete = await readSseComplete(await resp.text());
    const err = (complete?.error || complete) as Record<string, unknown>;
    const rt = String(err.type || complete?.response_type || "");
    expect(rt).toMatch(/clarification/);
    expect(String(err.draft_id || complete?.draft_id || "")).toBeTruthy();
  });

  test("ask_company_report — balance sheet; Ask never posts", async ({ request }) => {
    const sessionId = `n12-ask-${Date.now()}`;
    const report = await request.post(`${botURL}/orbix/chat/stream`, {
      data: {
        message: "balance sheet dekhaunu",
        session_id: sessionId,
        orbix_mode: "ask",
        context: {},
      },
      headers: { Accept: "text/event-stream" },
      timeout: 60_000,
    });
    expect(report.ok()).toBeTruthy();
    const reportComplete = await readSseComplete(await report.text());
    const reportRt = String(
      reportComplete?.response_type ||
        (reportComplete?.error as { type?: string } | undefined)?.type ||
        "",
    );
    expect(reportRt).not.toMatch(/posting_completed/);
    expect(reportRt).not.toMatch(/transaction_preview|confirmation_required/);

    const saleAsk = await request.post(`${botURL}/orbix/chat/stream`, {
      data: {
        message: "sold bike 60000 cash",
        session_id: `n12-ask-sale-${Date.now()}`,
        orbix_mode: "ask",
        context: {},
      },
      headers: { Accept: "text/event-stream" },
      timeout: 60_000,
    });
    expect(saleAsk.ok()).toBeTruthy();
    const saleComplete = await readSseComplete(await saleAsk.text());
    const saleRt = String(
      saleComplete?.response_type ||
        (saleComplete?.error as { type?: string } | undefined)?.type ||
        "",
    );
    expect(saleRt).toMatch(/mode_restriction/);
  });
});
