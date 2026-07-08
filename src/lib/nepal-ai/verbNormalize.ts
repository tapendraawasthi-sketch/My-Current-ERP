/**
 * Verb normalization from Nepal Universal AI BATCH 02–03 + full verb_normalize_map.json.
 * Maps spoken/typed variants → lemma + semantic tag for NLU.
 */

import {
  VERB_ALIASES,
  type VerbNormalizeEntry,
} from "./generated/runtimeMaps";

export type { VerbNormalizeEntry };

/** Legacy subset kept for tests — full map is in VERB_ALIASES */
const CORE_VERB_ALIASES = VERB_ALIASES;

function sortedKeys(): string[] {
  return Object.keys(VERB_ALIASES).sort((a, b) => b.length - a.length);
}

/** Detect if text contains a known verb variant; returns best match. */
export function detectVerbInText(text: string): VerbNormalizeEntry | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  for (const key of sortedKeys()) {
    if (t.includes(key)) return VERB_ALIASES[key];
  }
  return null;
}

/** Expand typos in text using verb aliases (whole-word). Skips completion auxiliaries (hunu). */
export function expandVerbAliases(text: string): string {
  let out = ` ${text.toLowerCase()} `;
  const sorted = sortedKeys().filter((key) => VERB_ALIASES[key].lemma !== "hunu");
  for (const key of sorted) {
    const canon = VERB_ALIASES[key].lemma.split(" ")[0];
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, ` ${canon} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

export { CORE_VERB_ALIASES, VERB_ALIASES };
