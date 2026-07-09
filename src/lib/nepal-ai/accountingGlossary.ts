/**
 * Nepal Universal AI — bilingual accounting glossary lookup
 * (definitions / examples for "X k ho", "what is debit", etc.).
 */

import {
  ACCOUNTING_GLOSSARY,
  ACCOUNTING_GLOSSARY_ALIASES,
  type AccountingGlossaryEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(ACCOUNTING_GLOSSARY.map((e) => [e.id, e]));
const BY_CONCEPT = new Map(ACCOUNTING_GLOSSARY.map((e) => [e.conceptKey.toLowerCase(), e]));

/** Aliases sorted longest-first so "trial balance" beats "balance". */
const ALIAS_KEYS = Object.keys(ACCOUNTING_GLOSSARY_ALIASES).sort((a, b) => b.length - a.length);

function normalizeAliasKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getGlossaryByConceptKey(conceptKey: string): AccountingGlossaryEntry | null {
  if (!conceptKey) return null;
  const key = conceptKey.toLowerCase().replace(/\s+/g, "_");
  return BY_CONCEPT.get(key) ?? BY_CONCEPT.get(normalizeAliasKey(conceptKey).replace(/ /g, "_")) ?? null;
}

export function getGlossaryById(id: string): AccountingGlossaryEntry | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Match a user query (or concept slug) against glossary aliases.
 * Prefers longest alias substring matches.
 */
export function matchAccountingGlossary(text: string): AccountingGlossaryEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const spaced = normalizeAliasKey(raw);

  // Direct concept / map hits first
  const direct =
    ACCOUNTING_GLOSSARY_ALIASES[raw] ||
    ACCOUNTING_GLOSSARY_ALIASES[lower] ||
    ACCOUNTING_GLOSSARY_ALIASES[spaced];
  if (direct) {
    return getGlossaryById(direct.id) ?? getGlossaryByConceptKey(direct.conceptKey);
  }

  const conceptGuess = spaced.replace(/ /g, "_");
  const byConcept = getGlossaryByConceptKey(conceptGuess);
  if (byConcept) return byConcept;

  for (const alias of ALIAS_KEYS) {
    const a = alias.toLowerCase();
    if (a.length < 2) continue;
    if (lower.includes(a) || spaced.includes(normalizeAliasKey(alias)) || raw.includes(alias)) {
      const meta = ACCOUNTING_GLOSSARY_ALIASES[alias];
      if (!meta) continue;
      const entry = getGlossaryById(meta.id) ?? getGlossaryByConceptKey(meta.conceptKey);
      if (entry) return entry;
    }
  }
  return null;
}

export function formatGlossaryDefinition(
  entry: AccountingGlossaryEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const related = entry.relatedTerms.length
    ? entry.relatedTerms.join(", ")
    : "";

  if (lang === "english") {
    let out = `**${entry.termEn}** — ${entry.definitionEn}`;
    if (entry.exampleNe) out += `\n\nExample: ${entry.exampleNe}`;
    if (related) out += `\n\nRelated: ${related}`;
    return out;
  }

  // Nepali / mixed — lead with Nepali term + definition; keep example in Nepali
  let out = `**${entry.termNe}** — ${entry.definitionNe}`;
  if (entry.exampleNe) out += `\n\nउदाहरण: ${entry.exampleNe}`;
  if (related) out += `\n\nसम्बन्धित: ${related}`;
  if (lang === "mixed") {
    out += `\n\n(${entry.termEn}: ${entry.definitionEn})`;
  }
  return out;
}
