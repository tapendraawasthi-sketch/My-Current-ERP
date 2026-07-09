/**
 * Plain-language explainers for Nepal Income Tax / VAT / Company / Labor /
 * contract clauses / government circulars (legal_qa, not transactions).
 */

import {
  LEGAL_SECTION_EXPLAINER_ALIASES,
  LEGAL_SECTION_EXPLAINERS,
  LEGAL_SECTION_EXPLAINERS_BY_DOCUMENT,
  type LegalSectionExplainer,
} from "./generated/runtimeMaps";

const BY_ID = new Map(LEGAL_SECTION_EXPLAINERS.map((e) => [e.id, e]));
const ALIAS_KEYS = Object.keys(LEGAL_SECTION_EXPLAINER_ALIASES).sort(
  (a, b) => b.length - a.length,
);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getLegalSectionExplainerById(
  id: string,
): LegalSectionExplainer | null {
  return BY_ID.get(id) ?? null;
}

export function getLegalExplainersByDocument(
  documentType: string,
): LegalSectionExplainer[] {
  const ids = LEGAL_SECTION_EXPLAINERS_BY_DOCUMENT[documentType] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as LegalSectionExplainer[];
}

export function matchLegalSectionExplainer(
  text: string,
): LegalSectionExplainer | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = LEGAL_SECTION_EXPLAINER_ALIASES[cand];
    if (hit) return getLegalSectionExplainerById(hit.id);
  }

  let best: LegalSectionExplainer | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (a.length < 6) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;

    const exactish = spaced === a || spaced.startsWith(a) || a.startsWith(spaced);
    const looseOk =
      /\b(section|clause|circular|tds|vat|agm|ssf|labor|labour|company\s+act|income\s+tax|k\s*ho|ke\s*ho|kasari|matlab|explain|what\s+is|kun|kati)\b/i.test(
        spaced,
      ) || /(के\s*हो|क\s*हो|धारा)/.test(raw);
    if (!exactish && !looseOk) continue;

    if (a.length > bestLen) {
      const entry = getLegalSectionExplainerById(
        LEGAL_SECTION_EXPLAINER_ALIASES[alias].id,
      );
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

export function formatLegalSectionExplainerAnswer(
  entry: LegalSectionExplainer,
  lang: "nepali" | "english" | "mixed",
): string {
  const plain =
    lang === "english" ? entry.plainLanguageEn : entry.plainLanguageNe;
  const bits: string[] = [
    `${entry.documentType} — ${entry.section}`,
    plain,
  ];

  if (entry.practicalExample) {
    bits.push(
      lang === "english"
        ? `Example: ${entry.practicalExample}`
        : `Udharan: ${entry.practicalExample}`,
    );
  }

  if (entry.exceptions?.length) {
    bits.push(
      lang === "english"
        ? `Exceptions: ${entry.exceptions.join("; ")}`
        : `Chhut / exceptions: ${entry.exceptions.join("; ")}`,
    );
  }

  if (entry.relatedSections?.length) {
    bits.push(
      lang === "english"
        ? `Related: ${entry.relatedSections.join(" / ")}`
        : `Sambandhit: ${entry.relatedSections.join(" / ")}`,
    );
  }

  if (entry.commonQuestions?.length) {
    bits.push(
      lang === "english"
        ? `Also ask: ${entry.commonQuestions.join(" / ")}`
        : `Yeti pani sodna milcha: ${entry.commonQuestions.join(" / ")}`,
    );
  }

  return bits.join("\n\n");
}

export type { LegalSectionExplainer };
