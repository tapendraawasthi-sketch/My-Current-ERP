import { parseKhataMessage } from "./parseKhata";
import {
  buildChatReply,
  buildParseReply,
  detectChatIntent,
  isLikelyKhataEntry,
  type LedgerBalanceSnapshot,
} from "./conversationEngine";
import { normalizeNepaliText } from "./normalizeNepali";
import type { KhataConfirmationCard, KhataParseResult } from "./types";

export type EKhataProcessResult =
  | {
      kind: "chat";
      reply: string;
      normalizedText: string;
    }
  | {
      kind: "entry";
      reply: string;
      normalizedText: string;
      parseResult: KhataParseResult;
      card?: KhataConfirmationCard;
    };

export interface ProcessMessageOptions {
  balance?: LedgerBalanceSnapshot;
}

/**
 * Main e-Khata brain: normalize language → chat OR ledger entry.
 */
export function processEKhataMessage(
  rawText: string,
  options: ProcessMessageOptions = {},
): EKhataProcessResult {
  const normalizedText = normalizeNepaliText(rawText);
  const chatIntent = detectChatIntent(normalizedText);

  if (chatIntent && !isLikelyKhataEntry(normalizedText)) {
    return {
      kind: "chat",
      reply: buildChatReply(chatIntent, options.balance),
      normalizedText,
    };
  }

  const parseResult = parseKhataMessage(rawText, normalizedText);

  if (parseResult.card || parseResult.clarifying_question) {
    return {
      kind: "entry",
      reply: buildParseReply(parseResult, parseResult.card),
      normalizedText,
      parseResult,
      card: parseResult.card,
    };
  }

  if (chatIntent) {
    return {
      kind: "chat",
      reply: buildChatReply(chatIntent, options.balance),
      normalizedText,
    };
  }

  return {
    kind: "chat",
    reply: buildParseReply(parseResult),
    normalizedText,
  };
}
