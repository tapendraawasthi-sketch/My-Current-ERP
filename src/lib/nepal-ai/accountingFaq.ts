/**
 * Nepal Universal AI — accounting FAQ Q&A lookup
 * (erp k ho, VAT kasari calculate, process/calculation answers; NOT_transaction).
 */

import {
  ACCOUNTING_FAQ,
  ACCOUNTING_FAQ_ALIASES,
  type AccountingFaqEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(ACCOUNTING_FAQ.map((e) => [e.id, e]));

/** Aliases sorted longest-first so full questions beat short stems. */
const ALIAS_KEYS = Object.keys(ACCOUNTING_FAQ_ALIASES).sort((a, b) => b.length - a.length);

function normalizeFaqKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFaqById(id: string): AccountingFaqEntry | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Match a user question against FAQ aliases.
 * Prefer exact normalized match, then longest alias substring.
 */
export function matchAccountingFaq(text: string): AccountingFaqEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeFaqKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = ACCOUNTING_FAQ_ALIASES[cand];
    if (hit) return getFaqById(hit.id);
  }

  let best: AccountingFaqEntry | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeFaqKey(alias);
    if (a.length < 4) continue;
    if (spaced === a || spaced.includes(a) || a.includes(spaced)) {
      // Exact or near-exact preferred; substring needs question-like query (not a raw journal line)
      const exactish = spaced === a || spaced.startsWith(a) || a.startsWith(spaced);
      const looseOk =
        /\b(k\s*ho|ke\s*ho|kasari|kaise|matlab|what\s+is|how\s+to|define|explain|kati)\b/i.test(spaced) ||
        /(के\s*हो|क\s*हो)/.test(raw);
      if (!exactish && !looseOk) continue;
      if (a.length > bestLen) {
        const entry = getFaqById(ACCOUNTING_FAQ_ALIASES[alias].id);
        if (entry) {
          best = entry;
          bestLen = a.length;
        }
      }
    }
  }
  return best;
}

export function formatFaqAnswer(
  entry: AccountingFaqEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const related = entry.relatedQuestions.length
    ? entry.relatedQuestions.join(", ")
    : "";

  if (lang === "english") {
    let out = entry.answerEn;
    if (related) out += `\n\nRelated: ${related}`;
    return out;
  }

  let out = entry.answerNe;
  if (entry.answerShortNe) out += `\n\n(${entry.answerShortNe})`;
  if (related) out += `\n\nसम्बन्धित: ${related}`;
  if (lang === "mixed") {
    out += `\n\n—\n${entry.answerEn}`;
  }
  return out;
}
