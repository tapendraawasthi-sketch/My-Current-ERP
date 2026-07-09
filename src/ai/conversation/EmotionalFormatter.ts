/** SUTRA AI — human-like tone via e-Khata emotional intelligence */

import {
  composeEmotionalReply,
  detectEmotionalContext,
  isEmotionalMessage,
  type EmotionalContext,
} from "@/lib/ekhata/emotionalBrain";
import type { ConversationTurn } from "@/lib/ekhata/conversationalBrain";
import type { IntentType, LanguageCode } from "../types";

const TRANSACTION_OPENERS: Record<LanguageCode, string[]> = {
  nepali: [
    "ठीक छ, मैले बुझें — ",
    "राम्रो, यो रेकर्ड गरियो — ",
    "बुझियो — ",
  ],
  roman: [
    "Thik cha, maile bujhe — ",
    "Ramro, yo record gariyo — ",
  ],
  english: [
    "Got it — ",
    "Understood — ",
  ],
};

const CONFUSED_OPENERS: Record<LanguageCode, string> = {
  nepali: "अलिकति स्पष्ट गर्नुहोला — ",
  roman: "Alikati spastha garnuhola — ",
  english: "Could you clarify — ",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toConversationTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
): ConversationTurn[] {
  return turns.map((t) => ({
    role: t.role,
    content: t.content,
    timestamp: new Date(),
  }));
}

export class EmotionalFormatter {
  detect(userInput: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) {
    return detectEmotionalContext(userInput, toConversationTurns(history));
  }

  formatReply(
    baseText: string,
    userInput: string,
    outputLanguage: LanguageCode,
    options?: {
      intent?: IntentType;
      emotional?: EmotionalContext;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      isConfused?: boolean;
      hasTransaction?: boolean;
    },
  ): string {
    const emotional =
      options?.emotional ??
      detectEmotionalContext(userInput, toConversationTurns(options?.history ?? []));

    if (isEmotionalMessage(userInput) && !options?.hasTransaction) {
      return composeEmotionalReply(baseText, emotional, {
        userText: userInput,
        isQuestion: /\?|k\s*ho|kasari|how|what|kati/i.test(userInput),
        factual: false,
      });
    }

    let text = baseText.trim();

    if (options?.isConfused) {
      text = CONFUSED_OPENERS[outputLanguage] + text;
    } else if (options?.hasTransaction && emotional.primaryEmotion === "neutral") {
      const openers = TRANSACTION_OPENERS[outputLanguage];
      if (openers?.length && !text.startsWith(openers[0].slice(0, 4))) {
        text = pick(openers) + text;
      }
    }

    if (emotional.politenessLevel === "honorific" && outputLanguage === "nepali") {
      text = composeEmotionalReply(text, emotional, {
        userText: userInput,
        factual: true,
      });
    }

    return text.trim();
  }
}

export const emotionalFormatter = new EmotionalFormatter();
