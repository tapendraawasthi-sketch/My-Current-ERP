/**
 * Multi-clause Nepali shop-owner transaction narratives (partial payment, split pay, netting, etc.).
 * Exact goldens for clarify-on-ambiguous complex utterances in parseKhata.
 */

import {
  COMPLEX_TRANSACTION_ALIASES,
  COMPLEX_TRANSACTION_BY_TYPE,
  COMPLEX_TRANSACTION_NARRATIVES,
  type ComplexTransactionNarrative,
} from "./generated/runtimeMaps";

const BY_ID = new Map(COMPLEX_TRANSACTION_NARRATIVES.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getComplexTransactionNarrativeById(
  id: string,
): ComplexTransactionNarrative | null {
  return BY_ID.get(id) ?? null;
}

export function getComplexNarrativesByType(
  complexityType: string,
): ComplexTransactionNarrative[] {
  const ids = COMPLEX_TRANSACTION_BY_TYPE[complexityType] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as ComplexTransactionNarrative[];
}

/** Exact normalized/input golden match. */
export function matchComplexTransactionNarrative(
  text: string,
): ComplexTransactionNarrative | null {
  if (!text?.trim()) return null;
  const key = normalizeKey(text);

  const hit =
    COMPLEX_TRANSACTION_ALIASES[key] ??
    COMPLEX_TRANSACTION_ALIASES[text.trim()];
  if (hit) return getComplexTransactionNarrativeById(hit.id);

  return null;
}

export function complexTransactionClarifyQuestion(
  entry: ComplexTransactionNarrative,
): string | null {
  if (!entry.needsClarify) return null;
  return entry.clarifyReason?.trim() || null;
}

export type { ComplexTransactionNarrative };
