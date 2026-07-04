import { parseKhataMessage } from "./parseKhata";
import { buildParseReply, isLikelyKhataEntry, type LedgerBalanceSnapshot } from "./conversationEngine";
import {
  askEKhataBrowserAi,
  isEKhataBrowserAiReady,
  loadEKhataBrowserAi,
  replyNeedsBrowserAi,
} from "./ekhataWebLlm";
import { normalizeNepaliText } from "./normalizeNepali";
import type { KhataConfirmationCard, KhataParseResult } from "./types";

export type EKhataEngine = "ollama" | "browser" | "rules" | "hybrid";

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
  preferLlm?: boolean;
  /** Auto-start browser LLM download on conversational messages */
  autoLoadBrowserAi?: boolean;
}

/**
 * Rule-based path — ONLY for structured khata transactions (amounts, udhaar, bikri).
 * Never fakes conversational replies; open chat needs a real LLM.
 */
export function processEKhataMessage(
  rawText: string,
  _options: ProcessMessageOptions = {},
): EKhataProcessResult {
  const normalizedText = normalizeNepaliText(rawText);

  if (!isLikelyKhataEntry(normalizedText)) {
    return {
      kind: "chat",
      reply: replyNeedsBrowserAi(),
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

  return {
    kind: "chat",
    reply: replyNeedsBrowserAi(),
    normalizedText,
    engine: "rules",
  };
}

async function tryBrowserLlm(
  rawText: string,
  balance?: LedgerBalanceSnapshot,
  autoLoad = true,
): Promise<EKhataProcessResult | null> {
  if (typeof window === "undefined") return null;

  try {
    if (!isEKhataBrowserAiReady() && autoLoad) {
      await loadEKhataBrowserAi();
    } else if (!isEKhataBrowserAiReady()) {
      return null;
    }

    const reply = await askEKhataBrowserAi(rawText, balance);
    return {
      kind: "chat",
      reply,
      normalizedText: normalizeNepaliText(rawText),
      engine: "browser",
    };
  } catch {
    return null;
  }
}

/**
 * Full e-Khata brain:
 * 1. Structured transactions → accurate rule parser (always)
 * 2. Open conversation → Ollama LLM, else browser WebLLM, else ask to load AI
 */
export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const normalizedText = normalizeNepaliText(rawText);
  const preferLlm = options.preferLlm !== false;
  const autoLoad = options.autoLoadBrowserAi !== false;

  // Accurate ledger entries always go through the rule parser first
  if (isLikelyKhataEntry(normalizedText)) {
    const parseResult = parseKhataMessage(rawText, normalizedText);
    if (parseResult.card) {
      // Optional Ollama polish for confirm message when server LLM is up
      if (preferLlm) {
        try {
          const { checkEKhataLlmStatus } = await import("./ekhataLlmClient");
          const status = await checkEKhataLlmStatus();
          if (status.khataLlm) {
            const { askEKhataLlm, getEKhataSessionId } = await import("./ekhataLlmClient");
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
          // Use rule-based card
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

  // Open conversation — needs a real LLM (not scripted rules)
  if (preferLlm) {
    try {
      const { askEKhataLlm, checkEKhataLlmStatus, getEKhataSessionId } = await import("./ekhataLlmClient");
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
      // Fall through to browser LLM
    }

    const browser = await tryBrowserLlm(rawText, options.balance, autoLoad);
    if (browser) return browser;
  }

  return processEKhataMessage(rawText, options);
}

export async function checkEKhataLlmStatus() {
  const { checkEKhataLlmStatus: check } = await import("./ekhataLlmClient");
  return check();
}

export { loadEKhataBrowserAi, isEKhataBrowserAiReady, getWebLlmState, onWebLlmProgress, isWebGpuAvailable } from "./ekhataWebLlm";
