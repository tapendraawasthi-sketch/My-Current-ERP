/**
 * Nepal Universal AI — multi-turn discourse (affirm / negate / correct).
 */

import { DISCOURSE_MAP } from "./generated/runtimeMaps";

export type DiscourseAction =
  | "confirm_pending"
  | "cancel_pending"
  | "correct_pending"
  | "correct_amount"
  | "clarify_needed"
  | "continue_flow"
  | "unknown";

export interface DiscourseMatch {
  action: DiscourseAction;
  type: string;
  strength: string;
  matched: string;
}

/** Match whole-message or single-token discourse cues (after confirm card). */
export function detectDiscourseAction(text: string): DiscourseMatch | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // Longest phrase in map first
  const keys = Object.keys(DISCOURSE_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (t === key || t.startsWith(`${key} `) || t.endsWith(` ${key}`) || t.includes(` ${key} `)) {
      const entry = DISCOURSE_MAP[key];
      return {
        action: (entry.multi_turn_action as DiscourseAction) || "unknown",
        type: entry.type,
        strength: entry.strength || "medium",
        matched: key,
      };
    }
  }

  // Amount correction: "500 hoina 600"
  if (/\d+\s+hoina\s+\d+/i.test(t)) {
    return {
      action: "correct_amount",
      type: "correction",
      strength: "strong",
      matched: "amount_correction",
    };
  }

  return null;
}
