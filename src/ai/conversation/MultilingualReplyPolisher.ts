/** SUTRA AI — ensure nepali/english/roman fields are populated */

import type { AIResponse } from "../types";

export class MultilingualReplyPolisher {
  polish(response: AIResponse): AIResponse {
    const r = response.response;
    const primary = r.nepali?.trim() || r.english?.trim() || r.roman?.trim() || "";
    if (!primary) return response;

    const nepali = r.nepali?.trim() || primary;
    const english = r.english?.trim() || primary;
    const roman = r.roman?.trim() || english || primary;

    if (nepali === r.nepali && english === r.english && roman === r.roman) {
      return response;
    }

    return {
      ...response,
      response: { nepali, english, roman },
    };
  }
}

export const multilingualReplyPolisher = new MultilingualReplyPolisher();
