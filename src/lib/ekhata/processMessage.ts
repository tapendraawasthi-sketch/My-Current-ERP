import { parseKhataMessage } from "./parseKhata";
import {
  buildChatReply,
  buildParseReply,
  detectChatIntent,
  isLikelyKhataEntry,
  type LedgerBalanceSnapshot,
} from "./conversationEngine";
import {
  askEKhataLlm,
  checkEKhataLlmStatus,
  getEKhataSessionId,
} from "./ekhataLlmClient";
import { normalizeNepaliText } from "./normalizeNepali";
import type { KhataConfirmationCard, KhataParseResult } from "./types";

export type EKhataProcessResult =
  | {
      kind: "chat";
      reply: string;
      normalizedText: string;
      engine: "ollama" | "rules" | "hybrid";
    }
  | {
      kind: "entry";
      reply: string;
      normalizedText: string;
      parseResult?: KhataParseResult;
      card?: KhataConfirmationCard;
      engine: "ollama" | "rules" | "hybrid";
    }
  | {
      kind: "clarify";
      reply: string;
      normalizedText: string;
      engine: "ollama" | "rules" | "hybrid";
    };

export interface ProcessMessageOptions {
  balance?: LedgerBalanceSnapshot;
  preferLlm?: boolean;
}

/** Rule-based fallback (offline / Ollama not running). */
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
      engine: "rules",
    };
  }

  const parseResult = parseKhataMessage(rawText, normalizedText);

  if (parseResult.card) {
    return {
      kind: "entry",
      reply: buildParseReply(parseResult, parseResult.card),
      normalizedText,
      parseResult,
      card: parseResult.card,
      engine: "rules",
    };
  }

  if (parseResult.clarifying_question) {
    return {
      kind: "clarify",
      reply: buildParseReply(parseResult),
      normalizedText,
      engine: "rules",
    };
  }

  if (chatIntent) {
    return {
      kind: "chat",
      reply: buildChatReply(chatIntent, options.balance),
      normalizedText,
      engine: "rules",
    };
  }

  return {
    kind: "chat",
    reply: buildParseReply(parseResult),
    normalizedText,
    engine: "rules",
  };
}

/**
 * Full e-Khata brain: Ollama LLM when available, rule-based fallback otherwise.
 */
export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const normalizedText = normalizeNepaliText(rawText);
  const preferLlm = options.preferLlm !== false;

  if (preferLlm) {
    try {
      const status = await checkEKhataLlmStatus();
      if (status.khataLlm) {
        const sessionId = getEKhataSessionId();
        const llm = await askEKhataLlm(rawText, sessionId, options.balance);

        if (llm.kind === "entry" && llm.card) {
          return {
            kind: "entry",
            reply: llm.reply,
            normalizedText,
            card: llm.card,
            engine: llm.engine as "ollama" | "hybrid",
          };
        }

        if (llm.kind === "clarify") {
          return {
            kind: "clarify",
            reply: llm.reply,
            normalizedText,
            engine: llm.engine as "ollama" | "hybrid",
          };
        }

        return {
          kind: "chat",
          reply: llm.reply,
          normalizedText,
          engine: "ollama",
        };
      }
    } catch {
      // Fall through to rules
    }
  }

  return processEKhataMessage(rawText, options);
}

export { checkEKhataLlmStatus };
