/** SUTRA AI — /cache stats and /cache clear */

import type { AIResponse, LanguageCode } from "../types";
import { llmResponseCache } from "../learning/LlmResponseCache";
import { buildCacheStatsSummary } from "../learning/CacheHitSparkline";
import {
  formatCacheClearQuickReplyLabel,
  formatCacheClearedReply,
} from "../intelligence/DigestPinPreference";

const CACHE_PATTERNS = [/^\/cache\b/i, /\b(cache\s+stats|llm\s+cache)\b/i];

export class CacheStatsQueryHandler {
  matches(text: string): boolean {
    return CACHE_PATTERNS.some((re) => re.test(text.trim()));
  }

  async tryBuildResponse(
    text: string,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): Promise<AIResponse | null> {
    if (!this.matches(text)) return null;

    const isClear = /^\/cache\s+clear\b/i.test(text.trim());

    if (isClear) {
      const cleared = await llmResponseCache.clear();
      return {
        understood_input: understoodInput,
        confidence: 1,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: formatCacheClearedReply(cleared, "nepali"),
          english: formatCacheClearedReply(cleared, "english"),
          roman: formatCacheClearedReply(cleared, "roman"),
        },
        sourceLanguage: "roman",
      };
    }

    const [nepali, english, roman] = await Promise.all([
      buildCacheStatsSummary("nepali"),
      buildCacheStatsSummary("english"),
      buildCacheStatsSummary("roman"),
    ]);

    return {
      understood_input: understoodInput,
      confidence: 0.95,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      quickReplies: [
        {
          id: "cache-clr",
          label: formatCacheClearQuickReplyLabel(outputLanguage),
          value: "/cache clear",
          kind: "query",
        },
      ],
    };
  }
}

export const cacheStatsQueryHandler = new CacheStatsQueryHandler();
