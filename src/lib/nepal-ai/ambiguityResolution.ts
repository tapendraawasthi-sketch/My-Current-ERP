/**
 * Ambiguous short utterances → clarify question + ranked interpretations.
 * Complements clarifyErrorPatterns (missing amount/party) with multi-intent goldens.
 */

import {
  AMBIGUITY_RESOLUTION_ALIASES,
  AMBIGUITY_RESOLUTION_BY_TYPE,
  AMBIGUITY_RESOLUTION_PATTERNS,
  type AmbiguityResolutionPattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(AMBIGUITY_RESOLUTION_PATTERNS.map((e) => [e.id, e]));

/** Map user ambiguity_type → clarify_error_patterns errorType style. */
const TYPE_TO_ERROR: Record<string, string> = {
  direction_unclear: "ambiguous_direction",
  intent_unclear: "unclear_intent",
  amount_unclear: "multiple_interpretations",
  party_unclear: "missing_party",
  time_unclear: "unclear_intent",
  multiple_entities: "multiple_interpretations",
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAmbiguityPatternById(id: string): AmbiguityResolutionPattern | null {
  return BY_ID.get(id) ?? null;
}

export function matchAmbiguityResolutionPattern(
  text: string,
  preferredType?: string,
): AmbiguityResolutionPattern | null {
  if (!text?.trim()) return null;
  const key = normalizeKey(text);

  if (preferredType) {
    const ids = AMBIGUITY_RESOLUTION_BY_TYPE[preferredType] ?? [];
    for (const id of ids) {
      const row = BY_ID.get(id);
      if (row && (row.inputNormalized === key || normalizeKey(row.input) === key)) {
        return row;
      }
    }
  }

  const hit = AMBIGUITY_RESOLUTION_ALIASES[key];
  if (hit) return getAmbiguityPatternById(hit.id);

  return null;
}

export function ambiguityClarifyQuestion(entry: AmbiguityResolutionPattern): string {
  return entry.clarifyQuestion;
}

/** Bridge to error_type vocabulary used by parseKhata early clarify. */
export function ambiguityAsClarifyErrorType(entry: AmbiguityResolutionPattern): string {
  return TYPE_TO_ERROR[entry.ambiguityType] ?? "unclear_intent";
}

export type { AmbiguityResolutionPattern };
