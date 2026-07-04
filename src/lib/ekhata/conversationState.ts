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
}

export function createConversationContext(): EKhataConversationContext {
  return {
    state: "idle",
    lastCard: null,
    lastUserText: null,
    lastVoucherNo: null,
  };
}

const REPEAT_PATTERNS =
  /\b(same\s*as\s*last|last\s*entry|tyo\s*entry|repeat|feri\s*tyahi|same\s*entry|last\s*wala|pahile\s*ko\s*entry)\b/i;

const REVERSE_PATTERNS =
  /\b(reverse|undo|cancel\s*last|feri\s*futau|ultra|rollback|pahile\s*ko\s*entry\s*feri|entry\s*hat|entry\s*delete)\b/i;

const AMOUNT_DELTA =
  /\b(\d+)\s*(more|badhi|thap|add|kam|less|minus|ghata)\b|\b(\d+)\s*(badi|ghat)\b/i;

const PARTY_CORRECTION =
  /\b(?:party|name|naam)\s*(?:is|ho|=)?\s*([a-zA-Z]{2,30})|\b(?:not|haina)\s+([a-zA-Z]+)\s*,\s*([a-zA-Z]+)|\bchange\s+party\s+to\s+([a-zA-Z]+)/i;

const AMOUNT_CORRECTION =
  /\b(?:amount|rakam)\s*(?:is|ho|=)?\s*(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:ho\s*rakam|rakam\s*ho)\b/i;

export function detectContextualCommand(text: string): "repeat" | "reverse" | "delta" | "correct_party" | "correct_amount" | null {
  if (REVERSE_PATTERNS.test(text)) return "reverse";
  if (REPEAT_PATTERNS.test(text)) return "repeat";
  if (AMOUNT_DELTA.test(text)) return "delta";
  if (PARTY_CORRECTION.test(text)) return "correct_party";
  if (AMOUNT_CORRECTION.test(text)) return "correct_amount";
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

export function applyPartyCorrection(card: KhataConfirmationCard, text: string): KhataConfirmationCard | null {
  const match = text.match(PARTY_CORRECTION);
  if (!match) return null;

  const partyRaw = match[1] ?? match[3] ?? match[4];
  if (!partyRaw) return null;

  const party = partyRaw.charAt(0).toUpperCase() + partyRaw.slice(1).toLowerCase();
  return {
    ...card,
    party,
    raw_text: `${card.raw_text} (party: ${party})`,
  };
}

export function applyAmountCorrection(card: KhataConfirmationCard, text: string): KhataConfirmationCard | null {
  const match = text.match(AMOUNT_CORRECTION);
  if (!match) return null;

  const amount = Math.round(parseFloat(match[1] ?? match[2]));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    ...card,
    amount,
    raw_text: `${card.raw_text} (amount: ${amount})`,
  };
}

export function buildCorrectionReply(
  card: KhataConfirmationCard,
  lang: "english" | "nepali" | "mixed",
): string {
  const partyLine = card.party ? `Party: **${card.party}**` : "";
  const amountLine = `Amount: **NPR ${card.amount.toLocaleString()}**`;
  if (lang === "english") {
    return `Updated last entry — ${amountLine}${partyLine ? `, ${partyLine}` : ""}. Confirm when ready.`;
  }
  return `Pahile ko entry update gare — ${amountLine}${partyLine ? `, ${partyLine}` : ""}. Confirm garnus.`;
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
