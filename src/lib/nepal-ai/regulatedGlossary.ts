/**
 * Nepal Universal AI — regulated tax / company / labor / banking / land / legal glossary.
 */

import {
  NEPAL_REGULATED_GLOSSARY,
  NEPAL_REGULATED_GLOSSARY_ALIASES,
  type NepalRegulatedGlossaryEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(NEPAL_REGULATED_GLOSSARY.map((e) => [e.id, e]));
const BY_CONCEPT = new Map(
  NEPAL_REGULATED_GLOSSARY.map((e) => [e.conceptKey.toLowerCase(), e]),
);

/** Aliases sorted longest-first so multi-word phrases beat short tokens. */
const ALIAS_KEYS = Object.keys(NEPAL_REGULATED_GLOSSARY_ALIASES).sort(
  (a, b) => b.length - a.length,
);

function normalizeAliasKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRegulatedByConceptKey(
  conceptKey: string,
): NepalRegulatedGlossaryEntry | null {
  if (!conceptKey) return null;
  const key = conceptKey.toLowerCase().replace(/\s+/g, "_");
  return (
    BY_CONCEPT.get(key) ??
    BY_CONCEPT.get(normalizeAliasKey(conceptKey).replace(/ /g, "_")) ??
    null
  );
}

export function getRegulatedById(id: string): NepalRegulatedGlossaryEntry | null {
  return BY_ID.get(id) ?? null;
}

export function matchRegulatedGlossary(text: string): NepalRegulatedGlossaryEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const spaced = normalizeAliasKey(raw);

  const direct =
    NEPAL_REGULATED_GLOSSARY_ALIASES[raw] ||
    NEPAL_REGULATED_GLOSSARY_ALIASES[lower] ||
    NEPAL_REGULATED_GLOSSARY_ALIASES[spaced];
  if (direct) {
    return getRegulatedById(direct.id) ?? getRegulatedByConceptKey(direct.conceptKey);
  }

  const conceptGuess = spaced.replace(/ /g, "_");
  const byConcept = getRegulatedByConceptKey(conceptGuess);
  if (byConcept) return byConcept;

  for (const alias of ALIAS_KEYS) {
    const a = alias.toLowerCase();
    if (a.length < 2) continue;
    if (lower.includes(a) || spaced.includes(normalizeAliasKey(alias)) || raw.includes(alias)) {
      const meta = NEPAL_REGULATED_GLOSSARY_ALIASES[alias];
      if (!meta) continue;
      const entry = getRegulatedById(meta.id) ?? getRegulatedByConceptKey(meta.conceptKey);
      if (entry) return entry;
    }
  }
  return null;
}

function formatRates(rates: Record<string, string>, lang: "nepali" | "english" | "mixed"): string {
  const entries = Object.entries(rates).filter(([, v]) => v != null && String(v).length > 0);
  if (!entries.length) return "";
  const label = lang === "english" ? "Current rates" : "हालको दर";
  const lines = entries.map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${v}`).join("\n");
  return `\n\n**${label}:**\n${lines}`;
}

export function formatRegulatedDefinition(
  entry: NepalRegulatedGlossaryEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const related = entry.relatedTerms.length ? entry.relatedTerms.join(", ") : "";
  const full =
    entry.fullForm && entry.fullForm.trim()
      ? lang === "english"
        ? ` (${entry.fullForm})`
        : ` (${entry.fullForm})`
      : "";

  if (lang === "english") {
    let out = `**${entry.termEn}**${full} — ${entry.definitionEn}`;
    out += formatRates(entry.currentRates, lang);
    if (entry.legalReference) out += `\n\n**Legal reference:** ${entry.legalReference}`;
    if (related) out += `\n\nRelated: ${related}`;
    return out;
  }

  let out = `**${entry.termNe}**${full} — ${entry.definitionNe}`;
  out += formatRates(entry.currentRates, lang);
  if (entry.legalReference) out += `\n\n**कानूनी सन्दर्भ:** ${entry.legalReference}`;
  if (related) out += `\n\nसम्बन्धित: ${related}`;
  if (lang === "mixed") {
    out += `\n\n(${entry.termEn}: ${entry.definitionEn})`;
  }
  return out;
}
