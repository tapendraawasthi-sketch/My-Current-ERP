/** SUTRA AI — daily digest query response */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { dailyDigestEngine } from "../intelligence/DailyDigestEngine";

const DIGEST_PATTERNS = [
  /\b(daily|aaja)\s+(digest|summary|saraansh)\b/i,
  /\bbusiness\s+digest\b/i,
  /आजको\s*सारांश|दैनिक\s*सारांश/,
];

export class DailyDigestQueryHandler {
  isDigestQuery(text: string): boolean {
    return DIGEST_PATTERNS.some((re) => re.test(text));
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    _intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isDigestQuery(text)) return null;
    const digest = dailyDigestEngine.build(ctx, outputLanguage);
    if (!digest) return null;

    return {
      understood_input: understoodInput,
      confidence: 0.93,
      needs_clarification: false,
      suggestions: [],
      response: digest,
      sourceLanguage: "roman",
    };
  }
}

export const dailyDigestQueryHandler = new DailyDigestQueryHandler();
