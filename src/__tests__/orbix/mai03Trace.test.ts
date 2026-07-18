import { describe, expect, it } from "vitest";
import {
  clearRememberedTraceReference,
  displaySupportReference,
  rememberTraceReference,
  readRememberedTraceReference,
  generateCorrelationId,
  isValidCorrelationId,
  isValidTraceReference,
  makeOutboundTraceHeaders,
} from "../../lib/ekhata/mai03Trace";

describe("MAI-03 frontend trace helpers", () => {
  it("validates opaque support references only", () => {
    expect(isValidTraceReference("tr_aaaaaaaa_bbbbbbbb")).toBe(true);
    expect(isValidTraceReference("tenant-a/user@x")).toBe(false);
    expect(displaySupportReference("tr_aaaaaaaa_bbbbbbbb")).toBe("tr_aaaaaaaa_bbbbbbbb");
    expect(displaySupportReference("bad")).toBeNull();
  });

  it("isolates concurrent conversation references", () => {
    rememberTraceReference("c1", "tr_11111111_22222222");
    rememberTraceReference("c2", "tr_33333333_44444444");
    expect(readRememberedTraceReference("c1")).toBe("tr_11111111_22222222");
    expect(readRememberedTraceReference("c2")).toBe("tr_33333333_44444444");
    clearRememberedTraceReference("c1");
    expect(readRememberedTraceReference("c1")).toBeNull();
    expect(readRememberedTraceReference("c2")).toBe("tr_33333333_44444444");
  });

  it("does not persist invalid refs and builds outbound correlation header", () => {
    rememberTraceReference("c3", "not-valid");
    expect(readRememberedTraceReference("c3")).toBeNull();
    const headers = makeOutboundTraceHeaders();
    expect(isValidCorrelationId(headers["X-Correlation-ID"])).toBe(true);
    expect(isValidCorrelationId(generateCorrelationId())).toBe(true);
  });
});
