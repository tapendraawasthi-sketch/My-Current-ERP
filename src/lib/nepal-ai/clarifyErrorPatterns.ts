/**
 * Exact clarify-error patterns (missing amount/party, ambiguous direction, unclear intent).
 * Prefer user_exact clarify_question_ne/en over generic templates.
 */

import {
  CLARIFY_ERROR_ALIASES,
  CLARIFY_ERROR_PATTERNS,
  type ClarifyErrorPattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(CLARIFY_ERROR_PATTERNS.map((e) => [e.id, e]));

function normalizeClarifyKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClarifyErrorById(id: string): ClarifyErrorPattern | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Match user input to a clarify-error pattern.
 * Prefer multiple_interpretations over ambiguous_direction when both exist for the same input.
 */
export function matchClarifyErrorPattern(
  text: string,
  preferredErrorType?: string,
): ClarifyErrorPattern | null {
  if (!text?.trim()) return null;
  const key = normalizeClarifyKey(text);

  if (preferredErrorType) {
    const compound = CLARIFY_ERROR_ALIASES[`${key}||${preferredErrorType}`];
    if (compound) return getClarifyErrorById(compound.id);
  }

  const hit = CLARIFY_ERROR_ALIASES[key];
  if (hit) return getClarifyErrorById(hit.id);

  return null;
}

export function formatClarifyErrorQuestion(
  entry: ClarifyErrorPattern,
  lang: "nepali" | "english" | "mixed",
): string {
  if (lang === "english") return entry.clarifyQuestionEn;
  return entry.clarifyQuestionNe;
}

/** Primary (first) post-clarify intent token from afterClarificationIntent. */
export function primaryClarifyIntentHint(entry: ClarifyErrorPattern): string | null {
  const raw = entry.afterClarificationIntent?.trim();
  if (!raw) return null;
  const first = raw.split("_or_")[0]?.trim();
  return first || null;
}
