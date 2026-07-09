/**
 * Nepal Universal AI — Devanagari ↔ roman orthography helpers.
 */

import {
  DEVANAGARI_ROMAN_MAP,
  NEPALI_ORTHOGRAPHY,
  ROMAN_ORTHO_ALIASES,
  type NepaliOrthographyEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(NEPALI_ORTHOGRAPHY.map((e) => [e.id, e]));
const BY_DEVA = new Map(NEPALI_ORTHOGRAPHY.map((e) => [e.devanagari, e]));

/** Longest Devanagari phrases first (e.g. मूल्य अभिवृद्धि कर before मूल्य). */
export const SORTED_DEVANAGARI_KEYS = Object.keys(DEVANAGARI_ROMAN_MAP).sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

export function getOrthographyById(id: string): NepaliOrthographyEntry | null {
  return BY_ID.get(id) ?? null;
}

export function getOrthographyByDevanagari(dev: string): NepaliOrthographyEntry | null {
  return BY_DEVA.get(dev) ?? null;
}

/**
 * Replace known Devanagari lexicon words with NLU roman.
 * Longest phrases first; only whole Devanagari spans (not substrings of longer words).
 * Single-character lexicon entries only match as a standalone word.
 */
export function replaceDevanagariLexicon(text: string): string {
  if (!text) return text;
  let out = text;
  for (const key of SORTED_DEVANAGARI_KEYS) {
    if (!key || !out.includes(key)) continue;
    const roman = DEVANAGARI_ROMAN_MAP[key];
    if (!roman) continue;

    // Skip ultra-short digits/particles as bare substring (छ=six, को, के)
    if (key.length <= 1) {
      const re = new RegExp(`(^|[^\\u0900-\\u097F])${escapeRegExp(key)}(?![\\u0900-\\u097F])`, "g");
      out = out.replace(re, `$1 ${roman} `);
      continue;
    }

    const re = new RegExp(`(?<![\\u0900-\\u097F])${escapeRegExp(key)}(?![\\u0900-\\u097F])`, "g");
    out = out.replace(re, ` ${roman} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fold a roman token via orthography aliases (variants → standard). */
export function foldRomanOrthoToken(token: string): string {
  const t = token.toLowerCase();
  return ROMAN_ORTHO_ALIASES[t] ?? t;
}
