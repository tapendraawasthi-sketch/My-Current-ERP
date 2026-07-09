/** SUTRA AI — helpful tips when LLM is offline */

import type { LanguageCode } from "../types";

const OFFLINE_TIPS = {
  nepali:
    "💡 LLM offline — rule engine le jawaf diyeko cha। `/help` वा `/examples` हेर्नुहोस्।",
  english:
    "💡 LLM offline — answered by rules. Try `/help` or `/examples` for phrases.",
  roman:
    "💡 LLM offline — rule engine le jawaf diyo. `/help` ya `/examples` hernus.",
};

export class OfflineReplyEnhancer {
  enhance(text: string, lang: LanguageCode, llmOnline: boolean, llmUsed: boolean): string {
    if (llmOnline || llmUsed) return text;
    const tip =
      lang === "english" ? OFFLINE_TIPS.english : lang === "roman" ? OFFLINE_TIPS.roman : OFFLINE_TIPS.nepali;
    if (text.includes("LLM offline")) return text;
    return `${text}\n\n${tip}`;
  }
}

export const offlineReplyEnhancer = new OfflineReplyEnhancer();
