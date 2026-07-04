/**
 * e-Khata message router — unified pipeline: domain gate → local CA brains → LLM enhance → web (external only).
 */

import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import {
  buildLocalizedEntryReply,
  detectUserLanguage,
  understandAccountingLanguage,
} from "./accountingLanguageBrain";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
import { understandConceptualFramework } from "./conceptualFrameworkBrain";
import { understandNepalAccountingKnowledge } from "./nepalAccountingKnowledgeBrain";
import { classifyDomain } from "./domainRouter";
import { detectNegation } from "./negationDetector";
import {
  applyAmountDelta,
  buildReverseExplanation,
  detectContextualCommand,
  type EKhataConversationContext,
} from "./conversationState";
import { shouldTryWorkParse } from "./smartWorkBrain";
import { isSelfContainedAi } from "../selfContainedAi";
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

function tryJournalEntry(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const domain = classifyDomain(trimmed);
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
  const nepalAnswer = understandNepalAccountingKnowledge(trimmed);
  if (nepalAnswer.kind === "answer" && nepalAnswer.confidence >= 0.55) {
    return {
      kind: "chat",
      reply: nepalAnswer.reply,
      normalizedText,
      engine: "accounting-brain",
    };
  }

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

/** Core unified router — always runs local CA brains before web search. */
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

async function tryLlmEnhancement(
  trimmed: string,
  options: ProcessMessageOptions,
  localResult: EKhataProcessResult | null,
): Promise<EKhataProcessResult | null> {
  if (options.preferLlm === false || isSelfContainedAi()) return null;

  try {
    const { checkEKhataLlmStatus, askEKhataLlm, getEKhataSessionId } =
      await import("./ekhataLlmClient");
    const status = await checkEKhataLlmStatus();
    if (!status.khataLlm || !status.online) return null;

    const lang = detectUserLanguage(trimmed);
    const domain = classifyDomain(trimmed);

    // For journal entries already parsed locally, LLM only narrates the card (hybrid)
    if (localResult?.kind === "entry" && localResult.card) {
      const llm = await askEKhataLlm(
        trimmed,
        getEKhataSessionId(),
        options.balance,
        undefined,
        lang,
      );
      if (llm.kind === "entry" && llm.reply) {
        return {
          ...localResult,
          reply: llm.reply || localResult.reply,
          engine: "hybrid",
        };
      }
      return { ...localResult, engine: "hybrid" };
    }

    // For accounting/framework Q&A already answered locally, keep local answer (grounded)
    if (
      localResult?.kind === "chat" &&
      (localResult.engine === "accounting-brain" || localResult.engine === "framework-brain")
    ) {
      return localResult;
    }

    // Use LLM for unresolved accounting/compliance/chat when online
    if (
      domain.domain === "accounting_qa" ||
      domain.domain === "framework_qa" ||
      domain.domain === "compliance_qa" ||
      domain.domain === "emotional_chat" ||
      localResult === null
    ) {
      const llm = await askEKhataLlm(trimmed, getEKhataSessionId(), options.balance, undefined, lang);
      const normalizedText = normalizeNepaliText(trimmed);

      if (llm.kind === "entry" && llm.card) {
        return {
          kind: "entry",
          reply: llm.reply || buildLocalizedEntryReply(llm.card, lang),
          normalizedText,
          card: llm.card,
          engine: (llm.engine as "ollama" | "hybrid") ?? "ollama",
        };
      }
      if (llm.kind === "clarify" && llm.reply) {
        return { kind: "clarify", reply: llm.reply, normalizedText, engine: "ollama" };
      }
      if (llm.reply) {
        return { kind: "chat", reply: llm.reply, normalizedText, engine: "ollama" };
      }
    }
  } catch {
    // Fall through to local pipeline
  }

  return null;
}

export async function processEKhataMessageAsync(
  rawText: string,
  options: ProcessMessageOptions = {},
): Promise<EKhataProcessResult> {
  const trimmed = rawText.trim();
  const normalizedText = normalizeNepaliText(trimmed);
  const lang = detectUserLanguage(trimmed);
  const domain = classifyDomain(trimmed);

  if (!trimmed) {
    return processEKhataMessage(trimmed, options);
  }

  // 1. Contextual commands (reverse / repeat / delta)
  const contextual = tryContextualCommand(trimmed, lang, options.conversationContext);
  if (contextual) return contextual;

  const ledgerBalance = tryLedgerBalanceQuery(trimmed, normalizedText, options.balance);
  if (ledgerBalance) return ledgerBalance;

  // 2. Local journal entry parse (always first for transactions)
  const entry = tryJournalEntry(trimmed, normalizedText, lang);
  if (entry) {
    const enhanced = await tryLlmEnhancement(trimmed, options, entry);
    return enhanced ?? entry;
  }

  // 3. Local knowledge brains (framework + accounting) — fixes sampatti / IFRS offline
  const knowledge = tryKnowledgeBrains(trimmed, normalizedText);
  if (knowledge) {
    return knowledge;
  }

  // 4. LLM for remaining accounting/compliance when online
  const llmOnly = await tryLlmEnhancement(trimmed, options, null);
  if (llmOnly) return llmOnly;

  // 5. Autonomous brain — web search ONLY for external facts (never accounting domain)
  if (domain.domain === "external_fact" || !domain.blockWebSearch) {
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

  // 6. Accounting domain with no match — conversational fallback (not Wikipedia)
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
