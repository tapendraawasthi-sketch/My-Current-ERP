/**
 * e-Khata Autonomous Brain — self-directed reasoning + REAL web search (external facts only).
 */

import { shouldBlockWebSearch } from "./domainRouter";
import { searchKnowledge } from "./nepaliBrain";
import { composeEmotionalReply, detectEmotionalContext } from "./emotionalBrain";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
import { understandAccountingLanguage } from "./accountingLanguageBrain";
import { understandConceptualFramework } from "./conceptualFrameworkBrain";
import { formatRealSearchAnswer, searchWebReal } from "./ekhataWebSearch";
import type { LedgerBalanceSnapshot } from "./conversationEngine";

export interface AutonomousBrainOptions {
  balance?: LedgerBalanceSnapshot;
  history?: ConversationTurn[];
  llmOnline?: boolean;
  llmModel?: string;
}

export interface AutonomousBrainResult {
  reply: string;
  engine: "autonomous" | "web-search" | "brain";
  searchedWeb: boolean;
  sources: string[];
}

const META_ONLINE =
  /\b(am\s+i\s+online|online\s*du|online\s*chu|online\s*chau|online\s*ho|ahile\s+online|k\s*ma\s+online|ke\s+ma\s+online|connected|connection|internet|llm\s*online|ollama\s*online|timi\s+online|tapai\s+online)\b/i;

const META_STATUS =
  /\b(what\s+are\s+you|who\s+are\s+you|what\s+can\s+you|what\s+do\s+you|timi\s+ko\s+ho|ke\s+ho\s+timi|your\s+brain|mero\s+brain)\b/i;

const FACTUAL_QUESTION =
  /\b(who\s+is|what\s+is|where\s+is|when\s+did|how\s+much|tell\s+me\s+about|k\s*ho|ke\s*ho|kun\s+ho|kati\s+ho|explain|define|search|google|look\s*up|latest|current|today|news|weather|mausam|population|capital|president|prime\s+minister|\bpm\b)\b/i;

function answerMetaQuestion(text: string, opts: AutonomousBrainOptions): string | null {
  const t = text.toLowerCase();

  if (META_ONLINE.test(t)) {
    if (opts.llmOnline) {
      return (
        `Hajur online hunuhunchha! e-Khata + Ollama LLM ${opts.llmModel ? `(${opts.llmModel})` : ""} connected chha.\n\nAccounting sodhnus — ma CA brain bata jawaf dinchhu; general facts ko lagi Wikipedia khojchhu.`
      );
    }
    return (
      `Hajur online hunuhunchha!\n\n` +
      `e-Khata **CA Brain** active chha — accounting entries, IFRS framework, bilingual Q&A. ` +
      `Ollama offline chha; external facts ko lagi Wikipedia khojna sakinchha.`
    );
  }

  if (META_STATUS.test(t) && !/\b(vat|tax|debit|credit|sampatti|asset)\b/i.test(t)) {
    return (
      `Ma **e-Khata CA Brain** ho:\n\n` +
      `📒 **Accounting entries** — Nepali/English natural language\n` +
      `📘 **IFRS/NAS framework** — conceptual Q&A\n` +
      `🌐 **Web search** — external facts matra (accounting Wikipedia ma jadaina)\n` +
      `${opts.llmOnline ? `🟢 Ollama: ${opts.llmModel ?? "online"}` : "🟡 Built-in CA brain + Wikipedia for general facts"}`
    );
  }

  return null;
}

export function shouldAutonomousWebSearch(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (META_ONLINE.test(t) || META_STATUS.test(t)) return false;
  if (shouldBlockWebSearch(text)) return false;
  if (FACTUAL_QUESTION.test(t)) return true;
  return t.length > 10 && /\?/.test(t);
}

function detectLang(text: string): "nepali" | "english" | "mixed" {
  if (/[\u0900-\u097F]/.test(text)) return "nepali";
  if (/\b(the|is|are|what|who|how|pm|of|nepal)\b/i.test(text)) return "english";
  return "mixed";
}

export async function askAutonomousBrain(
  text: string,
  options: AutonomousBrainOptions = {},
): Promise<AutonomousBrainResult> {
  const trimmed = text.trim();
  const lang = detectLang(trimmed);
  const emotional = detectEmotionalContext(trimmed, options.history ?? []);

  const meta = answerMetaQuestion(trimmed, options);
  if (meta) {
    return {
      reply: composeEmotionalReply(meta, emotional, { userText: trimmed, factual: true }),
      engine: "autonomous",
      searchedWeb: false,
      sources: ["system"],
    };
  }

  // Accounting domain — never Wikipedia
  if (shouldBlockWebSearch(trimmed)) {
    const framework = understandConceptualFramework(trimmed);
    if (framework.kind === "answer" && framework.confidence >= 0.5) {
      return {
        reply: composeEmotionalReply(framework.reply, emotional, { userText: trimmed, factual: true }),
        engine: "autonomous",
        searchedWeb: false,
        sources: ["framework-brain"],
      };
    }

    const accounting = understandAccountingLanguage(trimmed);
    if (accounting.kind === "answer" && accounting.confidence >= 0.55) {
      return {
        reply: composeEmotionalReply(accounting.reply, emotional, { userText: trimmed, factual: true }),
        engine: "autonomous",
        searchedWeb: false,
        sources: ["accounting-brain"],
      };
    }

    const local = searchKnowledge(trimmed);
    if (local) {
      return {
        reply: composeEmotionalReply(local, emotional, { userText: trimmed, factual: true }),
        engine: "autonomous",
        searchedWeb: false,
        sources: ["knowledge-base"],
      };
    }

    const fallback = generateConversationalReply(trimmed, {
      balance: options.balance,
      history: options.history,
    });
    return {
      reply: composeEmotionalReply(fallback, emotional, { userText: trimmed }),
      engine: "brain",
      searchedWeb: false,
      sources: ["conversational"],
    };
  }

  if (shouldAutonomousWebSearch(trimmed)) {
    const result = await searchWebReal(trimmed);
    if (result) {
      const reply = formatRealSearchAnswer(result, lang);
      return {
        reply: composeEmotionalReply(reply, emotional, { userText: trimmed, factual: true }),
        engine: "web-search",
        searchedWeb: true,
        sources: [result.url ?? "wikipedia"],
      };
    }
  }

  const reply = generateConversationalReply(trimmed, {
    balance: options.balance,
    history: options.history,
  });
  return {
    reply: composeEmotionalReply(reply, emotional, { userText: trimmed }),
    engine: "brain",
    searchedWeb: false,
    sources: ["conversational"],
  };
}
