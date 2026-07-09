/**
 * Financial statement interpretation goldens — sample BS/P&L/CF/TB/bank recon
 * with ratio Q&A and Nepali/English mixed questions.
 */

import {
  FINANCIAL_STATEMENT_INTERPRETATION_ALIASES,
  FINANCIAL_STATEMENT_INTERPRETATIONS,
  FINANCIAL_STATEMENT_INTERPRETATIONS_BY_TYPE,
  type FinancialStatementInterpretation,
  type FinancialStatementQa,
} from "./generated/runtimeMaps";

const BY_ID = new Map(
  FINANCIAL_STATEMENT_INTERPRETATIONS.map((e) => [e.id, e]),
);
const ALIAS_KEYS = Object.keys(FINANCIAL_STATEMENT_INTERPRETATION_ALIASES).sort(
  (a, b) => b.length - a.length,
);

export interface FinancialStatementMatch {
  entry: FinancialStatementInterpretation;
  matchedQa: FinancialStatementQa | null;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFinancialStatementInterpretationById(
  id: string,
): FinancialStatementInterpretation | null {
  return BY_ID.get(id) ?? null;
}

export function getFinancialStatementInterpretationsByType(
  statementTypeKey: string,
): FinancialStatementInterpretation[] {
  const ids = FINANCIAL_STATEMENT_INTERPRETATIONS_BY_TYPE[statementTypeKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as FinancialStatementInterpretation[];
}

function findQuestionMatch(
  text: string,
  entry: FinancialStatementInterpretation,
): FinancialStatementQa | null {
  const spaced = normalizeKey(text);
  let best: FinancialStatementQa | null = null;
  let bestLen = 0;

  for (const qa of entry.questionsAboutThis) {
    const q = normalizeKey(qa.q);
    if (!q) continue;
    if (spaced === q || spaced.includes(q) || q.includes(spaced)) {
      if (q.length > bestLen) {
        best = qa;
        bestLen = q.length;
      }
    }
  }
  return best;
}

function aliasMatch(text: string): FinancialStatementInterpretation | null {
  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = FINANCIAL_STATEMENT_INTERPRETATION_ALIASES[cand];
    if (hit) return getFinancialStatementInterpretationById(hit.id);
  }

  let best: FinancialStatementInterpretation | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (a.length < 5) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;
    if (a.length > bestLen) {
      const entry = getFinancialStatementInterpretationById(
        FINANCIAL_STATEMENT_INTERPRETATION_ALIASES[alias].id,
      );
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

/** Match user text to a financial statement golden + optional Q&A pair. */
export function matchFinancialStatementInterpretation(
  text: string,
): FinancialStatementMatch | null {
  if (!text?.trim()) return null;

  const aliasHit = aliasMatch(text);
  if (aliasHit) {
    return {
      entry: aliasHit,
      matchedQa: findQuestionMatch(text, aliasHit),
    };
  }

  let bestEntry: FinancialStatementInterpretation | null = null;
  let bestQa: FinancialStatementQa | null = null;
  let bestLen = 0;

  for (const entry of FINANCIAL_STATEMENT_INTERPRETATIONS) {
    const qa = findQuestionMatch(text, entry);
    if (qa) {
      const qLen = normalizeKey(qa.q).length;
      if (qLen > bestLen) {
        bestEntry = entry;
        bestQa = qa;
        bestLen = qLen;
      }
    }
  }

  if (bestEntry) {
    return { entry: bestEntry, matchedQa: bestQa };
  }
  return null;
}

export function isFinancialStatementInterpretationQuery(text: string): boolean {
  const t = normalizeKey(text);
  if (
    /\b(balance sheet|trial balance|bank reconciliation|cash flow|profit\s*&?\s*loss|income statement|current ratio|quick ratio|debt[\s-]equity|working capital|gross margin|net margin|free cash flow|adjusted bank balance)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /(वासलात|ट्रायल ब्यालेन्स|बैंक मिलान|नगद प्रवाह|नाफा नोक्सान|करेन्ट रेसियो|कार्यशील पूँजी|कुल सम्पत्ति|कुल दायित्व|मार्जिन|kati\??$)/i.test(
      text,
    )
  ) {
    return true;
  }
  return matchFinancialStatementInterpretation(text) !== null;
}

export function formatFinancialStatementInterpretationAnswer(
  match: FinancialStatementMatch,
  lang: "nepali" | "english" | "mixed",
): string {
  const { entry, matchedQa } = match;
  const heading = String(entry.sampleData.heading ?? "").replace(/\\n/g, " — ");

  if (matchedQa) {
    if (lang === "english") {
      return (
        `**${entry.statementType}** (${entry.id})\n\n` +
        `**Question:** ${matchedQa.q}\n\n` +
        `**Answer:** ${matchedQa.a}\n\n` +
        `**Context:** ${heading}\n\n` +
        `**Interpretation:** ${entry.interpretation}`
      );
    }
    return (
      `**${entry.statementType}** (${entry.id})\n\n` +
      `**प्रश्न:** ${matchedQa.q}\n\n` +
      `**उत्तर:** ${matchedQa.a}\n\n` +
      `**सन्दर्भ:** ${heading}\n\n` +
      `**व्याख्या:** ${entry.interpretation}`
    );
  }

  const sampleQs = entry.questionsAboutThis
    .map((qa) => `• ${qa.q} → ${qa.a}`)
    .join("\n");

  if (lang === "english") {
    return (
      `**${entry.statementType}** (${entry.format}, ${entry.id})\n\n` +
      `**Sample:** ${heading}\n\n` +
      `**Example Q&A:**\n${sampleQs}\n\n` +
      `**Interpretation:** ${entry.interpretation}`
    );
  }

  return (
    `**${entry.statementType}** (${entry.format}, ${entry.id})\n\n` +
    `**नमूना:** ${heading}\n\n` +
    `**उदाहरण प्रश्न-उत्तर:**\n${sampleQs}\n\n` +
    `**व्याख्या:** ${entry.interpretation}`
  );
}

export type { FinancialStatementInterpretation };
