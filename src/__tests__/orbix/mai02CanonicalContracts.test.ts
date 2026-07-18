import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIResponseEnvelopeV1Schema,
  ClientTurnPayloadV1Schema,
  MoneyV1Schema,
  assertUnsupportedSchemaVersion,
  isKnownOrbixResponseType,
} from "../../lib/ekhata/mai02CanonicalContracts";
import { parseOrbixResponse } from "../../lib/ekhata/orbixResponseAdapter";

const FIXTURES = resolve(
  process.cwd(),
  "erp_bot/src/oip/contracts/fixtures",
);

describe("MAI-02 canonical contracts (TS)", () => {
  it("rejects float money", () => {
    expect(MoneyV1Schema.safeParse({ amount: 12.5, currency: "NPR" }).success).toBe(false);
    expect(MoneyV1Schema.safeParse({ amount: "12.50", currency: "NPR" }).success).toBe(true);
  });

  it("rejects client trusted identity", () => {
    const bad = ClientTurnPayloadV1Schema.safeParse({
      schema_version: "1.0.0",
      message: "hi",
      conversation_id: "c1",
      client_context: { principal_id: "attacker" },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unsupported schema major", () => {
    expect(assertUnsupportedSchemaVersion("99.0.0")).toBe(true);
    const bad = ClientTurnPayloadV1Schema.safeParse({
      schema_version: "99.0.0",
      message: "hi",
      conversation_id: "c1",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects response/payload mismatch", () => {
    const bad = AIResponseEnvelopeV1Schema.safeParse({
      schema_version: "1.0.0",
      response_id: "r",
      request_id: "q",
      conversation_id: "c",
      response_type: "RECEIPT",
      status: "SUCCESS",
      language: "en",
      user_visible_text: "x",
      structured_payload: { payload_type: "ANSWER" },
      citations: [],
      warnings: [],
      suggested_safe_actions: [],
      created_at: "2026-07-14T12:00:00Z",
    });
    expect(bad.success).toBe(false);
  });

  it("maps unknown orbix response_type to unsupported_response", () => {
    const result = parseOrbixResponse({
      schema_version: "1.0",
      response_type: "FUTURE_WEIRD_ACCOUNTING_CARD",
      message: "should not become a journal card",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("unsupported_response");
    expect(isKnownOrbixResponseType("normal_answer")).toBe(true);
    expect(isKnownOrbixResponseType("FUTURE_WEIRD_ACCOUNTING_CARD")).toBe(false);
  });

  it("rejects unsupported wire schema major as unsupported_response", () => {
    const result = parseOrbixResponse({
      schema_version: "99.0.0",
      response_type: "normal_answer",
      message: "hi",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.response_type).toBe("unsupported_response");
  });

  it("validates shared Python fixtures where schemas overlap", () => {
    const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json") && f !== "index.json");
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(resolve(FIXTURES, file), "utf8")) as {
        valid: boolean;
        kind: string;
        data: unknown;
      };
      if (raw.kind === "ClientTurnPayloadV1") {
        const parsed = ClientTurnPayloadV1Schema.safeParse(raw.data);
        expect(parsed.success).toBe(raw.valid);
      }
      if (raw.kind === "AIResponseEnvelopeV1") {
        const parsed = AIResponseEnvelopeV1Schema.safeParse(raw.data);
        // Preview/Draft payloads include nested objects; Zod uses passthrough on payload.
        if (raw.valid) {
          expect(parsed.success).toBe(true);
        } else {
          expect(parsed.success).toBe(false);
        }
      }
    }
  });
});
