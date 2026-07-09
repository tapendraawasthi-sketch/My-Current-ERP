/**
 * Nepal Universal AI — multi-sector business term vocabulary
 * (restaurant, hardware, pharmacy, transport, education, agriculture).
 */

import {
  SECTOR_TERM_ALIASES,
  SECTOR_TERM_VOCABULARY,
  type SectorTermEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(SECTOR_TERM_VOCABULARY.map((e) => [e.id, e]));
const BY_CONCEPT = new Map(
  SECTOR_TERM_VOCABULARY.map((e) => [e.conceptKey.toLowerCase(), e]),
);

/** Longest alias first so "service charge" beats "charge", "home delivery" beats "delivery". */
const ALIAS_KEYS = Object.keys(SECTOR_TERM_ALIASES).sort((a, b) => b.length - a.length);

/** Short tokens that need a word boundary / sector cue to avoid noise. */
const NOISY_SHORT = new Set([
  "tip",
  "fee",
  "mal",
  "rod",
  "veg",
  "batch",
  "brand",
  "salt",
  "dose",
  "rent",
  "fuel",
  "meal",
  "book",
  "crop",
  "lot",
  "sem",
  "pani",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSectorTermById(id: string): SectorTermEntry | null {
  return BY_ID.get(id) ?? null;
}

export function getSectorTermByConcept(conceptKey: string): SectorTermEntry | null {
  if (!conceptKey) return null;
  const key = conceptKey.toLowerCase().replace(/\s+/g, "_");
  return BY_CONCEPT.get(key) ?? BY_CONCEPT.get(normalize(conceptKey).replace(/ /g, "_")) ?? null;
}

export function matchSectorTerm(text: string): SectorTermEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const spaced = normalize(raw);

  const direct =
    SECTOR_TERM_ALIASES[raw] ||
    SECTOR_TERM_ALIASES[lower] ||
    SECTOR_TERM_ALIASES[spaced];
  if (direct) {
    return getSectorTermById(direct.id) ?? getSectorTermByConcept(direct.conceptKey);
  }

  const conceptGuess = spaced.replace(/ /g, "_");
  const byConcept = getSectorTermByConcept(conceptGuess);
  if (byConcept) return byConcept;

  for (const alias of ALIAS_KEYS) {
    const a = alias.toLowerCase();
    if (a.length < 2) continue;

    const isShortNoise = NOISY_SHORT.has(a) || (a.length <= 3 && !/\s/.test(a));
    if (isShortNoise) {
      const re = new RegExp(`(?:^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i");
      if (!re.test(lower) && !re.test(spaced)) continue;
    } else if (!(lower.includes(a) || spaced.includes(normalize(alias)) || raw.includes(alias))) {
      continue;
    }

    const meta = SECTOR_TERM_ALIASES[alias];
    if (!meta) continue;
    const entry = getSectorTermById(meta.id) ?? getSectorTermByConcept(meta.conceptKey);
    if (entry) return entry;
  }
  return null;
}

/** All sector-term hits in text (longest-first, non-overlapping spans preferred). */
export function matchAllSectorTerms(text: string): SectorTermEntry[] {
  if (!text?.trim()) return [];
  const lower = text.toLowerCase();
  const spaced = normalize(text);
  const found: SectorTermEntry[] = [];
  const seen = new Set<string>();
  let covered = " ".repeat(spaced.length);

  for (const alias of ALIAS_KEYS) {
    const a = normalize(alias);
    if (a.length < 2) continue;
    const idx = spaced.indexOf(a);
    if (idx < 0 && !lower.includes(alias.toLowerCase())) continue;

    const start = idx >= 0 ? idx : spaced.indexOf(normalize(alias));
    if (start < 0) continue;
    const end = start + a.length;
    if (covered.slice(start, end).includes("x")) continue;

    const meta = SECTOR_TERM_ALIASES[alias];
    if (!meta || seen.has(meta.id)) continue;
    const entry = getSectorTermById(meta.id);
    if (!entry) continue;
    seen.add(meta.id);
    found.push(entry);
    covered =
      covered.slice(0, start) + "x".repeat(end - start) + covered.slice(end);
  }
  return found;
}

export function formatSectorTermDefinition(
  entry: SectorTermEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const txs = entry.typicalTransactions.length
    ? entry.typicalTransactions.join("; ")
    : "";
  const variants = entry.variants.filter((v) => v.toLowerCase() !== entry.term.toLowerCase());
  const varLine = variants.length ? variants.join(", ") : "";

  if (lang === "english") {
    let out = `**${entry.term}** (${entry.sector}) — ${entry.meaningEn}`;
    if (varLine) out += `\n\nAlso: ${varLine}`;
    if (txs) out += `\n\nTypical transactions: ${txs}`;
    return out;
  }

  let out = `**${entry.term}** (${entry.sector}) — ${entry.meaningNe}`;
  if (varLine) out += `\n\nAru: ${varLine}`;
  if (txs) out += `\n\nHisab ma: ${txs}`;
  if (lang === "mixed") {
    out += `\n\n(${entry.meaningEn})`;
  }
  return out;
}

/** Lightweight sector vote from matched terms (for detectBusinessSector boost). */
export function voteSectorFromTerms(text: string): {
  sector: string;
  sectorSlug: string;
  score: number;
  terms: SectorTermEntry[];
} | null {
  const hits = matchAllSectorTerms(text);
  if (!hits.length) return null;
  const tallies = new Map<string, { sector: string; sectorSlug: string; score: number; terms: SectorTermEntry[] }>();
  for (const h of hits) {
    const cur = tallies.get(h.sector) ?? {
      sector: h.sector,
      sectorSlug: h.sectorSlug,
      score: 0,
      terms: [],
    };
    cur.score += 1 + Math.min(h.term.length / 10, 1);
    cur.terms.push(h);
    tallies.set(h.sector, cur);
  }
  return [...tallies.values()].sort((a, b) => b.score - a.score)[0] ?? null;
}
