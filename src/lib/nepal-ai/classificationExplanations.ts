/**
 * Classification explanation teaching goldens — why AI classified, asked,
 * corrected, or sourced an answer (transparency / user education).
 */

import {
  CLASSIFICATION_EXPLANATION_ALIASES,
  CLASSIFICATION_EXPLANATIONS,
  CLASSIFICATION_EXPLANATIONS_BY_TYPE,
  type ClassificationExplanation,
} from "./generated/runtimeMaps";

const BY_ID = new Map(CLASSIFICATION_EXPLANATIONS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClassificationExplanationById(id: string): ClassificationExplanation | null {
  return BY_ID.get(id) ?? null;
}

export function getClassificationExplanationsByType(
  explanationTypeKey: string,
): ClassificationExplanation[] {
  const ids = CLASSIFICATION_EXPLANATIONS_BY_TYPE[explanationTypeKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as ClassificationExplanation[];
}

/** Exact golden match on user follow-up question or explain_id. */
export function matchClassificationExplanation(text: string): ClassificationExplanation | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = CLASSIFICATION_EXPLANATION_ALIASES[cand];
    if (hit) return getClassificationExplanationById(hit.id);
  }

  return null;
}

export function formatClassificationExplanation(
  entry: ClassificationExplanation,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const body =
    lang === "english"
      ? entry.explanationEn
      : lang === "nepali"
        ? entry.explanationNe
        : entry.explanationNe;

  const lines = [body];

  if (entry.conceptsExplained.length > 0) {
    lines.push("");
    lines.push(
      lang === "english"
        ? "Concepts:"
        : lang === "nepali"
          ? "Concepts:"
          : "Concepts:",
    );
    for (const c of entry.conceptsExplained) {
      lines.push(`• ${c}`);
    }
  }

  return lines.join("\n");
}

export function tryClassificationExplanation(
  input: string,
  lang: "english" | "nepali" | "mixed" = "mixed",
): { answer: string; explainId: string } | null {
  const match = matchClassificationExplanation(input);
  if (!match) return null;
  return {
    answer: formatClassificationExplanation(match, lang),
    explainId: match.explainId,
  };
}
