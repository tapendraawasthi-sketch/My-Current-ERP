/**
 * MAI-03 frontend helpers — opaque support reference only (no full traces).
 */

import { isValidTraceReference as zodIsValid } from "./mai03TraceTypes";

export {
  CORRELATION_HEADER,
  REQUEST_ID_HEADER,
  TRACE_REF_HEADER,
  generateCorrelationId,
  isValidCorrelationId,
  isValidTraceReference,
  makeOutboundTraceHeaders,
  type OrbixRequestTraceState,
} from "./mai03TraceTypes";

export function displaySupportReference(ref: string | null | undefined): string | null {
  if (!ref || !zodIsValid(ref)) return null;
  return ref;
}

/** Per-request in-memory store — never persist full events to localStorage. */
const currentByConversation = new Map<string, string>();

export function rememberTraceReference(conversationId: string, ref: string | null | undefined): void {
  if (!conversationId || !ref || !zodIsValid(ref)) return;
  currentByConversation.set(conversationId, ref);
}

export function readRememberedTraceReference(conversationId: string): string | null {
  return currentByConversation.get(conversationId) || null;
}

export function clearRememberedTraceReference(conversationId: string): void {
  currentByConversation.delete(conversationId);
}
