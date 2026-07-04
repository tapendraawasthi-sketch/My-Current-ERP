/**
 * e-Khata message router — Accounting Language Brain + CA entry maker + Ollama LLM.
 */

import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import {
  buildLocalizedEntryReply,
  detectUserLanguage,
  understandAccountingLanguage,
} from "./accountingLanguageBrain";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
import { shouldTryWorkParse } from "./smartWorkBrain";
import type { KhataConfirmationCard, KhataParseResult } from "./types";
import type { LedgerBalanceSnapshot } from "./conversationEngine";

export type EKhataEngine =
  "brain" | "ollama" | "rules" | "hybrid" | "ca" | "accounting-brain" | "autonomous" | "web-search";

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
  /** LLM status for meta questions */
  llmOnline?: boolean;
  llmModel?: string;
}

function localizeClarify(question: string, lang: ReturnType<typeof detectUserLanguage>): string {
  if (lang !== "english") return question;
  const map: Record<string, string> = {
    "Aaple diye ki unle diye?":
      "Did YOU give or did THEY pay? (e.g. 'Ram lai 500 diye' = credit sale; 'Shyam le 500 tiryo' = payment received)",
    "Ke transaction ho? Thora clear lekhnus.":
      "What transaction is this? Please be clearer — e.g. 'Ram lai 500 udhaar', 'salary 50000', 'bad debt write off 2000'",
    "Rakam kati ho? Number lekhnus.": "What is the amount? Please include a number.",
  };
  for (const [ne, en] of Object.entries(map)) {
    if (question.includes(ne.slice(0, 20))) return en;
  }
  return question;
}

export function processEKhataMessage(
  rawText: string,
  options: ProcessMessageOptions = {},
): EKhataProcessResult {
  const trimmed = (rawText || "").trim();
  const normalizedText = normalizeNepaliText(trimmed);
  const lang = detectUserLanguage(trimmed);

  if (!trimmed) {
    return {
      kind: "chat",
      reply:
        lang === "english"
          ? "What would you like to enter? E.g. 'Ram lai 500 udhaar', 'salary 50000', 'what entry for bad debt?'"
          : "Ke lekhnu hunthyo? Udaharan: 'Ram lai 500 udhaar', 'salary 50000', 'bad debt ko entry k hunchha?'",
      normalizedText: "",
      engine: "accounting-brain",
    };
  }

  // 1. Accounting work — natural language entry parse
  if (shouldTryWorkParse(trimmed)) {
    const parsed = parseKhataMessage(trimmed, normalizedText);

    if (parsed.clarifying_question) {
      return {
        kind: "clarify",
        reply: localizeClarify(parsed.clarifying_question, lang),
        normalizedText,
        engine: "ca",
      };
    }

    if (parsed.card) {
      return {
        kind: "entry",
        reply: buildLocalizedEntryReply(parsed.card, lang),
        normalizedText,
        parseResult: parsed,
        card: parsed.card,
        engine: "ca",
      };
    }
  }

  // 2. Accounting language questions → semantic brain (bilingual)
  const accountingAnswer = understandAccountingLanguage(trimmed);
  if (accountingAnswer.kind === "answer" && accountingAnswer.confidence >= 0.6) {
    return {
      kind: "chat",
      reply: accountingAnswer.reply,
      normalizedText,
      engine: "accounting-brain",
    };
  }

  // 3. General conversation → emotional conversational brain
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
        const lang = detectUserLanguage(rawText);
        const llm = await askEKhataLlm(
          rawText,
          getEKhataSessionId(),
          options.balance,
          undefined,
          lang,
        );
        const normalizedText = normalizeNepaliText(rawText);

        if (llm.kind === "entry" && llm.card) {
          return {
            kind: "entry",
            reply: llm.reply || buildLocalizedEntryReply(llm.card, lang),
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
        if (llm.reply) {
          return {
            kind: "chat",
            reply: llm.reply,
            normalizedText,
            engine: "ollama",
          };
        }
      }
    } catch {
      // Fall through to built-in accounting brain
    }
  }

  return processWithAutonomousBrain(rawText, options);
}

async function processWithAutonomousBrain(
  rawText: string,
  options: ProcessMessageOptions,
): Promise<EKhataProcessResult> {
  const trimmed = rawText.trim();
  const normalizedText = normalizeNepaliText(trimmed);

  // Sync path: accounting work + entries first
  const syncResult = processEKhataMessage(trimmed, options);
  if (syncResult.kind !== "chat" || syncResult.engine !== "brain") {
    return syncResult;
  }

  // Chat fallback → autonomous brain (web search + reasoning)
  const { askAutonomousBrain } = await import("./autonomousBrain");
  const autonomous = await askAutonomousBrain(trimmed, {
    balance: options.balance,
    history: options.history,
    llmOnline: options.llmOnline,
    llmModel: options.llmModel,
  });

  return {
    kind: "chat",
    reply: autonomous.reply,
    normalizedText,
    engine: autonomous.engine,
  };
}

export async function checkEKhataLlmStatus() {
  try {
    const { checkEKhataLlmStatus: check } = await import("./ekhataLlmClient");
    return check();
  } catch {
    return { online: false, khataLlm: false };
  }
}
