/** SUTRA AI — expense / kharcha entry understanding */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { actionExecutor } from "../actions/ActionExecutor";

const EXPENSE_PATTERNS = [
  /\b(\d+)\s+ko\s+(kharcha|kharcho|expense|rent|bhaada|bhada)\b/i,
  /\b(kharcha|kharcho|expense)\s+(\d+)\b/i,
  /\b(rent|bhaada|bhada|petrol|diesel)\s+(\d+)\b/i,
  /खर्च|भाडा|खर्चा/,
];

export class ExpenseEntryHandler {
  isExpenseEntry(
    text: string,
    entities: ExtractedEntities,
    intent?: IntentClassification,
  ): boolean {
    if (entities.transactionType === "expense") return true;
    if (EXPENSE_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "OTHER" && /\b(kharcha|expense|rent)\b/i.test(text)) return true;
    return false;
  }

  resolveAmount(text: string, entities: ExtractedEntities): number | null {
    if (entities.amount && entities.amount > 0) return entities.amount;
    const m =
      text.match(/\b(\d+)\s+ko\s+(?:kharcha|kharcho|expense|rent)/i) ??
      text.match(/\b(?:kharcha|expense|rent)\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    _ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isExpenseEntry(text, entities, intent)) return null;

    const amount = this.resolveAmount(text, entities);
    if (!amount || amount <= 0) return null;

    const expenseEntities: ExtractedEntities = {
      ...entities,
      amount,
      transactionType: "expense",
      product: entities.product ?? text.match(/\b(rent|bhaada|petrol|diesel)\b/i)?.[1],
    };

    const amt = `Rs. ${amount.toLocaleString("en-NP")}`;
    const label = expenseEntities.product ?? "खर्च";

    const nepali = `${label} खर्च ${amt} रेकर्ड गर्न तयार।`;
    const english = `Expense ${label} ${amt} ready to record.`;
    const roman = `Kharcha ${label} ${amt} record garna tayar.`;

    const khata = actionExecutor.resolveKhata(expenseEntities, understoodInput);

    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      transaction: { type: "other", amount, party: entities.party },
      actions: khata ? [khata] : undefined,
    };
  }
}

export const expenseEntryHandler = new ExpenseEntryHandler();
