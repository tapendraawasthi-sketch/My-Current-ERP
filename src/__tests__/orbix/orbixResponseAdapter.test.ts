import { describe, expect, it } from "vitest";
import { parseOrbixResponse, legacyCardFromResponse } from "../../lib/ekhata/orbixResponseAdapter";
import { ORBIX_RESPONSE_SCHEMA_VERSION } from "../../lib/ekhata/orbixResponseTypes";

describe("parseOrbixResponse", () => {
  it("parses normal_answer", () => {
    const result = parseOrbixResponse({
      response_type: "normal_answer",
      message: "Accounting has rules of debit and credit.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("normal_answer");
    expect(result.response.display.text).toContain("debit");
    expect(result.response.schema_version).toBe(ORBIX_RESPONSE_SCHEMA_VERSION);
  });

  it("parses mode_restriction from error.type", () => {
    const result = parseOrbixResponse({
      message: "Switch to Accountant Mode",
      orbix_mode: "ask",
      operation_class: "transaction_create",
      error: {
        type: "mode_restriction",
        required_mode: "accountant",
        can_preview: true,
        operation: "transaction_create",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("mode_restriction");
    if (result.response.response_type !== "mode_restriction") return;
    expect(result.response.payload.required_mode).toBe("accountant");
    expect(result.response.actions.some((a) => a.type === "switch_mode")).toBe(true);
  });

  it("parses clarification_required with draft_id", () => {
    const result = parseOrbixResponse({
      response_type: "clarification_required",
      message: "Please tell me the quantity",
      draft_id: "draft-bike-1",
      error: {
        type: "clarification_required",
        draft_id: "draft-bike-1",
        transaction_type: "purchase",
        draft_status: "awaiting_clarification",
        missing_fields: ["quantity", "rate_or_total", "payment_method"],
        captured_fields: [
          { field: "item", label: "Item", value: "Bike", display_value: "Bike", confidence: 0.96 },
        ],
        ambiguous_fields: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("clarification_required");
    if (result.response.response_type !== "clarification_required") return;
    expect(result.response.payload.draft_id).toBe("draft-bike-1");
    expect(result.response.payload.captured_fields[0].value).toBe("Bike");
    expect(result.response.payload.missing_fields.map((f) => f.field)).toEqual([
      "quantity",
      "rate_or_total",
      "payment_method",
    ]);
    expect(result.response.payload.nothing_posted).toBe(true);
  });

  it("parses confirmation_required with journal lines", () => {
    const result = parseOrbixResponse({
      message: "Purchase preview",
      draft_id: "draft-2",
      card: {
        draft_id: "draft-2",
        intent: "khata_cash_purchase",
        item: "Bike",
        amount: 50000,
        party: null,
        preview_hash: "abc",
        journalLines: [
          { accountCode: "KH-PUR", accountName: "Purchases", debit: 50000, credit: 0 },
          { accountCode: "KH-CASH", accountName: "Cash", debit: 0, credit: 50000 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("confirmation_required");
    if (result.response.response_type !== "confirmation_required") return;
    expect(result.response.payload.draft_id).toBe("draft-2");
    expect(result.response.payload.preview_hash).toBe("abc");
    expect(result.response.payload.journal?.balanced).toBe(true);
    expect(result.response.payload.journal?.entries).toHaveLength(2);
    const card = legacyCardFromResponse(result.response);
    expect(card?.amount).toBe(50000);
  });

  it("parses report_result from report_spec", () => {
    const result = parseOrbixResponse({
      message: "Balance Sheet",
      report_spec: { report_id: "r1", report_type: "balance_sheet", title: "Balance Sheet" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("report_result");
  });

  it("parses provider_offline", () => {
    const result = parseOrbixResponse({
      response_type: "provider_offline",
      message: "Orbix is temporarily limited.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("provider_offline");
  });

  it("handles malformed payload without enabling confirm", () => {
    const result = parseOrbixResponse({ card: "not-an-object", message: "x" });
    // Should not throw; card ignored → normal or failed safely
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).not.toBe("confirmation_required");
  });

  it("supports Nepali unicode in display text", () => {
    const result = parseOrbixResponse({
      response_type: "normal_answer",
      message: "बैलेंस शीट यस वर्षको अवस्था देखाउँछ।",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.display.text).toContain("बैलेंस");
  });

  it("unknown response_type falls through safely", () => {
    const result = parseOrbixResponse({
      response_type: "totally_unknown_thing",
      message: "Hello",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // derive keeps unknown string as response_type but switch treats as default text
    expect(result.response.display.text).toBe("Hello");
  });
});
