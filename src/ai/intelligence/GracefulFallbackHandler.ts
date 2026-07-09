/** SUTRA AI — helpful fallback when input is not understood */

import type {
  AIResponse,
  IntentClassification,
  LanguageCode,
} from "../types";

export class GracefulFallbackHandler {
  shouldFallback(
    response: AIResponse,
    intent: IntentClassification,
    erpQueryResolved: boolean,
  ): boolean {
    if (erpQueryResolved || response.needs_clarification) return false;
    if (response.confidence >= 0.62) return false;
    if (intent.intent !== "OTHER" && intent.intent !== "QUERY") return false;
    return true;
  }

  build(
    input: string,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    const nepali =
      `मैले "${input}" पूर्ण रूपमा बुझिन।\n\n` +
      `यस्तो प्रयास गर्नुहोस्:\n` +
      `• \`maile 500 ko kakro bechye\` — बिक्री\n` +
      `• \`ram ko balance kati\` — ब्यालेन्स\n` +
      `• \`/examples\` — थप उदाहरण\n` +
      `• \`/help\` — सबै shortcuts`;

    const english =
      `I couldn't fully understand "${input}".\n\n` +
      `Try:\n` +
      `• \`maile 500 ko kakro bechye\` — sales\n` +
      `• \`ram ko balance kati\` — balance\n` +
      `• \`/examples\` — more examples\n` +
      `• \`/help\` — all shortcuts`;

    const roman =
      `"${input}" bujhina.\n` +
      `Try /examples or /help.`;

    return {
      understood_input: understoodInput,
      confidence: 0.55,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      quickReplies: [
        { id: "fb-ex", label: "/examples", value: "/examples", kind: "query" },
        { id: "fb-help", label: "/help", value: "/help", kind: "query" },
      ],
    };
  }
}

export const gracefulFallbackHandler = new GracefulFallbackHandler();
