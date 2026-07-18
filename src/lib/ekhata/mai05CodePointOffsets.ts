/**
 * MAI-05 Unicode code-point offset helpers for browser consumers.
 * Canonical unit matches Python: UNICODE_CODE_POINT via Array.from(text).
 */

export const OFFSET_UNIT = "UNICODE_CODE_POINT" as const;

export function codePoints(text: string): string[] {
  return Array.from(text);
}

export function sliceByCodePoint(text: string, start: number, end: number): string {
  const cps = Array.from(text);
  if (start < 0 || end < start || end > cps.length) {
    throw new Error("INVALID_CODEPOINT_OFFSET");
  }
  return cps.slice(start, end).join("");
}

export function assertSpanRoundTrip(
  text: string,
  start: number,
  end: number,
  surface: string,
): void {
  if (sliceByCodePoint(text, start, end) !== surface) {
    throw new Error("SPAN_ROUNDTRIP_FAILED");
  }
}
