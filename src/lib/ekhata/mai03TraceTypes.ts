/** MAI-03 trace identity helpers shared by browser clients (Zod-free, pure). */

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TRACE_REF_RE = /^tr_[0-9a-fA-F]{8}_[0-9a-fA-F]{8}$/;

export const CORRELATION_HEADER = "X-Correlation-ID";
export const REQUEST_ID_HEADER = "X-Request-ID";
export const TRACE_REF_HEADER = "X-Trace-Reference";
export const MAX_CORRELATION_HEADER_LENGTH = 128;

export function isValidCorrelationId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > MAX_CORRELATION_HEADER_LENGTH) return false;
  return UUID_RE.test(text);
}

export function isValidTraceReference(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return TRACE_REF_RE.test(text) && text.length <= 64;
}

export function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback opaque id (non-crypto) — server revalidates.
  return "00000000-0000-4000-8000-000000000000";
}

export function makeOutboundTraceHeaders(existing?: string | null): Record<string, string> {
  const corr = isValidCorrelationId(existing) ? String(existing).trim() : generateCorrelationId();
  return {
    [CORRELATION_HEADER]: corr,
  };
}

export interface OrbixRequestTraceState {
  conversationId: string;
  correlationId: string;
  traceReference: string | null;
}
