/**
 * e-Khata Meaning Engine — unified semantic understanding layer.
 *
 * Combines semantic frames, grammar knowledge, domain routing, and amount logic
 * so the system understands WHAT the user means — not just which keywords appear.
 *
 * Self-contained: no API, no Ollama, no downloads.
 */

import { classifyDomain, type DomainRouteResult } from "./domainRouter";
import { synthesizeGrammarContext } from "./grammarKnowledgeBrain";
import {
  parseSemanticFrame,
  parseSemanticTransaction,
  type SemanticFrame,
} from "./semanticNepaliBrain";
import { parseSmartAmount } from "./smartWorkBrain";
import { extractNepaliAmount } from "@/lib/nepal-ai/amountExtraction";
import { detectUserLanguage, type UserLanguage } from "./accountingLanguageBrain";
import type { KhataIntent } from "./types";

export interface MessageMeaning {
  rawText: string;
  language: UserLanguage;
  domain: DomainRouteResult;
  frame: SemanticFrame;
  intent: KhataIntent | null;
  amount: number | null;
  quantity: number | null;
  unitPrice: number | null;
  party: string | null;
  item: string | null;
  confidence: number;
  isTransaction: boolean;
  isQuestion: boolean;
  grammarContext: string;
}

const CURRENCY_PARTY = new Set([
  "rs",
  "npr",
  "rupees",
  "rupee",
  "rupiya",
  "rupya",
  "rupaye",
  "rupaya",
  "rupaiya",
  "paisa",
  "₨",
  "for",
  "each",
  "per",
  "today",
  "yesterday",
  "tomorrow",
  "aja",
  "hijo",
  "parsi",
  "i",
  "the",
  "a",
  "an",
]);

/** Resolve best transaction amount — prefers trained Nepali rules, then qty × rate. */
export function resolveBestAmount(
  displayText: string,
  normalizedText?: string,
): { amount: number | null; quantity: number | null; unitPrice: number | null } {
  const sources = [displayText, normalizedText].filter(Boolean) as string[];

  for (const src of sources) {
    const extracted = extractNepaliAmount(src);
    if (extracted.amount != null && extracted.amount > 0) {
      return {
        amount: extracted.amount,
        quantity: extracted.quantity,
        unitPrice: extracted.unitPrice,
      };
    }
  }

  for (const src of sources) {
    const smart = parseSmartAmount(src);
    if (smart.amount && smart.quantity && smart.unitPrice && smart.amount > 0) {
      return smart;
    }
  }

  for (const src of sources) {
    const smart = parseSmartAmount(src);
    if (smart.amount && smart.amount > 0) return smart;
  }

  const semantic = parseSemanticTransaction(displayText);
  if (semantic.amount && semantic.amount > 0) {
    return { amount: semantic.amount, quantity: null, unitPrice: null };
  }

  return { amount: null, quantity: null, unitPrice: null };
}

/** Clean party name — reject currency tokens and stopwords. */
export function cleanPartyName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed || CURRENCY_PARTY.has(trimmed.toLowerCase())) return null;
  if (/^(rs\.?|npr\.?)$/i.test(trimmed)) return null;
  return trimmed;
}

/** Full meaning analysis for one user message. */
export function analyzeMessageMeaning(rawText: string): MessageMeaning {
  const text = (rawText || "").trim();
  const language = detectUserLanguage(text);
  const domain = classifyDomain(text);
  const frame = parseSemanticFrame(text);
  const semantic = parseSemanticTransaction(text);
  const amounts = resolveBestAmount(text);

  const party = cleanPartyName(
    semantic.party ??
      frame.recipient ??
      frame.agent ??
      frame.source,
  );

  const isTransaction =
    domain.domain === "journal_entry" ||
    (semantic.intent !== null &&
      !frame.isQuestion &&
      !frame.isNegated &&
      amounts.amount !== null &&
      amounts.amount > 0);

  let confidence = semantic.confidence;
  if (amounts.quantity && amounts.unitPrice) confidence = Math.min(confidence + 0.1, 0.98);
  if (party) confidence = Math.min(confidence + 0.05, 0.98);

  const grammarContext =
    /[\u0900-\u097F]/.test(text) ||
    frame.action !== "UNKNOWN" ||
    domain.domain === "journal_entry" ||
    domain.domain === "accounting_qa"
      ? synthesizeGrammarContext(text)
      : "";

  return {
    rawText: text,
    language,
    domain,
    frame,
    intent: semantic.intent,
    amount: amounts.amount,
    quantity: amounts.quantity,
    unitPrice: amounts.unitPrice,
    party,
    item: semantic.item,
    confidence,
    isTransaction,
    isQuestion: frame.isQuestion || /\?/.test(text),
    grammarContext,
  };
}

/** Explain why a parse decision was made — for clarify replies. */
export function explainParseGap(meaning: MessageMeaning, lang: UserLanguage): string {
  if (!meaning.intent && meaning.frame.action === "UNKNOWN") {
    return lang === "english"
      ? "I couldn't understand the transaction type. Try: 'Ram lai 500 udhaar', 'sold 200 cups at 50 each', 'Shyam le 300 tiryo'."
      : "Transaction type bujhena. Udaharan: 'Ram lai 500 udhaar', '200 cups 50 each ma becheko', 'Shyam le 300 tiryo'.";
  }
  if (!meaning.amount) {
    return lang === "english"
      ? "What is the amount? Include a number — e.g. 500, 5 hajar, or '200 at 50 each'."
      : "Rakam kati ho? Number lekhnus — jastai 500, 5 hajar, wa '200 ota 50 each'.";
  }
  if (!meaning.party && meaning.intent && needsPartyForIntent(meaning.intent)) {
    return lang === "english"
      ? "Which party? Include a name — e.g. 'Ram lai 500 udhaar' or 'payment from Shyam 300'."
      : "Party ko naam chaincha — jastai 'Ram lai 500 udhaar' wa 'Shyam bata 300 aayo'.";
  }
  return lang === "english"
    ? "Please describe the transaction more clearly with amount and party."
    : "Transaction thora clear lekhnus — rakam ra party sahit.";
}

function needsPartyForIntent(intent: KhataIntent): boolean {
  return [
    "khata_credit_sale",
    "khata_payment_in",
    "khata_payment_out",
    "khata_credit_purchase",
    "khata_bad_debt_writeoff",
    "khata_discount_allowed",
  ].includes(intent);
}

export { synthesizeGrammarContext } from "./grammarKnowledgeBrain";
