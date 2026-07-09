/** SUTRA AI — intent clarification and "Did you mean?" logic */

import type { IntentClassification, IntentType, Suggestion, SuggestionResult } from "../types";

export class IntentClarifier {
  classifyIntent(text: string, previousTurns: string[] = []): IntentClassification {
    const lower = text.toLowerCase();

    const patterns: Array<{ intent: IntentType; re: RegExp; weight: number }> = [
      { intent: "SALES_ENTRY", re: /\b(bech|bikri|sold|sales|बेच|बिक्री)\b/i, weight: 0.9 },
      { intent: "PURCHASE_ENTRY", re: /\b(kin|kharid|buy|purchase|खरिद|किन)\b/i, weight: 0.9 },
      { intent: "RETURN_ENTRY", re: /\b(return|firta|फिर्ता|wapsi)\b/i, weight: 0.85 },
      { intent: "CONFIRMATION", re: /\b(yes|ho|hunchha|thik|ok|confirm|मिल्यो|सही)\b/i, weight: 0.8 },
      { intent: "REJECTION", re: /\b(no|hoina|wrong|galat|छैन|होइन)\b/i, weight: 0.8 },
      { intent: "CORRECTION", re: /\b(actually|sorry|bhul|भुल|sachai)\b/i, weight: 0.75 },
      { intent: "REPORT_REQUEST", re: /\b(report|statement|balance|hisaab|trial|ledger)\b/i, weight: 0.85 },
      { intent: "QUERY", re: /\b(what|how|k\s*ho|kasari|kati|कति|के\s*हो)\b/i, weight: 0.7 },
    ];

    let best: IntentType = "OTHER";
    let bestScore = 0;

    for (const p of patterns) {
      if (p.re.test(lower) && p.weight > bestScore) {
        best = p.intent;
        bestScore = p.weight;
      }
    }

    const entities = this.extractEntities(text);

    if (previousTurns.length > 0 && best === "OTHER") {
      const last = previousTurns[previousTurns.length - 1];
      if (/\?|mean|bhannu|suggest/i.test(last)) {
        best = "CONFIRMATION";
        bestScore = 0.6;
      }
    }

    return { intent: best, confidence: bestScore, entities };
  }

  private extractEntities(text: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    const amountMatch = text.match(/(\d+)\s*ko\b/i);
    if (amountMatch) entities.amount = parseInt(amountMatch[1], 10);

    const qtyMatch = text.match(/(\d+)\s*(kg|kilo|piece|wata|liter)/i);
    if (qtyMatch) {
      entities.quantity = parseInt(qtyMatch[1], 10);
      entities.unit = qtyMatch[2].toLowerCase();
    }

    const productMatch = text.match(/\b(kakro|kakor|aalu|alu|tomatar|pyaj|tarkari)\b/i);
    if (productMatch) entities.product = productMatch[1].toLowerCase();

    return entities;
  }

  buildClarificationQuestion(suggestionResult: SuggestionResult): string {
    if (suggestionResult.unknownWords?.length) {
      const word = suggestionResult.unknownWords[0];
      const top = suggestionResult.suggestions[0];
      if (top && top.confidence >= 0.7) {
        return `Unknown word "${word}" detected. Did you mean: ${top.displayText}?`;
      }
      return `I couldn't understand "${word}". Could you clarify what you meant?`;
    }
    return "Could you please clarify your request?";
  }

  formatDidYouMean(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) return "";
    const top = suggestions[0];
    return `Did you mean: ${top.displayText}? (${Math.round(top.confidence * 100)}% confident)`;
  }
}

export const intentClarifier = new IntentClarifier();
