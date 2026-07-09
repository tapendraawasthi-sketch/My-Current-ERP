/** SUTRA AI — cash and bank balance queries */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";

const CASH_PATTERNS = [
  /\b(cash|nagad|nakad|rokka)\s+(balance|baki|kati|cha)\b/i,
  /\b(hatma|hathma)\s+(cash|nagad|paisa)\b/i,
  /\b(bank|khata)\s+balance\b/i,
  /\bhow\s+much\s+cash\b/i,
  /नगद\s*कति|क्यास\s*ब्यालेन्स|हातमा\s*कति/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export class CashBalanceQueryHandler {
  isCashQuery(text: string, intent?: IntentClassification): boolean {
    if (CASH_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "QUERY" && /\b(cash|nagad|bank)\b/i.test(text)) return true;
    return false;
  }

  isBankQuery(text: string): boolean {
    return /\b(bank|banking)\b/i.test(text) && /\b(balance|baki|kati)\b/i.test(text);
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isCashQuery(text, intent) && !this.isBankQuery(text)) return null;
    if (!ctx?.cashBalance && !ctx?.bankBalance) return null;

    const bankMode = this.isBankQuery(text);
    const amount = bankMode ? ctx.bankBalance ?? 0 : ctx.cashBalance ?? 0;

    const nepali = bankMode
      ? `बैंक ब्यालेन्स: ${formatAmount(amount)}`
      : `हातमा नगद (Cash): ${formatAmount(amount)}`;
    const english = bankMode
      ? `Bank balance: ${formatAmount(amount)}`
      : `Cash in hand: ${formatAmount(amount)}`;
    const roman = bankMode
      ? `Bank balance: ${formatAmount(amount)}`
      : `Cash: ${formatAmount(amount)}`;

    return {
      understood_input: understoodInput,
      confidence: 0.92,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      actions: [
        {
          id: `cash-${Date.now().toString(36)}`,
          type: "navigate",
          page: "trial-balance",
          label: "View Accounts",
          labelNepali: "खाता हेर्नुहोस्",
        },
      ],
    };
  }
}

export const cashBalanceQueryHandler = new CashBalanceQueryHandler();
