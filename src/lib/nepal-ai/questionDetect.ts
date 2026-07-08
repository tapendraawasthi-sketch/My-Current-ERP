/**
 * Nepal Universal AI — question vs entry disambiguation.
 * Uses exported question patterns + critical accounting distinctions.
 */

import { QUESTION_REGEX_SOURCES } from "./generated/runtimeMaps";

const COMPILED_QUESTIONS = QUESTION_REGEX_SOURCES.map((src) => new RegExp(src, "i"));

/** Completion / assertion markers — "noksan vo 400" is an entry, not a question */
const ENTRY_COMPLETION =
  /\b(vo|vayo|bhayo|bho|gareko|garyo|tireko|tiryo|diye|diyo|liyo|aayo|bhayeko|vayeko|chaina|gareko\s*chaina)\b/i;

const LOSS_EXPENSE_TERMS =
  /\b(noksan|nokshan|ghata|ghateko|ghatyo|loss|kharcha|kharcho|expense)\b/i;

const PURCHASE_VERBS = /\b(kineye|kineko|kinye|kinyo|kine|kiniyo|kharid|kinna|kinne|bought|purchase)\b/i;

/**
 * True when user asks for explanation (e.g. "noksan k ho"), not posting a transaction.
 */
export function isNepaliDefinitionQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  const hasQuestionCue = COMPILED_QUESTIONS.some((re) => re.test(t)) || /\?\s*$/.test(t);
  if (!hasQuestionCue) return false;

  // Amount + completion without explicit question structure → entry
  if (/\d/.test(t) && ENTRY_COMPLETION.test(t)) {
    if (/\b(k\s*ho|ke\s*ho|what\s+is|define|explain)\b/i.test(t)) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Unified question detector — prefers definition questions over bare keyword "kati" in entries.
 */
export function isNepaliAccountingQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (isNepaliDefinitionQuestion(t)) return true;

  // Balance / rate questions without entry verbs
  if (
    /\b(kati\s*cha|kati\s*%|balance\s*kati|how\s+much\s+balance|kitna\s+baki)\b/i.test(t) &&
    !ENTRY_COMPLETION.test(t) &&
    !/\b(tireko|tiryo|diye|becheko|kineko|gareko)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

/** Purchase/sale stated without amount — should clarify, not chat */
export function isIncompleteTransaction(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || /\d/.test(t)) return false;
  if (isNepaliAccountingQuestion(text)) return false;
  return PURCHASE_VERBS.test(t) || LOSS_EXPENSE_TERMS.test(t);
}

export { LOSS_EXPENSE_TERMS, ENTRY_COMPLETION, PURCHASE_VERBS };
