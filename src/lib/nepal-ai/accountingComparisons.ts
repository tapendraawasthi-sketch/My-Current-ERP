/**
 * Accounting concept comparisons — side-by-side tables with Nepali Q&A.
 */

import {
  ACCOUNTING_COMPARISON_ALIASES,
  ACCOUNTING_COMPARISONS,
  ACCOUNTING_COMPARISONS_BY_TOPIC,
  type AccountingComparison,
} from "./generated/runtimeMaps";

const BY_ID = new Map(ACCOUNTING_COMPARISONS.map((e) => [e.id, e]));
const ALIAS_KEYS = Object.keys(ACCOUNTING_COMPARISON_ALIASES).sort(
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

export function getAccountingComparisonById(
  id: string,
): AccountingComparison | null {
  return BY_ID.get(id) ?? null;
}

export function getAccountingComparisonsByTopic(
  topicKey: string,
): AccountingComparison[] {
  const ids = ACCOUNTING_COMPARISONS_BY_TOPIC[topicKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as AccountingComparison[];
}

export function matchAccountingComparison(
  text: string,
): AccountingComparison | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = ACCOUNTING_COMPARISON_ALIASES[cand];
    if (hit) return getAccountingComparisonById(hit.id);
  }

  let best: AccountingComparison | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (a.length < 6) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;
    if (a.length > bestLen) {
      const entry = getAccountingComparisonById(
        ACCOUNTING_COMPARISON_ALIASES[alias].id,
      );
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

export function isAccountingComparisonQuery(text: string): boolean {
  if (
    /\b(vs\.?|versus|compare|comparison|difference|differ)\b/i.test(text) ||
    /(farak|antar|tulana|bhinnata|k\s*farak)/i.test(text)
  ) {
    return true;
  }
  return matchAccountingComparison(text) !== null;
}

function optionLabels(topic: string): [string, string] {
  const parts = topic.split(/\s+vs\s+/i);
  if (parts.length === 2) {
    return [parts[0].trim(), parts[1].trim()];
  }
  return ["Option A", "Option B"];
}

export function formatAccountingComparisonAnswer(
  entry: AccountingComparison,
  lang: "nepali" | "english" | "mixed",
): string {
  const [labelA, labelB] = optionLabels(entry.topic);
  const tableLines = entry.comparisonTable.map(
    (row) => `• **${row.aspect}:** ${labelA}: ${row.optionA} | ${labelB}: ${row.optionB}`,
  );

  if (lang === "english") {
    return (
      `**${entry.topic}**\n\n` +
      `**Question:** ${entry.questionNe}\n\n` +
      `**Comparison:**\n${tableLines.join("\n")}\n\n` +
      `**Explanation:** ${entry.explanationNe}\n\n` +
      `**Use ${labelA} when:** ${entry.whenToUseA}\n` +
      `**Use ${labelB} when:** ${entry.whenToUseB}`
    );
  }

  return (
    `**${entry.topic}**\n\n` +
    `**प्रश्न:** ${entry.questionNe}\n\n` +
    `**तुलना:**\n${tableLines.join("\n")}\n\n` +
    `**व्याख्या:** ${entry.explanationNe}\n\n` +
    `**${labelA} कहिले:** ${entry.whenToUseA}\n` +
    `**${labelB} कहिले:** ${entry.whenToUseB}`
  );
}

export type { AccountingComparison };
