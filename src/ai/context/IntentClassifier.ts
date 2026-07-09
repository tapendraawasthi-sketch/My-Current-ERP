/** SUTRA AI — context-aware intent classification */

import type { ExtractedEntities, IntentClassification, IntentType, SessionState } from "../types";

interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  weight: number;
  requiresEntities?: Array<keyof ExtractedEntities>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "SALES_ENTRY",
    patterns: [
      /\b(bechye|becheko|bechya|bechnu|bech|bikri|bikree|sold|sales)\b/i,
      /बेच|बिक्री/,
    ],
    weight: 0.92,
    requiresEntities: ["product"],
  },
  {
    intent: "PURCHASE_ENTRY",
    patterns: [
      /\b(kinyo|kineko|kinna|kharid|buy|purchase|bought)\b/i,
      /खरिद|किन/,
    ],
    weight: 0.92,
  },
  {
    intent: "RETURN_ENTRY",
    patterns: [/\b(firta|return|wapsi|फिर्ता)\b/i],
    weight: 0.88,
  },
  {
    intent: "CONFIRMATION",
    patterns: [
      /^(ho|huss|hus|thik|thik cha|ok|yes|confirm|milyo|sahi|ठीक|हो)$/i,
      /\b(ho bhannus|thik cha|confirm gar)\b/i,
    ],
    weight: 0.82,
  },
  {
    intent: "REJECTION",
    patterns: [
      /^(hoina|no|galat|wrong|chaina|hoina yo)$/i,
      /\b(not this|hoina yo|galat ho)\b/i,
    ],
    weight: 0.82,
  },
  {
    intent: "CORRECTION",
    patterns: [/\b(hoina|nai|sachhi|actually|bhul|भुल|sorry|feri)\b/i],
    weight: 0.78,
  },
  {
    intent: "REPORT_REQUEST",
    patterns: [
      /\b(report|statement|balance|hisaab|trial|ledger|khata|register|summary)\b/i,
      /\b(kati baki|balance kati|hisaab dekha)\b/i,
    ],
    weight: 0.87,
  },
  {
    intent: "QUERY",
    patterns: [
      /\b(what|how|when|why|which|k\s*ho|kasari|kati|kaha|ke ho|kina)\b/i,
      /के हो|कति|कसरी/,
      /\?\s*$/,
    ],
    weight: 0.75,
  },
];

export class IntentClassifier {
  classify(
    text: string,
    entities: ExtractedEntities,
    session?: SessionState,
    assistantLastMessage?: string,
  ): IntentClassification {
    const lower = text.toLowerCase().trim();
    const scores: Array<{ intent: IntentType; score: number }> = [];

    for (const def of INTENT_PATTERNS) {
      let score = 0;
      for (const re of def.patterns) {
        if (re.test(text) || re.test(lower)) {
          score = def.weight;
          break;
        }
      }

      if (score > 0 && def.requiresEntities) {
        const hasEntity = def.requiresEntities.some((k) => entities[k] !== undefined);
        if (hasEntity) score = Math.min(1, score + 0.05);
      }

      if (score > 0) scores.push({ intent: def.intent, score });
    }

    // Context continuation: bare amount after sales context
    if (scores.length === 0 && session?.lastIntent) {
      if (/^\d+$/.test(lower) && session.awaiting === "amount") {
        scores.push({ intent: session.lastIntent, score: 0.8 });
      }
      if (/^(tyo|yo|tyahi|feri)$/i.test(lower) && session.lastIntent) {
        scores.push({ intent: session.lastIntent, score: 0.7 });
      }
    }

    // Follow-up to assistant clarification
    if (assistantLastMessage && /\?|mean|bhannu|suggest|did you/i.test(assistantLastMessage)) {
      if (/^(ho|yes|thik|ok)/i.test(lower)) {
        scores.push({ intent: "CONFIRMATION", score: 0.85 });
      }
      if (/^(hoina|no|galat)/i.test(lower)) {
        scores.push({ intent: "REJECTION", score: 0.85 });
      }
    }

    if (session?.pendingAction) {
      if (/^(ho|huss|hus|yes|thik|ok|confirm|milyo|sahi)$/i.test(lower)) {
        scores.push({ intent: "CONFIRMATION", score: 0.96 });
      }
      if (/^(hoina|no|galat|wrong|chaina)$/i.test(lower)) {
        scores.push({ intent: "REJECTION", score: 0.96 });
      }
    }

    // Inherit intent from session for very short continuations
    if (scores.length === 0 && session?.lastIntent && text.split(/\s+/).length <= 3) {
      if (entities.amount || entities.quantity) {
        scores.push({ intent: session.lastIntent, score: 0.65 });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0] ?? { intent: "OTHER" as IntentType, score: 0 };

    return {
      intent: best.intent,
      confidence: best.score,
      entities: { ...entities } as Record<string, unknown>,
    };
  }
}

export const intentClassifier = new IntentClassifier();
