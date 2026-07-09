/**
 * Nepal tax / VAT / TDS / customs FAQ (FY-dated, legal-referenced).
 * Prefer over generic accounting FAQ for tax questions.
 */

import {
  NEPAL_TAX_FAQ,
  NEPAL_TAX_FAQ_ALIASES,
  type NepalTaxFaqEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(NEPAL_TAX_FAQ.map((e) => [e.id, e]));
const ALIAS_KEYS = Object.keys(NEPAL_TAX_FAQ_ALIASES).sort((a, b) => b.length - a.length);

function normalizeFaqKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNepalTaxFaqById(id: string): NepalTaxFaqEntry | null {
  return BY_ID.get(id) ?? null;
}

export function matchNepalTaxFaq(text: string): NepalTaxFaqEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeFaqKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = NEPAL_TAX_FAQ_ALIASES[cand];
    if (hit) return getNepalTaxFaqById(hit.id);
  }

  let best: NepalTaxFaqEntry | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeFaqKey(alias);
    if (a.length < 4) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;

    const exactish = spaced === a || spaced.startsWith(a) || a.startsWith(spaced);
    const looseOk =
      /\b(k\s*ho|ke\s*ho|kasari|kaise|matlab|what\s+is|how\s+to|when|which|define|explain|kati|rate|tax|vat|tds|pan|excise|customs|duty)\b/i.test(
        spaced,
      ) || /(के\s*हो|क\s*हो)/.test(raw);
    if (!exactish && !looseOk) continue;

    if (a.length > bestLen) {
      const entry = getNepalTaxFaqById(NEPAL_TAX_FAQ_ALIASES[alias].id);
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

export function formatNepalTaxFaqAnswer(
  entry: NepalTaxFaqEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const body = lang === "english" ? entry.answerEn : entry.answerNe;
  const bits: string[] = [body];
  if (entry.legalReference) {
    bits.push(
      lang === "english"
        ? `Ref: ${entry.legalReference}`
        : `Sandarbha: ${entry.legalReference}`,
    );
  }
  if (entry.currentAsOf) {
    bits.push(
      lang === "english"
        ? `Current as of: ${entry.currentAsOf}`
        : `Lageko: ${entry.currentAsOf}`,
    );
  }
  const follow = entry.commonFollowups?.length
    ? entry.commonFollowups.join(" / ")
    : "";
  if (follow) {
    bits.push(
      lang === "english" ? `Related: ${follow}` : `Sambandhit: ${follow}`,
    );
  }
  return bits.join("\n\n");
}

export type { NepalTaxFaqEntry };
