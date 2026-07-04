/**
 * e-Khata message router — CA-level accounting entry maker + conversational brain.
 */

import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import { formatJournalPreview } from "./caEntryEngine";
import { generateNepaliReply, shouldTryTransactionParse } from "./nepaliBrain";
import type { KhataConfirmationCard, KhataParseResult } from "./types";
import { KHATA_INTENT_LABELS } from "./types";
import type { LedgerBalanceSnapshot } from "./conversationEngine";

export type EKhataEngine = "brain" | "ollama" | "rules" | "hybrid" | "ca";

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
}

function buildEntryReply(card: NonNullable<KhataParseResult["card"]>): string {
  const label = KHATA_INTENT_LABELS[card.intent] || card.intent;
  const party = card.party || "(party chaina)";
  const lines = card.journalLines ?? [];

  let reply =
    `📒 CA-Level Entry:\n` +
    `• Prakar: ${label}\n` +
    `• Party: ${party}\n` +
    `• Rakam: NPR ${card.amount.toLocaleString()}\n` +
    (card.item ? `• Saman/Vivaran: ${card.item}\n` : "") +
    (card.primaryClass ? `• Class: ${card.primaryClass}\n` : "");

  if (lines.length > 0) {
    reply += `\n📋 Journal Entry:\n${formatJournalPreview(lines)}\n`;
  }

  if (card.caExplanation) {
    reply += `\n💡 CA Note: ${card.caExplanation}\n`;
  }

  reply += `\nSahi chha bhane **Confirm** thichnus.`;
  return reply;
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
      reply: "Ke lekhnu hunthyo? Udaharan: 'Ram lai 500 udhaar', 'salary 50000', 'bad debt write off 2000'",
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
        engine: "ca",
      };
    }

    if (parsed.card) {
      return {
        kind: "entry",
        reply: buildEntryReply(parsed.card),
        normalizedText,
        parseResult: parsed,
        card: parsed.card,
        engine: "ca",
      };
    }
  }

  const reply = generateNepaliReply(trimmed, options.balance);
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
      // Built-in CA engine
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
