/**
 * Nepal Universal AI — multi-sector retail item lexicon matcher.
 * Longest-alias-first; optional sector/context cue to resolve collisions.
 */

import {
  RETAIL_ITEM_ALIASES,
  RETAIL_ITEMS,
  type RetailItemAlias,
  type RetailItemEntry,
} from "./generated/runtimeMaps";

const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

function normalizeItemText(text: string): string {
  return text
    .replace(/[०-९]/g, (ch) => NEPALI_DIGIT_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[^\w\u0900-\u097F\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ITEM_BY_ID = new Map(RETAIL_ITEMS.map((i) => [i.id, i]));

type AliasForm = { form: string; alias: RetailItemAlias };

const ALIAS_FORMS: AliasForm[] = (() => {
  const out: AliasForm[] = [];
  for (const [formRaw, alias] of Object.entries(RETAIL_ITEM_ALIASES)) {
    const form = normalizeItemText(formRaw);
    if (!form) continue;
    // Skip ultra-short ASCII tokens that are too noisy alone (keep Devanagari short ok if present)
    if (/^[a-z]{1,2}$/.test(form)) continue;
    out.push({ form, alias });
  }
  out.sort((a, b) => b.form.length - a.form.length);
  return out;
})();

/** Domain cue words that bias collision resolution. */
const SECTOR_CUES: Record<string, RegExp> = {
  pharmacy: /\b(ausadhi|dawai|medicine|goli|tablet\s+dinu|strip|syrup|pharmacy|clinic|dukhai|allergy|paracetamol|painkiller)\b/i,
  electronics: /\b(mobile|phone|laptop|computer|screen|warranty|charger|android|ipad|electronics|gadget)\b/i,
  food_restaurant: /\b(khaane|khane|plate|order|piune|cup|thali|menu|restaurant|hotel|cafe|serve)\b/i,
  kirana_grocery: /\b(kg|litre|liter|packet|kinna|lina\s+aako|pasal|kirana|bhaau|mulya|stock)\b/i,
  stationery: /\b(copy|pen|pencil|print|xerox|photocopy|school|office\s+file|geometry)\b/i,
  hardware_construction: /\b(siment|cement|sariya|bajri|gitti|construction|building|casting|tipper)\b/i,
  clothing_apparel: /\b(size|fit|wear|lagaaune|lagaune|kapada|clothes|dress|shoes|jutta)\b/i,
  fuel_energy: /\b(petrol|diesel|pump|cylinder|fuel|tank|daaura|mattitel)\b/i,
};

function preferAlias(alias: RetailItemAlias, text: string): RetailItemAlias {
  if (!alias.alternatives?.length) return alias;
  const t = normalizeItemText(text);
  const candidates: RetailItemAlias[] = [
    alias,
    ...alias.alternatives.map((a) => ({
      canonical: a.canonical,
      itemId: a.itemId,
      sector: a.sector,
      sectorSlug: a.sectorSlug,
      typicalUnit: alias.typicalUnit,
    })),
  ];

  let best = candidates[0]!;
  // Primary alias wins unless an alternative has a clear context cue
  let bestScore = 1;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    let score = i === 0 ? 1 : 0;
    const cue = SECTOR_CUES[c.sector];
    if (cue?.test(t)) score += 5;
    if (c.canonical === "tea" && /\b(piune|cup|ek\s+cup)\b/.test(t)) score += 3;
    if (c.canonical === "chah" && /\b(patti|packet|dust)\b/.test(t)) score += 3;
    if (
      c.canonical === "tablet medicine" &&
      /\b(dawai|ausadhi|goli|strip|pain|dukhai|allergy|paracetamol|painkiller)\b/.test(t)
    ) {
      score += 4;
    }
    if (c.canonical === "tablet" && /\b(ipad|android|screen|gadget|laptop|computer)\b/.test(t)) {
      score += 4;
    }
    if (c.canonical === "laptop" && /\b(laptop|laptap|computer|service)\b/.test(t)) score += 4;
    if (c.canonical === "notebook" && /\b(diary|register|school|copy|dinus|dinu)\b/.test(t)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export type RetailItemMatch = {
  canonical: string;
  itemId: string;
  sector: string;
  sectorSlug: string;
  typicalUnit: string;
  matched: string;
  entry?: RetailItemEntry;
};

/**
 * Match longest retail-item alias in text (word-boundary aware).
 */
export function matchRetailItem(text: string): RetailItemMatch | null {
  const t = normalizeItemText(text);
  if (!t) return null;

  for (const { form, alias } of ALIAS_FORMS) {
    if (t === form) {
      const chosen = preferAlias(alias, t);
      return toMatch(chosen, form);
    }
    const idx = t.indexOf(form);
    if (idx < 0) continue;
    const beforeOk = idx === 0 || /[\s\-/]/.test(t[idx - 1]!);
    const afterOk = idx + form.length === t.length || /[\s\-/]/.test(t[idx + form.length]!);
    if (!beforeOk || !afterOk) continue;
    // Avoid matching ultrashort forms mid-dense tokens already handled by boundaries
    if (form.length < 3 && !/[\u0900-\u097F]/.test(form)) continue;
    const chosen = preferAlias(alias, t);
    return toMatch(chosen, form);
  }
  return null;
}

function toMatch(alias: RetailItemAlias, matched: string): RetailItemMatch {
  const entry = ITEM_BY_ID.get(alias.itemId);
  return {
    canonical: alias.canonical,
    itemId: alias.itemId,
    sector: alias.sector,
    sectorSlug: alias.sectorSlug,
    typicalUnit: alias.typicalUnit || entry?.typicalUnit || "",
    matched,
    entry,
  };
}

/** Canonical item name for journal entity extraction, or null. */
export function extractRetailItemName(text: string): string | null {
  return matchRetailItem(text)?.canonical ?? null;
}

/** Sector slug hint from an item mention (boosts detectBusinessSector). */
export function sectorFromRetailItem(text: string): string | null {
  return matchRetailItem(text)?.sectorSlug ?? null;
}
