/**
 * e-Khata message router — decides: transaction parse OR conversational brain.
 * Key fix: conversational messages NEVER get "Ke transaction ho?" error.
 */

import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
import { shouldTryTransactionParse } from "./nepaliBrain";
import type { KhataConfirmationCard, KhataParseResult } from "./types";
import type { LedgerBalanceSnapshot } from "./conversationEngine";

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
  /** Try Ollama LLM via erp_bot when available (default: true) */
  preferLlm?: boolean;
  /** Recent chat turns for conversational context */
  history?: ConversationTurn[];
}

const INTENT_LABELS: Record<string, string> = {
  khata_credit_sale: "Udharo (Credit Sale)",
  khata_cash_sale: "Nagad Bikri (Cash Sale)",
  khata_payment_in: "Payment Aayo",
  khata_purchase: "Kharid",
  khata_payment_out: "Payment Gareko",
  khata_expense: "Kharcha",
};

function buildEntryReply(card: NonNullable<KhataParseResult["card"]>): string {
  const label = INTENT_LABELS[card.intent] || card.intent;
  const party = card.party || "(party chaina)";
  return (
    `Maile yo entry bujhe:\n` +
    `• Prakar: ${label}\n` +
    `• Party: ${party}\n` +
    `• Rakam: NPR ${card.amount.toLocaleString()}\n` +
    (card.item ? `• Saman: ${card.item}\n` : "") +
    `\nSahi chha bhane **Confirm** thichnus.`
  );
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
    const parsed = parseKhataMessage(trimmed, normalizedText);

    if (parsed.clarifying_question) {
      return {
        kind: "clarify",
        reply: parsed.clarifying_question,
        normalizedText,
        engine: "rules",
      };
    }

    if (parsed.card) {
      return {
        kind: "entry",
        reply: buildEntryReply(parsed.card),
        normalizedText,
        parseResult: parsed,
        card: parsed.card,
        engine: "rules",
      };
    }
  }

  const reply = generateConversationalReply(trimmed, {
    balance: options.balance,
    history: options.history,
  });
  return {
    kind: "chat",
    reply,
    normalizedText,
    engine: "brain",
  };
}

export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const preferLlm = options.preferLlm !== false;

  if (preferLlm) {
    try {
      const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } =
        await import("./ekhataLlmClient");
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
