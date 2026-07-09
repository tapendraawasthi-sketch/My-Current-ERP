/**
 * Nepal Universal AI — question vs entry disambiguation.
 * Uses exported question patterns + critical accounting distinctions
 * + multi-sense Nepali question-word lexicon (k/ko/kun/kahile/…).
 */

import {
  QUESTION_REGEX_SOURCES,
  QUESTION_WORD_SENSES,
  type QuestionWordSense,
} from "./generated/runtimeMaps";

const COMPILED_QUESTIONS = QUESTION_REGEX_SOURCES.map((src) => new RegExp(src, "i"));

/** Completion / assertion markers — "noksan vo 400" is an entry, not a question */
const ENTRY_COMPLETION =
  /\b(vo|vayo|bhayo|bho|gareko|garyo|tireko|tiryo|diye|diyo|liyo|aayo|bhayeko|vayeko|chaina|gareko\s*chaina)\b/i;

const LOSS_EXPENSE_TERMS =
  /\b(noksan|nokshan|ghata|ghateko|ghatyo|loss|kharcha|kharcho|expense)\b/i;

const PURCHASE_VERBS = /\b(kineye|kineko|kinye|kinyo|kine|kiniyo|kharid|kinna|kinne|bought|purchase)\b/i;

/** Pure conversational / non-transaction question-word cues (from human sense lexicon) */
const QUESTION_WORD_MARKER =
  /\b(kasari|kahile|kasto|kasle|kinabhane|kati|kina|kun|kata|kaha|hola|kolaai|kya|kay)\b|\b(k|ke)\s+(ho|cha|chha|garne|garnu|bhayo|bhako|bhaneko|bhanya|lai|ma|ko|kura)\b|\bko\s+(ho|aayo|garcha|sanga)\b/i;

export interface QuestionSenseMatch {
  sense: QuestionWordSense;
  matchedExample?: string;
}

/**
 * Match user text against multi-sense question-word lexicon.
 * Prefer exact example_questions, then user-text containing an example,
 * then (for longer user text only) an example containing the user text.
 */
export function matchQuestionWordSense(text: string): QuestionSenseMatch | null {
  const t = text.trim().toLowerCase().replace(/[?!।.]+$/g, "").trim();
  if (!t) return null;

  type Scored = QuestionSenseMatch & { score: number };
  let best: Scored | null = null;

  const consider = (sense: QuestionWordSense, e: string, score: number) => {
    if (!best || score > best.score || (score === best.score && e.length > (best.matchedExample?.length || 0))) {
      best = { sense, matchedExample: e, score };
    }
  };

  for (const sense of QUESTION_WORD_SENSES) {
    for (const ex of sense.exampleQuestions) {
      const e = ex.toLowerCase().trim();
      if (!e) continue;
      if (t === e) {
        consider(sense, e, 1000 + e.length);
      } else if (t.includes(e)) {
        // User said a longer phrase that contains the example ("noksan k ho" ⊃ "k ho")
        consider(sense, e, 500 + e.length);
      } else if (t.length >= 8 && e.includes(t)) {
        // Only allow reverse containment for reasonably long queries
        consider(sense, e, 100 + t.length);
      }
    }
  }
  if (best) return { sense: best.sense, matchedExample: best.matchedExample };

  // Fallback: word/variant token presence for longer markers only
  const tokens = new Set(t.split(/\s+/));
  for (const sense of QUESTION_WORD_SENSES) {
    const variants = [sense.questionWord, ...sense.variants].filter((v) => v.length >= 2);
    if (variants.some((v) => tokens.has(v) || t.includes(` ${v} `) || t.startsWith(`${v} `) || t.endsWith(` ${v}`))) {
      return { sense };
    }
  }
  return null;
}

/**
 * True when user asks for explanation (e.g. "noksan k ho"), not posting a transaction.
 */
export function isNepaliDefinitionQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  const hasQuestionCue =
    COMPILED_QUESTIONS.some((re) => re.test(t)) ||
    QUESTION_WORD_MARKER.test(t) ||
    matchQuestionWordSense(t) !== null ||
    /\?\s*$/.test(t);
  if (!hasQuestionCue) return false;

  // Amount + completion without explicit question structure → entry
  if (/\d/.test(t) && ENTRY_COMPLETION.test(t)) {
    if (/\b(k\s*ho|ke\s*ho|what\s+is|define|explain|kasari|kina|kun|kahile|kati)\b/i.test(t)) {
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

/** Explicit: this utterance must never be booked as a transaction */
export function isNotTransactionUtterance(text: string): boolean {
  const sense = matchQuestionWordSense(text);
  if (sense?.sense.notTransaction) return true;
  return isNepaliAccountingQuestion(text);
}

/** Purchase/sale stated without amount — should clarify, not chat */
export function isIncompleteTransaction(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || /\d/.test(t)) return false;
  if (isNepaliAccountingQuestion(text)) return false;
  return PURCHASE_VERBS.test(t) || LOSS_EXPENSE_TERMS.test(t);
}

export { LOSS_EXPENSE_TERMS, ENTRY_COMPLETION, PURCHASE_VERBS, QUESTION_WORD_MARKER };
