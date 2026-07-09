/**
 * e-Khata conversation state machine — supports confirm, reverse, repeat-with-change.
 */

import type { KhataConfirmationCard } from "./types";

export type ConversationState =
  | "idle"
  | "transaction_detected"
  | "awaiting_clarification"
  | "confirmed"
  | "reversal_requested"
  | "multi_entry";

export interface EKhataConversationContext {
  state: ConversationState;
  lastCard: KhataConfirmationCard | null;
  lastUserText: string | null;
  lastVoucherNo: string | null;
  /** Set when bot asked for amount/qty after partial entry */
  pendingIntent?: string | null;
  pendingItem?: string | null;
  pendingPrefix?: string | null;
  lastClarifyQuestion?: string | null;
  /** Discourse memory for pronoun / continuation resolution */
  lastParty?: string | null;
  lastParties?: string[] | null;
  lastAmount?: number | null;
  lastBank?: string | null;
  lastAtm?: string | null;
  lastMethod?: string | null;
  pendingParty?: string | null;
  awaiting?: string | null;
}

export function createConversationContext(): EKhataConversationContext {
  return {
    state: "idle",
    lastCard: null,
    lastUserText: null,
    lastVoucherNo: null,
    pendingIntent: null,
    pendingItem: null,
    pendingPrefix: null,
    lastClarifyQuestion: null,
    lastParty: null,
    lastParties: null,
    lastAmount: null,
    lastBank: null,
    lastAtm: null,
    lastMethod: null,
    pendingParty: null,
    awaiting: null,
  };
}

const REPEAT_PATTERNS =
  /\b(same\s*as\s*last|last\s*entry|tyo\s*entry|repeat|feri\s*tyahi|same\s*entry|last\s*wala|pahile\s*ko\s*entry)\b/i;

const REVERSE_PATTERNS =
  /\b(reverse|undo|cancel\s*last|feri\s*futau|ultra|rollback|pahile\s*ko\s*entry\s*feri|entry\s*hat|entry\s*delete)\b/i;

const AMOUNT_DELTA =
  /\b(\d+)\s*(more|badhi|thap|add|kam|less|minus|ghata)\b|\b(\d+)\s*(badi|ghat)\b/i;

export function detectContextualCommand(text: string): "repeat" | "reverse" | "delta" | null {
  if (REVERSE_PATTERNS.test(text)) return "reverse";
  if (REPEAT_PATTERNS.test(text)) return "repeat";
  if (AMOUNT_DELTA.test(text)) return "delta";
  return null;
}

export function applyAmountDelta(card: KhataConfirmationCard, text: string): KhataConfirmationCard | null {
  const m =
    text.match(/\b(\d+(?:\.\d+)?)\s*(more|badhi|thap|add|badi)\b/i) ??
    text.match(/\b(\d+(?:\.\d+)?)\s*(less|kam|minus|ghat|ghata)\b/i);
  if (!m) return null;

  const delta = parseFloat(m[1]);
  const isAdd = /more|badhi|thap|add|badi/i.test(m[2] ?? m[0]);
  const newAmount = isAdd ? card.amount + delta : Math.max(0, card.amount - delta);
  if (newAmount <= 0) return null;

  return {
    ...card,
    amount: Math.round(newAmount),
    raw_text: `${card.raw_text} (${isAdd ? "+" : "-"}${delta})`,
  };
}

export function buildReverseExplanation(card: KhataConfirmationCard, lang: "english" | "nepali" | "mixed"): string {
  if (lang === "english") {
    return (
      `To reverse the last **${card.intent}** entry (NPR ${card.amount.toLocaleString()}), post the opposite journal:\n` +
      `Swap Dr and Cr on each line, or create an equal reversing voucher dated today.\n` +
      `Confirm with your CA if tax/VAT was involved.`
    );
  }
  return (
    `Pahile ko **${card.intent}** entry (NPR ${card.amount.toLocaleString()}) reverse garna:\n` +
    `Har line ma Dr ra Cr ultaunu hunchha, wa aaja ko date ma equal reversing voucher banau.\n` +
    `VAT/TDS bhayeko bhaye CA sanga confirm garnus.`
  );
}

export function updateContextAfterClarify(
  ctx: EKhataConversationContext,
  userText: string,
  question: string,
  pendingIntent?: string | null,
  pendingItem?: string | null,
): EKhataConversationContext {
  const partyGuess =
    userText.match(/\b([A-Z][a-z]{1,20}|[A-Za-z][a-z]{2,20})\s+(lai|le|bata|ko)\b/)?.[1] ??
    ctx.lastParty ??
    null;
  return {
    ...ctx,
    state: "awaiting_clarification",
    lastUserText: userText,
    lastClarifyQuestion: question,
    pendingPrefix: userText,
    pendingIntent: pendingIntent ?? ctx.pendingIntent ?? "khata_cash_sale",
    pendingItem: pendingItem ?? ctx.pendingItem ?? null,
    pendingParty: partyGuess,
    lastParty: partyGuess ?? ctx.lastParty,
    awaiting: /amount|rakam|kati|rupiya/i.test(question) ? "amount" : ctx.awaiting ?? "amount",
  };
}

export function updateContextAfterEntry(
  ctx: EKhataConversationContext,
  card: KhataConfirmationCard,
  userText: string,
): EKhataConversationContext {
  return {
    ...ctx,
    state: "transaction_detected",
    lastCard: card,
    lastUserText: userText,
    pendingIntent: null,
    pendingItem: null,
    pendingPrefix: null,
    lastClarifyQuestion: null,
    lastParty: card.party ?? ctx.lastParty,
    lastParties: card.party ? [card.party] : ctx.lastParties,
    lastAmount: card.amount,
    pendingParty: null,
    awaiting: null,
  };
}

export function updateContextAfterConfirm(
  ctx: EKhataConversationContext,
  voucherNo: string,
): EKhataConversationContext {
  return {
    ...ctx,
    state: "confirmed",
    lastVoucherNo: voucherNo,
  };
}
