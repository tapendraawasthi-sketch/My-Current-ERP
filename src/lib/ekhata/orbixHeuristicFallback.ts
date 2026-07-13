/**
 * @deprecated Text-heuristic fallbacks for older Orbix backends that only return prose.
 * Never enable posting, confirmation, or draft mutation from these helpers alone.
 * Prefer structured `response_type` / adapter payloads.
 */

const DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

function warnDeprecated(name: string): void {
  if (DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[orbix-heuristic-fallback] Using deprecated text heuristic: ${name}`);
  }
}

/** @deprecated Prefer response_type === "mode_restriction" */
export function heuristicIsModeRestriction(text: string): boolean {
  warnDeprecated("mode_restriction");
  return /switch to accountant|accountant mode|ask mode.*read.?only|requires \*\*Accountant/i.test(
    text,
  );
}

/** @deprecated Prefer response_type === "provider_offline" */
export function heuristicIsProviderOffline(text: string): boolean {
  warnDeprecated("provider_offline");
  return /temporarily limited|could not reach the ai service|oip provider runtime offline/i.test(
    text,
  );
}

/** @deprecated Prefer response_type === "clarification_required" */
export function heuristicIsClarification(text: string): boolean {
  warnDeprecated("clarification");
  return /started a purchase|still need|please tell me|more information needed|awaiting clarification/i.test(
    text,
  );
}

export type HeuristicKind =
  | "mode_restriction"
  | "clarification_required"
  | "provider_offline"
  | null;

/**
 * Last-resort classifier when complete event lacks structured discriminators.
 * Must never produce confirmation/posting capability.
 */
export function classifyAssistantTextHeuristic(text: string): HeuristicKind {
  if (!text.trim()) return null;
  if (heuristicIsProviderOffline(text)) return "provider_offline";
  if (heuristicIsModeRestriction(text)) return "mode_restriction";
  if (heuristicIsClarification(text)) return "clarification_required";
  return null;
}
