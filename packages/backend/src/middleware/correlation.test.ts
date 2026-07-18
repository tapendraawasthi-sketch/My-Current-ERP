import { describe, expect, it } from "vitest";
import {
  isValidCorrelationId,
  makeTraceReference,
  sanitizeOrGenerateCorrelationId,
  safeRouteLog,
} from "./correlation.js";

describe("MAI-03 Node correlation", () => {
  it("rejects invalid correlation and generates uuid", () => {
    expect(isValidCorrelationId("evil@tenant")).toBe(false);
    expect(isValidCorrelationId("a".repeat(200))).toBe(false);
    const gen = sanitizeOrGenerateCorrelationId("not-valid");
    expect(isValidCorrelationId(gen.id)).toBe(true);
    expect(gen.source).toBe("GENERATED");
  });

  it("keeps valid upstream id", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const got = sanitizeOrGenerateCorrelationId(id);
    expect(got.id).toBe(id);
    expect(got.source).toBe("VALIDATED_UPSTREAM");
  });

  it("builds opaque trace reference", () => {
    const ref = makeTraceReference("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "11111111-2222-4333-8444-555555555555");
    expect(ref.startsWith("tr_")).toBe(true);
    expect(ref.includes("@")).toBe(false);
  });

  it("safeRouteLog drops auth-like values", () => {
    const safe = safeRouteLog({
      route: "/khata/confirm",
      authorization: "Bearer secret",
      duration_ms: 10,
      correlation_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(safe.authorization).toBeUndefined();
    expect(safe.duration_ms).toBe(10);
  });
});
