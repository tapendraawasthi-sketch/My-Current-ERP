/**
 * Known accounting terminology / direction mistakes → clarification + teaching tip.
 * Wired ahead of ambiguity / clarify_error_patterns in parseKhata for early types only.
 */

import {
  ACCOUNTING_MISTAKE_ALIASES,
  ACCOUNTING_MISTAKE_BY_TYPE,
  ACCOUNTING_MISTAKE_PATTERNS,
  type AccountingMistakePattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(ACCOUNTING_MISTAKE_PATTERNS.map((e) => [e.id, e]));

/** Exact-match early clarify in parseKhata (safe without session context). */
export const EARLY_PARSE_MISTAKE_TYPES = new Set([
  "wrong_terminology",
  "reversed_entry",
]);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAccountingMistakeById(id: string): AccountingMistakePattern | null {
  return BY_ID.get(id) ?? null;
}

export function matchAccountingMistakePattern(
  text: string,
  preferredType?: string,
): AccountingMistakePattern | null {
  if (!text?.trim()) return null;
  const key = normalizeKey(text);

  if (preferredType) {
    const ids = ACCOUNTING_MISTAKE_BY_TYPE[preferredType] ?? [];
    for (const id of ids) {
      const row = BY_ID.get(id);
      if (
        row &&
        (row.userInputNormalized === key || normalizeKey(row.userInput) === key)
      ) {
        return row;
      }
    }
  }

  const hit = ACCOUNTING_MISTAKE_ALIASES[key];
  if (hit) return getAccountingMistakeById(hit.id);

  return null;
}

/**
 * Early path for parseKhata: only terminology + reversed-entry goldens.
 * Amount/party/date/double/category stay in the lexicon for detectors that have more context.
 */
export function matchEarlyAccountingMistake(
  text: string,
): AccountingMistakePattern | null {
  const hit = matchAccountingMistakePattern(text);
  if (!hit) return null;
  return EARLY_PARSE_MISTAKE_TYPES.has(hit.mistakeType) ? hit : null;
}

/** Clarifying question; optionally append teaching_moment as a tip line. */
export function accountingMistakeClarifyQuestion(
  entry: AccountingMistakePattern,
  includeTeaching = true,
): string {
  const tip = entry.teachingMoment?.trim();
  if (includeTeaching && tip) {
    const body = tip.replace(/^Tips?:\s*/i, "");
    return `${entry.aiClarification}\n\nTip: ${body}`;
  }
  return entry.aiClarification;
}

export type { AccountingMistakePattern };
