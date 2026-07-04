import { parseKhataMessage } from "./parseKhata";
import { buildParseReply, isLikelyKhataEntry, type LedgerBalanceSnapshot } from "./conversationEngine";
import { generateNepaliReply, isConversationalMessage } from "./nepaliBrain";
import { normalizeNepaliText } from "./normalizeNepali";
import type { KhataConfirmationCard, KhataParseResult } from "./types";

export type EKhataEngine = "brain" | "ollama" | "rules" | "hybrid";

export type EKhataProcessResult =
  | {
      kind: "chat";
      reply: string;
      normalizedText: string;
      engine: EKhataEngine;
    }
  | {
      kind: "entry";
      reply: string;
      normalizedText: string;
      parseResult?: KhataParseResult;
      card?: KhataConfirmationCard;
      engine: EKhataEngine;
    }
  | {
      kind: "clarify";
      reply: string;
      normalizedText: string;
      engine: EKhataEngine;
    };

export interface ProcessMessageOptions {
  balance?: LedgerBalanceSnapshot;
  /** Optional Ollama enhancement when erp_bot is deployed */
  preferLlm?: boolean;
}

/**
 * Self-contained e-Khata processor — built-in Nepali brain + transaction parser.
 * No Ollama, WebLLM, or external apps required.
 */
export function processEKhataMessage(
  rawText: string,
  options: ProcessMessageOptions = {},
): EKhataProcessResult {
  const normalizedText = normalizeNepaliText(rawText);

  if (isLikelyKhataEntry(normalizedText)) {
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
  }

  return {
    kind: "chat",
    reply: generateNepaliReply(rawText, options.balance),
    normalizedText,
    engine: "brain",
  };
}

/**
 * Full e-Khata brain: built-in Nepali language engine (default).
 * Optional Ollama via erp_bot only when explicitly deployed.
 */
export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const normalizedText = normalizeNepaliText(rawText);
  const preferLlm = options.preferLlm !== false;

  // Accurate khata entries — rule parser first
  if (isLikelyKhataEntry(normalizedText)) {
    const parseResult = parseKhataMessage(rawText, normalizedText);
    if (parseResult.card) {
      if (preferLlm) {
        try {
          const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } = await import("./ekhataLlmClient");
          const status = await checkEKhataLlmStatus();
          if (status.khataLlm) {
            const llm = await askEKhataLlm(rawText, getEKhataSessionId(), options.balance);
            if (llm.kind === "entry" && llm.card) {
              return {
                kind: "entry",
                reply: llm.reply,
                normalizedText,
                card: llm.card,
                engine: "hybrid",
              };
            }
          }
        } catch {
          // Built-in parser
        }
      }
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
  }

  // Open Nepali conversation — built-in brain (self-contained)
  if (isConversationalMessage(rawText) || !isLikelyKhataEntry(normalizedText)) {
    if (preferLlm) {
      try {
        const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } = await import("./ekhataLlmClient");
        const status = await checkEKhataLlmStatus();
        if (status.khataLlm) {
          const llm = await askEKhataLlm(rawText, getEKhataSessionId(), options.balance);
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
        // Built-in brain
      }
    }

    return {
      kind: "chat",
      reply: generateNepaliReply(rawText, options.balance),
      normalizedText,
      engine: "brain",
    };
  }

  return processEKhataMessage(rawText, options);
}

export async function checkEKhataLlmStatus() {
  try {
    const { checkEKhataLlmStatus: check } = await import("./ekhataLlmClient");
    return check();
  } catch {
    return { online: false, khataLlm: false };
  }
}
