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
import { generateConversationalReply, analyzeQuestion, type ConversationTurn } from "./conversationalBrain";
import { processWithUnifiedIntelligence } from "./unifiedIntelligence";
import { understandConceptualFramework } from "./conceptualFrameworkBrain";
import { understandAccountingLanguage } from "./accountingLanguageBrain";
import { analyzeMessageMeaning } from "./meaningEngine";
import { detectNegation } from "./negationDetector";
import { checkSafetyGate } from "../nepal-ai/safetyGate";
import { isNepaliAccountingQuestion } from "../nepal-ai/questionDetect";
import { detectDiscourseAction } from "../nepal-ai/discourse";
import { matchAndResolveContext } from "../nepal-ai/contextResolution";
import {
  isSocialDiscourseUtterance,
  replySocialDiscourse,
} from "../nepal-ai/socialDiscourse";
import {
  formatCodeMixedUtteranceReply,
  matchCodeMixedUtterance,
} from "../nepal-ai/codeMixedUtterances";
import {
  formatWordSenseClarify,
  formatWordSenseResolution,
  resolveWordSense,
  wordSenseNeedsClarification,
} from "../nepal-ai/wordSenseContexts";
import {
  edgeCaseNeedsClarification,
  formatEdgeCaseReply,
  hasConversationContext,
  isAdversarialEdgeCase,
  matchEdgeCaseHandler,
} from "../nepal-ai/edgeCaseHandlers";
import {
  formatComplexReasoningAnswer,
  isComplexReasoningClarify,
  matchComplexReasoningScenario,
} from "../nepal-ai/complexReasoningScenarios";
import {
  formatCrossDomainAnswer,
  matchCrossDomainScenario,
} from "../nepal-ai/crossDomainScenarios";
import {
  formatClassificationExplanation,
  matchClassificationExplanation,
} from "../nepal-ai/classificationExplanations";
import {
  formatNovelPatternAnswer,
  formatNovelPatternClarify,
  matchNovelPatternHandler,
} from "../nepal-ai/novelPatternHandlers";
import {
  formatDocumentComprehensionAnswer,
  matchDocumentComprehensionScenario,
} from "../nepal-ai/documentComprehensionScenarios";
import {
  formatPromptVariantSummary,
  matchPromptVariant,
} from "../nepal-ai/promptVariants";
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
import { isCompoundMessage } from "./compound";
import { buildCompoundBatch } from "./compoundBatch";
import { CLARIFY_ERROR_PATTERNS } from "../nepal-ai/generated/runtimeMaps";

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
    }
  | {
      kind: "compound";
      reply: string;
      normalizedText: string;
      batch: import("./compoundBatch").KhataCompoundBatchCard;
      engine: EKhataEngine;
    };

export interface ProcessMessageOptions {
  balance?: LedgerBalanceSnapshot;
  preferLlm?: boolean;
  history?: ConversationTurn[];
  llmOnline?: boolean;
  llmModel?: string;
  conversationContext?: EKhataConversationContext;
  /** Logged-in ERP user — for "do you know me?" style replies */
  userName?: string;
}

function localizeClarify(question: string, lang: ReturnType<typeof detectUserLanguage>): string {
  if (lang !== "english") return question;
  const lexiconHit = CLARIFY_ERROR_PATTERNS.find((p) => p.clarifyQuestionNe === question);
  if (lexiconHit?.clarifyQuestionEn) return lexiconHit.clarifyQuestionEn;
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

function trySafetyRefusal(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const gate = checkSafetyGate(trimmed);
  if (gate) {
    return {
      kind: "chat",
      reply: lang === "english" ? gate.response_en : gate.response_ne,
      normalizedText,
      engine: "ca",
    };
  }

  const adversarialEdge = matchEdgeCaseHandler(trimmed) ?? matchEdgeCaseHandler(normalizedText);
  if (adversarialEdge && isAdversarialEdgeCase(adversarialEdge)) {
    return {
      kind: "chat",
      reply: formatEdgeCaseReply(adversarialEdge, false, lang),
      normalizedText,
      engine: "ca",
    };
  }

  return null;
}

function tryConversationalChat(
  trimmed: string,
  normalizedText: string,
  options: ProcessMessageOptions,
): EKhataProcessResult | null {
  const analysis = analyzeQuestion(trimmed, options.history ?? []);
  const socialKinds = new Set([
    "about_bot_identity",
    "about_bot_gender",
    "about_bot_human",
    "about_bot_feelings",
    "about_bot_age",
    "about_user_identity",
    "greeting",
    "farewell",
    "thanks",
    "help",
    "capability",
    "abuse",
    "small_talk",
  ]);
  if (analysis.confidence < 0.85 || !socialKinds.has(analysis.kind)) return null;

  const reply = generateConversationalReply(trimmed, {
    balance: options.balance,
    history: options.history,
    userName: options.userName,
  });
  return {
    kind: "chat",
    reply,
    normalizedText,
    engine: "brain",
  };
}

function tryAccountingQuestion(
  trimmed: string,
  normalizedText: string,
): EKhataProcessResult | null {
  if (!isNepaliAccountingQuestion(trimmed)) return null;

  const accountingAnswer = understandAccountingLanguage(trimmed);
  if (accountingAnswer.kind === "answer" && accountingAnswer.confidence >= 0.5) {
    return {
      kind: "chat",
      reply: accountingAnswer.reply,
      normalizedText,
      engine: "accounting-brain",
    };
  }

  const frameworkAnswer = understandConceptualFramework(trimmed);
  if (frameworkAnswer.kind === "answer" && frameworkAnswer.confidence >= 0.5) {
    return {
      kind: "chat",
      reply: frameworkAnswer.reply,
      normalizedText,
      engine: "framework-brain",
    };
  }

  return null;
}

function tryDiscourseFollowUp(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
  ctx?: EKhataConversationContext,
): EKhataProcessResult | null {
  if (!ctx?.lastCard) return null;
  const discourse = detectDiscourseAction(trimmed);
  if (!discourse) return null;

  if (discourse.action === "cancel_pending") {
    return {
      kind: "clarify",
      reply:
        lang === "english"
          ? "Entry cancelled. What would you like to record instead?"
          : "Entry radda gariyo. Aru ke lekhnu hunthyo?",
      normalizedText,
      engine: "ca",
    };
  }

  if (discourse.action === "confirm_pending") {
    return {
      kind: "entry",
      reply: buildLocalizedEntryReply(ctx.lastCard, lang),
      normalizedText,
      card: ctx.lastCard,
      engine: "ca",
    };
  }

  // Amount/party correction via discourse map ("hoina 600", "500 hoina 600")
  if (discourse.action === "correct_amount" || discourse.action === "correct_pending") {
    const resolved = matchAndResolveContext(trimmed, {
      lastParty: ctx.lastParty ?? ctx.lastCard.party,
      lastAmount: ctx.lastAmount ?? ctx.lastCard.amount,
      lastIntent: ctx.lastCard.intent,
      pendingParty: ctx.pendingParty,
      awaiting: ctx.awaiting,
    });
    const parseText = resolved?.resolvedText
      ?? (ctx.lastCard.party
        ? `${ctx.lastCard.party} lai ${(trimmed.match(/\d+(?:\.\d+)?/) || [])[0] ?? ctx.lastCard.amount} diye`
        : trimmed);
    const parsed = parseKhataMessage(parseText);
    if (parsed.card) {
      return {
        kind: "entry",
        reply: buildLocalizedEntryReply(parsed.card, lang),
        normalizedText: normalizeNepaliText(parseText),
        parseResult: parsed,
        card: parsed.card,
        engine: "ca",
      };
    }
  }

  return null;
}

function tryContextResolutionFollowUp(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
  ctx?: EKhataConversationContext,
): EKhataProcessResult | null {
  if (!ctx) return null;
  const hasMemory =
    Boolean(ctx.lastCard) ||
    Boolean(ctx.lastParty) ||
    Boolean(ctx.pendingParty) ||
    Boolean(ctx.awaiting) ||
    ctx.state === "awaiting_clarification" ||
    ctx.state === "transaction_detected";
  if (!hasMemory) return null;

  const resolved = matchAndResolveContext(trimmed, {
    lastParty: ctx.lastParty ?? ctx.lastCard?.party,
    lastParties: ctx.lastParties,
    lastAmount: ctx.lastAmount ?? ctx.lastCard?.amount,
    lastIntent: ctx.lastCard?.intent,
    lastUserText: ctx.lastUserText,
    lastBank: ctx.lastBank,
    lastAtm: ctx.lastAtm,
    lastMethod: ctx.lastMethod,
    pendingParty: ctx.pendingParty,
    awaiting: ctx.awaiting,
  });
  if (!resolved) return null;

  // Confirm / cancel / continue discourse actions without re-parsing
  if (resolved.baseAction === "confirm_pending" && ctx.lastCard) {
    return {
      kind: "entry",
      reply: buildLocalizedEntryReply(ctx.lastCard, lang),
      normalizedText,
      card: ctx.lastCard,
      engine: "ca",
    };
  }
  if (resolved.baseAction === "cancel_pending") {
    return {
      kind: "clarify",
      reply:
        lang === "english"
          ? "Entry cancelled. What would you like to record instead?"
          : "Entry radda gariyo. Aru ke lekhnu hunthyo?",
      normalizedText,
      engine: "ca",
    };
  }

  // Query / informational patterns
  if (resolved.baseAction === "query_detail" || resolved.baseAction === "query_balance") {
    if (ctx.lastCard && /amount|payment_amount|last_transaction_amount/i.test(resolved.intentHint)) {
      return {
        kind: "chat",
        reply:
          lang === "english"
            ? `Last amount was NPR ${ctx.lastCard.amount.toLocaleString()}${ctx.lastCard.party ? ` (${ctx.lastCard.party})` : ""}.`
            : `Pachillo amount NPR ${ctx.lastCard.amount.toLocaleString()} thiyo${ctx.lastCard.party ? ` (${ctx.lastCard.party})` : ""}.`,
        normalizedText,
        engine: "ca",
      };
    }
    if (ctx.lastCard && /party/i.test(resolved.intentHint)) {
      return {
        kind: "chat",
        reply:
          lang === "english"
            ? `Last party: ${ctx.lastCard.party ?? "unknown"}.`
            : `Pachillo party: ${ctx.lastCard.party ?? "thaha chaina"}.`,
        normalizedText,
        engine: "ca",
      };
    }
    if (ctx.lastCard && /detail|transaction_detail|list_item/i.test(resolved.intentHint)) {
      return {
        kind: "chat",
        reply: buildLocalizedEntryReply(ctx.lastCard, lang),
        normalizedText,
        engine: "ca",
      };
    }
    if (resolved.intentHint === "khata_balance_check" && resolved.party) {
      return {
        kind: "chat",
        reply:
          lang === "english"
            ? `Looking up balance for ${resolved.party}… (open ledger for exact figure).`
            : `${resolved.party} ko balance ledger ma check garnus — last entry context ready cha.`,
        normalizedText,
        engine: "ca",
      };
    }
  }

  // Re-parse expanded utterance into an entry
  if (resolved.resolvedText && resolved.resolvedText !== trimmed) {
    const parsed = parseKhataMessage(resolved.resolvedText);
    if (parsed.card) {
      return {
        kind: "entry",
        reply: buildLocalizedEntryReply(parsed.card, lang),
        normalizedText: normalizeNepaliText(resolved.resolvedText),
        parseResult: parsed,
        card: parsed.card,
        engine: "ca",
      };
    }
    if (parsed.clarifying_question) {
      return {
        kind: "clarify",
        reply: localizeClarify(parsed.clarifying_question, lang),
        normalizedText: normalizeNepaliText(resolved.resolvedText),
        engine: "ca",
      };
    }
  }

  // Same-text pattern that still implies repeat of last card
  if (
    (resolved.family === "implicit_continue" || resolved.intentHint === "khata_repeat_transaction") &&
    ctx.lastCard
  ) {
    return {
      kind: "entry",
      reply: buildLocalizedEntryReply(ctx.lastCard, lang),
      normalizedText,
      card: ctx.lastCard,
      engine: "ca",
    };
  }

  return null;
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

function tryCodeMixedUtterance(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
  balance?: LedgerBalanceSnapshot,
): EKhataProcessResult | null {
  const hit =
    matchCodeMixedUtterance(trimmed) ?? matchCodeMixedUtterance(normalizedText);
  if (!hit) return null;

  const reply = formatCodeMixedUtteranceReply(hit, lang, balance);
  const isClarify =
    hit.intent === "correction_request" ||
    hit.intent === "verification_request" ||
    hit.intent === "reconciliation_request";

  return {
    kind: isClarify ? "clarify" : "chat",
    reply,
    normalizedText: hit.normalized || normalizedText,
    engine: "brain",
  };
}

function tryWordSenseDisambiguation(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const ambiguous = wordSenseNeedsClarification(trimmed);
  if (ambiguous) {
    return {
      kind: "clarify",
      reply: formatWordSenseClarify(ambiguous, lang),
      normalizedText,
      engine: "brain",
    };
  }

  const resolved = resolveWordSense(trimmed);
  if (resolved && resolved.confidence >= 0.85) {
    const nonTxn =
      resolved.context.intentIfUsed.includes("general") ||
      resolved.context.intentIfUsed.includes("inquiry") ||
      resolved.context.intentIfUsed.includes("query") ||
      resolved.context.intentIfUsed.includes("chat") ||
      resolved.context.intentIfUsed.includes("support");
    if (nonTxn && !/\b(lai|le|bata|udhaar|bikri|kharid)\b/i.test(trimmed)) {
      return {
        kind: "chat",
        reply: formatWordSenseResolution(resolved, lang),
        normalizedText,
        engine: "brain",
      };
    }
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

  // Amount follow-up (digits/words) or short party/direction reply
  const hasAmount = /\d/.test(trimmed) || /\b(saya|hajar|lakh|crore|rupiya|rupees?)\b/i.test(trimmed);
  const shortClarifyReply =
    trimmed.split(/\s+/).length <= 6 &&
    !/\b(k\s*ho|ke\s*ho|kasari|matlab)\b/i.test(trimmed);
  if (!hasAmount && !shortClarifyReply) return null;

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

function tryEdgeCaseHandler(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
  ctx?: EKhataConversationContext,
): EKhataProcessResult | null {
  const hit = matchEdgeCaseHandler(trimmed) ?? matchEdgeCaseHandler(normalizedText);
  if (!hit || isAdversarialEdgeCase(hit)) return null;

  const hasCtx = hasConversationContext(ctx);
  if (!edgeCaseNeedsClarification(hit, hasCtx)) {
    if (hasCtx) {
      return {
        kind: "chat",
        reply: formatEdgeCaseReply(hit, true, lang),
        normalizedText,
        engine: "brain",
      };
    }
    return null;
  }

  return {
    kind: "clarify",
    reply: formatEdgeCaseReply(hit, false, lang),
    normalizedText,
    engine: "brain",
  };
}

function tryComplexReasoningScenario(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchComplexReasoningScenario(trimmed) ??
    matchComplexReasoningScenario(normalizedText);
  if (!hit) return null;

  return {
    kind: isComplexReasoningClarify(hit) ? "clarify" : "chat",
    reply: formatComplexReasoningAnswer(hit, lang),
    normalizedText,
    engine: "accounting-brain",
  };
}

function tryCrossDomainScenario(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchCrossDomainScenario(trimmed) ?? matchCrossDomainScenario(normalizedText);
  if (!hit) return null;

  return {
    kind: "chat",
    reply: formatCrossDomainAnswer(hit, lang),
    normalizedText,
    engine: "accounting-brain",
  };
}

function tryClassificationExplanation(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchClassificationExplanation(trimmed) ??
    matchClassificationExplanation(normalizedText);
  if (!hit) return null;

  return {
    kind: "chat",
    reply: formatClassificationExplanation(hit, lang),
    normalizedText,
    engine: "accounting-brain",
  };
}

function tryNovelPatternHandler(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchNovelPatternHandler(trimmed) ?? matchNovelPatternHandler(normalizedText);
  if (!hit) return null;

  return {
    kind: hit.clarifyIfNeeded?.trim() ? "clarify" : "chat",
    reply: hit.clarifyIfNeeded?.trim()
      ? formatNovelPatternClarify(hit, lang)
      : formatNovelPatternAnswer(hit, lang),
    normalizedText,
    engine: "brain",
  };
}

function tryPromptVariant(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchPromptVariant(trimmed) ?? matchPromptVariant(normalizedText);
  if (!hit) return null;

  return {
    kind: "chat",
    reply: formatPromptVariantSummary(hit, lang),
    normalizedText,
    engine: "accounting-brain",
  };
}

function tryDocumentComprehensionScenario(
  trimmed: string,
  normalizedText: string,
  lang: ReturnType<typeof detectUserLanguage>,
): EKhataProcessResult | null {
  const hit =
    matchDocumentComprehensionScenario(trimmed) ??
    matchDocumentComprehensionScenario(normalizedText);
  if (!hit) return null;

  return {
    kind: "chat",
    reply: formatDocumentComprehensionAnswer(hit, lang),
    normalizedText,
    engine: "accounting-brain",
  };
}

function tryCompoundEntry(
  trimmed: string,
  normalizedText: string,
): EKhataProcessResult | null {
  if (!isCompoundMessage(trimmed)) return null;

  const built = buildCompoundBatch(trimmed);
  if (!built.ok) {
    return {
      kind: "clarify",
      reply: built.reply,
      normalizedText,
      engine: "ca",
    };
  }

  return {
    kind: "compound",
    reply: built.reply,
    normalizedText,
    batch: built.batch,
    engine: "ca",
  };
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

/**
 * Human-like semantic understanding layer.
 * This catches questions and commands that pattern matchers miss.
 */
function tryUnifiedIntelligence(
  trimmed: string,
  normalizedText: string,
  options: ProcessMessageOptions,
): EKhataProcessResult | null {
  const result = processWithUnifiedIntelligence(trimmed, {
    history: options.history,
    balance: options.balance,
    userName: options.userName,
  });

  // Only use unified intelligence for high-confidence results
  if (result.confidence < 0.7) return null;

  // For transactions, let the existing CA engine handle it
  if (result.isTransaction) return null;

  // Use unified intelligence for questions and commands
  if (result.source === "concepts" || result.source === "semantic") {
    return {
      kind: "chat",
      reply: result.answer,
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

  const safety = trySafetyRefusal(trimmed, normalizedText, lang);
  if (safety) return safety;

  // Try unified semantic intelligence early for questions that pattern matchers miss
  const unified = tryUnifiedIntelligence(trimmed, normalizedText, options);
  if (unified) return unified;

  const discourse = tryDiscourseFollowUp(
    trimmed,
    normalizedText,
    lang,
    options.conversationContext,
  );
  if (discourse) return discourse;

  const contextFollowUp = tryContextResolutionFollowUp(
    trimmed,
    normalizedText,
    lang,
    options.conversationContext,
  );
  if (contextFollowUp) return contextFollowUp;

  const ledgerBalance = tryLedgerBalanceQuery(trimmed, normalizedText, options.balance);
  if (ledgerBalance) return ledgerBalance;

  const codeMixed = tryCodeMixedUtterance(
    trimmed,
    normalizedText,
    lang,
    options.balance,
  );
  if (codeMixed) return codeMixed;

  const wordSense = tryWordSenseDisambiguation(trimmed, normalizedText, lang);
  if (wordSense) return wordSense;

  const clarifyFollowUp = tryClarificationFollowUp(
    trimmed,
    normalizedText,
    lang,
    options.conversationContext,
  );
  if (clarifyFollowUp) return clarifyFollowUp;

  const edgeCase = tryEdgeCaseHandler(
    trimmed,
    normalizedText,
    lang,
    options.conversationContext,
  );
  if (edgeCase) return edgeCase;

  const complexReasoning = tryComplexReasoningScenario(
    trimmed,
    normalizedText,
    lang,
  );
  if (complexReasoning) return complexReasoning;

  const crossDomain = tryCrossDomainScenario(trimmed, normalizedText, lang);
  if (crossDomain) return crossDomain;

  const classExplain = tryClassificationExplanation(trimmed, normalizedText, lang);
  if (classExplain) return classExplain;

  const novelPattern = tryNovelPatternHandler(trimmed, normalizedText, lang);
  if (novelPattern) return novelPattern;

  const promptVariant = tryPromptVariant(trimmed, normalizedText, lang);
  if (promptVariant) return promptVariant;

  const docComprehension = tryDocumentComprehensionScenario(
    trimmed,
    normalizedText,
    lang,
  );
  if (docComprehension) return docComprehension;

  const compound = tryCompoundEntry(trimmed, normalizedText);
  if (compound) return compound;

  // Social discourse BEFORE accounting-question / journal (NOT_transaction + NOT_question)
  if (isSocialDiscourseUtterance(trimmed)) {
    const socialReply = replySocialDiscourse(trimmed);
    if (socialReply) {
      return {
        kind: "chat",
        reply: socialReply,
        normalizedText,
        engine: "brain",
      };
    }
  }

  // Conversational / identity — before accounting-question detector ("timi ko?" has "?")
  const conversational = tryConversationalChat(trimmed, normalizedText, options);
  if (conversational) return conversational;

  const accountingQuestion = tryAccountingQuestion(trimmed, normalizedText);
  if (accountingQuestion) return accountingQuestion;

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
