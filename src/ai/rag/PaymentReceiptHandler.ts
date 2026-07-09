/** SUTRA AI — payment and receipt entry understanding */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { actionExecutor } from "../actions/ActionExecutor";

const PAYMENT_PATTERNS = [
  /\b(tiryo|tireko|diye|dineko|jama|paid)\b/i,
  /\bpayment\s+(received|made)\b/i,
  /\b(prapti|prapta|प्राप्त)\b/i,
  /तिर्यो|जम्मा|भुक्तानी/,
];

export interface PaymentReceiptResult {
  kind: "receipt" | "payment";
  partyName: string;
  amount: number;
  nepali: string;
  english: string;
  roman: string;
}

export class PaymentReceiptHandler {
  isPaymentReceipt(
    text: string,
    entities: ExtractedEntities,
    intent?: IntentClassification,
  ): boolean {
    if (
      entities.transactionType === "payment" ||
      entities.transactionType === "receipt"
    ) {
      return true;
    }
    if (PAYMENT_PATTERNS.some((re) => re.test(text)) && entities.amount != null) {
      return true;
    }
    if (intent?.intent === "SALES_ENTRY" && /\b(tiryo|diye|jama)\b/i.test(text)) {
      return false;
    }
    return false;
  }

  resolve(
    text: string,
    entities: ExtractedEntities,
  ): PaymentReceiptResult | null {
    const party = entities.partyResolvedName ?? entities.party;
    const amount = entities.amount;
    if (!party || amount == null || amount <= 0) return null;

    const isReceipt =
      entities.transactionType === "receipt" ||
      /\b(le|bata|received|prapti)\s+.*\b(tiryo|diye|jama)\b/i.test(text) ||
      /\b(tiryo|diye|jama)\b/i.test(text) && !/\blai\b/i.test(text);

    const kind: PaymentReceiptResult["kind"] = isReceipt ? "receipt" : "payment";
    const amt = `Rs. ${amount.toLocaleString("en-NP")}`;

    const nepali =
      kind === "receipt"
        ? `${party} बाट ${amt} प्राप्त भयो (भुक्तानी/जम्मा)।`
        : `${party} लाई ${amt} तिरियो (भुक्तानी)।`;

    const english =
      kind === "receipt"
        ? `Received ${amt} from ${party} (payment/receipt).`
        : `Paid ${amt} to ${party}.`;

    const roman =
      kind === "receipt"
        ? `${party} bata ${amt} prapta bhayo.`
        : `${party} lai ${amt} tiriyo.`;

    return { kind, partyName: party, amount, nepali, english, roman };
  }

  toAIResponse(
    result: PaymentReceiptResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    return {
      understood_input: understoodInput,
      confidence: 0.91,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      transaction: {
        type: result.kind,
        party: result.partyName,
        amount: result.amount,
      },
      actions: (() => {
        const khata = actionExecutor.resolveKhata(
          {
            party: result.partyName,
            amount: result.amount,
            transactionType: result.kind,
          },
          understoodInput,
        );
        return khata ? [khata] : undefined;
      })(),
    };
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    _ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isPaymentReceipt(text, entities, intent)) return null;
    const result = this.resolve(text, entities);
    if (!result) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const paymentReceiptHandler = new PaymentReceiptHandler();
