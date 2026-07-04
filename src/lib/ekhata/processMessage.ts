/**
 * Main e-Khata message processor — routes between transaction parsing
 * and the self-contained Nepali conversational brain.
 * No external APIs or downloads required.
 */

import { parseKhataMessage } from "./parseKhata";
import { buildParseReply, type LedgerBalanceSnapshot } from "./conversationEngine";
import { generateNepaliReply, shouldTryTransactionParse } from "./nepaliBrain";
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
  /** Optional Ollama when erp_bot + Ollama explicitly deployed */
  preferLlm?: boolean;
}

export function processEKhataMessage(
  rawText: string,
  options: ProcessMessageOptions = {},
): EKhataProcessResult {
  const trimmed = (rawText || "").trim();
  const normalizedText = normalizeNepaliText(trimmed);

  if (!trimmed) {
    return {
      kind: "chat",
      reply: "Ke lekhnu hunthyo? Udaharan: 'Ram lai 500 udhaar diye' wa 'namaste'",
      normalizedText: "",
      engine: "brain",
    };
  }

  if (shouldTryTransactionParse(trimmed)) {
    const parseResult = parseKhataMessage(trimmed, normalizedText);

    if (parseResult.clarifying_question) {
      return {
        kind: "clarify",
        reply: buildParseReply(parseResult),
        normalizedText,
        engine: "rules",
      };
    }

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
  }

  return {
    kind: "chat",
    reply: generateNepaliReply(trimmed, options.balance),
    normalizedText,
    engine: "brain",
  };
}

export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const preferLlm = options.preferLlm === true;

  if (preferLlm) {
    try {
      const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } = await import("./ekhataLlmClient");
      const status = await checkEKhataLlmStatus();
      if (status.khataLlm && status.online) {
        const llm = await askEKhataLlm(rawText, getEKhataSessionId(), options.balance);
        const normalizedText = normalizeNepaliText(rawText);

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
