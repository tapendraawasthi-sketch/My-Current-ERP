/**
 * Nepal Universal AI — multi-turn discourse (affirm / negate / correct / maybe).
 */

import { DISCOURSE_MAP } from "./generated/runtimeMaps";

export type DiscourseAction =
  | "confirm_pending"
  | "cancel_pending"
  | "correct_pending"
  | "correct_amount"
  | "clarify_needed"
  | "continue_flow"
  | "confirm_partial"
  | "unknown";

export interface DiscourseMatch {
  action: DiscourseAction;
  type: string;
  strength: string;
  matched: string;
  meaning?: string;
}

/** Tokens that must be the ENTIRE utterance (too ambiguous as substrings). */
const EXACT_ONLY = new Set([
  "ho",
  "la",
  "na",
  "naa",
  "ah",
  "aha",
  "ahaa",
  "um",
  "umm",
  "ji",
  "jee",
  "ok",
  "yes",
  "no",
  "xa",
  "cha",
  "chha",
  "nai",
  "naai",
  "aaja",
  "ajaa",
  "kaha",
  "kahaa",
  "hau",
  "hus",
  "huss",
]);

/**
 * Match discourse cue after confirm/clarify card.
 * Exact whole-message match preferred; short ambiguous tokens require exact equality.
 */
export function detectDiscourseAction(text: string): DiscourseMatch | null {
  const t = text.trim().toLowerCase().replace(/[?!।.]+$/g, "").trim();
  if (!t) return null;

  // Amount correction: "500 hoina 600" OR "hoina 1000" / "nai, 2000 ho"
  if (/\d+\s+(hoina|haina)\s+\d+/i.test(t) || /^(hoina|haina|nai)\s*,?\s*\d+/i.test(t)) {
    return {
      action: "correct_amount",
      type: "correction",
      strength: "strong",
      matched: "amount_correction",
    };
  }
  if (/^sachhi\s+\d+/i.test(t)) {
    return {
      action: "correct_amount",
      type: "correction",
      strength: "strong",
      matched: "sachhi_correction",
    };
  }

  // Longest phrase in map first
  const keys = Object.keys(DISCOURSE_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const exactOnly = EXACT_ONLY.has(key) || key.length <= 2;
    const isExact = t === key;
    if (exactOnly && !isExact) continue;

    if (
      isExact ||
      (!exactOnly &&
        (t.startsWith(`${key} `) || t.endsWith(` ${key}`) || t.includes(` ${key} `)))
    ) {
      const entry = DISCOURSE_MAP[key];
      return {
        action: (entry.multi_turn_action as DiscourseAction) || "unknown",
        type: entry.type,
        strength: entry.strength || "medium",
        matched: key,
        meaning: (entry as { meaning?: string }).meaning,
      };
    }
  }

  return null;
}

export function isAffirmation(text: string): boolean {
  const m = detectDiscourseAction(text);
  return m?.action === "confirm_pending" || m?.type === "affirmation";
}

export function isNegation(text: string): boolean {
  const m = detectDiscourseAction(text);
  return m?.action === "cancel_pending" || m?.type === "negation";
}

export function isCorrection(text: string): boolean {
  const m = detectDiscourseAction(text);
  return (
    m?.action === "correct_pending" ||
    m?.action === "correct_amount" ||
    m?.type === "correction"
  );
}

export function isUncertainty(text: string): boolean {
  const m = detectDiscourseAction(text);
  return m?.action === "clarify_needed" || m?.type === "uncertainty" || m?.type === "partial_confirm";
}
