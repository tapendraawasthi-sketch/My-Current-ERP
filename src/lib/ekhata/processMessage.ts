/**
 * e-Khata message router — erp_bot LLM when online; local brains only as offline fallback.
 */

import { isSelfContainedAi } from "../selfContainedAi";
import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import {
  buildLocalizedEntryReply,
  detectUserLanguage,
} from "./accountingLanguageBrain";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
import { understandConceptualFramework } from "./conceptualFrameworkBrain";
import { understandAccountingLanguage } from "./accountingLanguageBrain";
import { analyzeMessageMeaning } from "./meaningEngine";
import { detectNegation } from "./negationDetector";
import {
  applyAmountDelta,
  buildReverseExplanation,
  detectContextualCommand,
  type EKhataConversationContext,
} from "./conversationState";
import { shouldTryWorkParse, extractWorkItem } from "./smartWorkBrain";
import type { KhataConfirmationCard, KhataParseResult } from "./types";
import type { LedgerBalanceSnapshot } from "./conversationEngine";
import { isLedgerBalanceQuery, replyBalance } from "./conversationEngine";

export type EKhataEngine =
  | "brain"
  | "ollama"
  | "rules"
  | "hybrid"
  | "ca"
  | "accounting-brain"
  | "framework-brain"
  | "autonomous"
  | "web-search";

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
  history?: ConversationTurn[];
  llmOnline?: boolean;
  llmModel?: string;
  conversationContext?: EKhataConversationContext;
}

function localizeClarify(question: string, lang: ReturnType<typeof detectUserLanguage>): string {
  if (lang !== "english") return question;
  const map: Record<string, string> = {
    "Aaple diye ki unle diye?":
      "Did YOU give credit or did THEY pay you? E.g. 'Ram lai 500 udhaar' = credit sale; 'Ram le 500 tiryo' = payment received",
    "Ke transaction ho? Thora clear lekhnu hola.":
      "What transaction is this? E.g. 'Ram lai 500 udhaar', 'salary 50000', 'bad debt write off 2000'",
    "Rakam kati ho? Number lekhnus.": "What is the amount? Please include a number.",
  };
  for (const [ne, en] of Object.entries(map)) {
    if (question.includes(ne.slice(0, 20))) return en;
  }
  return question;
}

function tryContextualCommand(
  trimmed: string,
  lang: ReturnType<typeof detectUserLanguage>,
  ctx?: EKhataConversationContext,
): EKhataProcessResult | null {
  if (!ctx?.lastCard) return null;
  const cmd = detectContextualCommand(trimmed);
  const normalizedText = normalizeNepaliText(trimmed);

  if (cmd === "reverse") {
    return {
      kind: "chat",
      reply: buildReverseExplanation(ctx.lastCard, lang),
      normalizedText,
      engine: "ca",
    };
  }

  if (cmd === "repeat" || cmd === "delta") {
    const card =
      cmd === "delta" ? applyAmountDelta(ctx.lastCard, trimmed) ?? ctx.lastCard : ctx.lastCard;
    return {
      kind: "entry",
      reply: buildLocalizedEntryReply(card, lang),
      normalizedText,
      card,
      engine: "ca",
    };
  }

  return null;
}

function tryLedgerBalanceQuery(
  trimmed: string,
  normalizedText: string,
  balance?: LedgerBalanceSnapshot,
): EKhataProcessResult | null {
  if (!balance || !isLedgerBalanceQuery(trimmed)) return null;
  return {
    kind: "chat",
    reply: replyBalance(balance, trimmed),
    normalizedText,
    engine: "ca",
  };
}

function tryClarificationFollowUp(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
  ctx?: EKhataConversationContext,
): EKhataProcessResult | null {
  if (!ctx || ctx.state !== "awaiting_clarification") return null;
  if (!/\d/.test(trimmed)) return null;

  const combined = [ctx.pendingPrefix ?? ctx.lastUserText, trimmed].filter(Boolean).join(" ");
  const combinedNorm = normalizeNepaliText(combined);
  const parsed = parseKhataMessage(combined, combinedNorm);

  if (parsed.card) {
    return {
      kind: "entry",
      reply: buildLocalizedEntryReply(parsed.card, lang),
      normalizedText: combinedNorm,
      parseResult: parsed,
      card: parsed.card,
      engine: "ca",
    };
  }

  if (parsed.clarifying_question) return null;

  return null;
}

function tryJournalEntry(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const meaning = analyzeMessageMeaning(trimmed);
  const domain = meaning.domain;
  const negation = detectNegation(trimmed);

  if (negation.blockEntry) {
    return {
      kind: "clarify",
      reply: localizeClarify(negation.clarification ?? "Entry confirm garna sakina.", lang),
      normalizedText,
      engine: "ca",
    };
  }

  if (domain.domain !== "journal_entry" && !shouldTryWorkParse(trimmed)) {
    return null;
  }

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

  return null;
}

function tryKnowledgeBrains(trimmed: string, normalizedText: string): EKhataProcessResult | null {
  const frameworkAnswer = understandConceptualFramework(trimmed);
  if (frameworkAnswer.kind === "answer" && frameworkAnswer.confidence >= 0.55) {
    return {
      kind: "chat",
      reply: frameworkAnswer.reply,
      normalizedText,
      engine: "framework-brain",
    };
  }

  const accountingAnswer = understandAccountingLanguage(trimmed);
  if (accountingAnswer.kind === "answer" && accountingAnswer.confidence >= 0.6) {
    return {
      kind: "chat",
      reply: accountingAnswer.reply,
      normalizedText,
      engine: "accounting-brain",
    };
  }

  return null;
}

/** Offline-only local brain pipeline — used when erp_bot is unreachable. */
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
          ? "What would you like to enter? E.g. 'Ram lai 500 udhaar', 'salary 50000', 'what is sampatti?'"
          : "Ke lekhnu hunthyo? Udaharan: 'Ram lai 500 udhaar', 'salary 50000', 'sampatti k ho?'",
      normalizedText: "",
      engine: "accounting-brain",
    };
  }

  const contextual = tryContextualCommand(trimmed, lang, options.conversationContext);
  if (contextual) return contextual;

  const ledgerBalance = tryLedgerBalanceQuery(trimmed, normalizedText, options.balance);
  if (ledgerBalance) return ledgerBalance;

  const clarifyFollowUp = tryClarificationFollowUp(
    trimmed,
    normalizedText,
    lang,
    options.conversationContext,
  );
  if (clarifyFollowUp) return clarifyFollowUp;

  const entry = tryJournalEntry(trimmed, normalizedText, lang);
  if (entry) return entry;

  const knowledge = tryKnowledgeBrains(trimmed, normalizedText);
  if (knowledge) return knowledge;

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

async function routeThroughErpBot(
  trimmed: string,
  options: ProcessMessageOptions,
): Promise<EKhataProcessResult | null> {
  if (isSelfContainedAi()) return null;

  try {
    const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } =
      await import("./ekhataLlmClient");
    const status = await checkEKhataLlmStatus();
    if (!status.online || !status.khataLlm) return null;

    const lang = detectUserLanguage(trimmed);
    const normalizedText = normalizeNepaliText(trimmed);
    const llm = await askEKhataLlm(
      trimmed,
      getEKhataSessionId(),
      options.balance,
      undefined,
      lang,
    );

    if (llm.kind === "entry" && llm.card) {
      return {
        kind: "entry",
        reply: llm.reply,
        normalizedText,
        card: llm.card,
        engine: (llm.engine as EKhataEngine) ?? "ollama",
      };
    }
    if (llm.kind === "clarify") {
      return {
        kind: "clarify",
        reply: llm.reply,
        normalizedText,
        engine: (llm.engine as EKhataEngine) ?? "ollama",
      };
    }
    return {
      kind: "chat",
      reply: llm.reply,
      normalizedText,
      engine: (llm.engine as EKhataEngine) ?? "ollama",
    };
  } catch {
    return null;
  }
}

export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const trimmed = rawText.trim();

  // When erp_bot is online, 100% of replies come from the backend LLM
  const backend = await routeThroughErpBot(trimmed, options);
  if (backend) return backend;

  // Offline degraded mode — local static brains only after confirmed /status failure
  return processEKhataMessage(trimmed, options);
}

export async function checkEKhataLlmStatus() {
  try {
    const { checkEKhataLlmStatus: check } = await import("./ekhataLlmClient");
    return check();
  } catch {
    return { online: false, khataLlm: false };
  }
}

export type { EKhataConversationContext } from "./conversationState";
export {
  createConversationContext,
  updateContextAfterConfirm,
  updateContextAfterEntry,
} from "./conversationState";
