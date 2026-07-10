import { parseKhataMessage } from "@/lib/ekhata/parseKhata";
import { parseSemanticTransaction } from "@/lib/ekhata/semanticNepaliBrain";
import type { KhataIntent } from "@/lib/ekhata/types";
import type { AccountingIntentExtract, PaymentMode } from "../types/accounting";

const BANK_MARKERS = /\b(bank|banking|cheque|check|online|transfer|neft|rtgs|wire|upi)\b/i;
const PAID_MARKERS = /\b(paid|payment\s+made|payment\s+gave|tirna\s+diye|bhugtan|bhuktan)\b/i;

export function detectPaymentMode(text: string): PaymentMode {
  if (BANK_MARKERS.test(text)) return "bank";
  if (/\b(cash|nagad|nakad)\b/i.test(text)) return "cash";
  if (/\b(udhaar|credit|on\s+credit)\b/i.test(text)) return "credit";
  return "unknown";
}

function extractPartyFromPaidPattern(text: string): string | null {
  const paidTo = text.match(/\bpaid\s+([A-Za-z][A-Za-z\s]{0,30}?)(?:\s+\d|\s+rs|\s+npr|\s+by\b|,|\s+through)/i);
  if (paidTo?.[1]) return paidTo[1].trim();
  const paidToSimple = text.match(/\bpaid\s+([A-Za-z][A-Za-z]{1,20})\b/i);
  if (paidToSimple?.[1] && !/^(the|a|an|by|via|through)$/i.test(paidToSimple[1])) {
    return paidToSimple[1].trim();
  }
  return null;
}

function extractAmount(text: string): number | null {
  const commaNum = text.match(/(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (commaNum) {
    const n = parseFloat(commaNum[1].replace(/,/g, ""));
    if (n > 0) return n;
  }
  return null;
}

export function extractAccountingIntent(rawInput: string): AccountingIntentExtract | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const paymentMode = detectPaymentMode(trimmed);
  const parsed = parseKhataMessage(trimmed);

  if (parsed.card) {
    return {
      khataIntent: parsed.card.intent,
      party: parsed.card.party ?? null,
      amount: parsed.card.amount,
      paymentMode: paymentMode === "unknown" ? "cash" : paymentMode,
      rawInput: trimmed,
      confidence: 0.92,
    };
  }

  const semantic = parseSemanticTransaction(trimmed);
  if (semantic.intent && semantic.amount && semantic.amount > 0) {
    return {
      khataIntent: semantic.intent,
      party: semantic.party,
      amount: semantic.amount,
      paymentMode: paymentMode === "unknown" ? "cash" : paymentMode,
      rawInput: trimmed,
      confidence: semantic.confidence,
      clarifyingQuestion: parsed.clarifying_question,
    };
  }

  if (PAID_MARKERS.test(trimmed)) {
    const amount = extractAmount(trimmed);
    const party = extractPartyFromPaidPattern(trimmed);
    if (amount && party) {
      const isInbound = /\b(from|bata|le)\b/i.test(trimmed) && !/\b(to|lai|laai)\b/i.test(trimmed);
      const khataIntent: KhataIntent = isInbound ? "khata_payment_in" : "khata_payment_out";
      return {
        khataIntent,
        party,
        amount,
        paymentMode,
        rawInput: trimmed,
        confidence: 0.88,
      };
    }
    if (parsed.clarifying_question) {
      return {
        khataIntent: "khata_payment_out",
        party: party ?? null,
        amount: amount ?? 0,
        paymentMode,
        rawInput: trimmed,
        confidence: 0.4,
        clarifyingQuestion: parsed.clarifying_question,
      };
    }
  }

  return null;
}

export function isAccountingCommand(extract: AccountingIntentExtract): boolean {
  return extract.amount > 0 && Boolean(extract.khataIntent) && !extract.clarifyingQuestion;
}
