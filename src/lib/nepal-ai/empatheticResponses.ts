/**
 * Empathetic support replies for frustrated/confused/stressed/happy/angry/sad user messages.
 * Wired into emotionalBrain before generic emotional reply templates.
 */

import {
  EMPATHETIC_RESPONSE_ALIASES,
  EMPATHETIC_RESPONSE_BY_EMOTION,
  EMPATHETIC_RESPONSE_PATTERNS,
  type EmpatheticResponsePattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(EMPATHETIC_RESPONSE_PATTERNS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getEmpatheticResponseById(id: string): EmpatheticResponsePattern | null {
  return BY_ID.get(id) ?? null;
}

export function getEmpatheticResponsesByEmotion(
  emotion: string,
): EmpatheticResponsePattern[] {
  const ids = EMPATHETIC_RESPONSE_BY_EMOTION[emotion] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as EmpatheticResponsePattern[];
}

/** Exact golden user_input → empathetic reply. */
export function matchEmpatheticResponse(
  text: string,
  preferredEmotion?: string,
): EmpatheticResponsePattern | null {
  if (!text?.trim()) return null;
  const key = normalizeKey(text);

  if (preferredEmotion) {
    const ids = EMPATHETIC_RESPONSE_BY_EMOTION[preferredEmotion] ?? [];
    for (const id of ids) {
      const row = BY_ID.get(id);
      if (
        row &&
        (row.userInputNormalized === key || normalizeKey(row.userInput) === key)
      ) {
        return row;
      }
    }
  }

  const hit = EMPATHETIC_RESPONSE_ALIASES[key] ?? EMPATHETIC_RESPONSE_ALIASES[text.trim()];
  if (hit) return getEmpatheticResponseById(hit.id);

  return null;
}

export type { EmpatheticResponsePattern };
