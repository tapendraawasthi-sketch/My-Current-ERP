import { describe, expect, it } from "vitest";
import { assertSpanRoundTrip, codePoints, sliceByCodePoint } from "../../lib/ekhata/mai05CodePointOffsets";

describe("MAI-05 code-point offsets", () => {
  it("round-trips Devanagari, emoji, and ASCII", () => {
    const text = "नेपाल hi 😀";
    expect(codePoints(text).length).toBeGreaterThan(5);
    assertSpanRoundTrip(text, 0, 2, sliceByCodePoint(text, 0, 2));
    const smileStart = codePoints(text).indexOf("😀");
    expect(sliceByCodePoint(text, smileStart, smileStart + 1)).toBe("😀");
  });
});
