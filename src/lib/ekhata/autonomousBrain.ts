/**
 * e-Khata Autonomous Brain
 *
 * Self-directed reasoning: decides WHEN to search the web, HOW to answer,
 * and handles system/meta questions — not rigid keyword routing.
 */

import { searchWeb, formatSearchResults, isCurrentEventQuery } from "../falconWebSearch";
import { searchKnowledge } from "./nepaliBrain";
import { composeEmotionalReply, detectEmotionalContext } from "./emotionalBrain";
import { generateConversationalReply, type ConversationTurn } from "./conversationalBrain";
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

// ─── Meta / system questions (bot status, online, capabilities) ─────────────

const META_ONLINE =
  /\b(am\s+i\s+online|online\s*du|online\s*chu|online\s*chau|online\s*ho|ahile\s+online|k\s*ma\s+online|ke\s+ma\s+online|connected|connection|internet|llm\s*online|ollama\s*online|timi\s+online|tapai\s+online)\b/i;

const META_STATUS =
  /\b(what\s+are\s+you|who\s+are\s+you|what\s+can\s+you|what\s+do\s+you|timi\s+ko\s+ho|ke\s+ho\s+timi|your\s+brain|mero\s+brain|status|health)\b/i;

const EXPLICIT_SEARCH =
  /\b(search|google|look\s*up|find\s+online|web\s*search|internet\s*ma\s*khoj|online\s*ma\s*her|khojera\s*bhannu)\b/i;

const NEEDS_WEB =
  /\b(today|now|current|latest|news|weather|mausam|price\s+of|exchange\s+rate|who\s+won|election|population|score|live|real\s*time|update|aaja\s+ko|ahile\s+ko)\b/i;

const GENERAL_KNOWLEDGE =
  /\b(what\s+is|who\s+is|where\s+is|when\s+did|how\s+much|tell\s+me\s+about|k\s*ho|ke\s+ho|kun\s+ho|kati\s+ho|explain|define)\b/i;

function buildSearchQuery(text: string): string {
  const q = text
    .replace(/\b(k\s*ho|ke\s+ho|bhannu|sodh|please|hajur|tapai|timi)\b/gi, " ")
    .replace(/\?+$/, "")
    .trim();
  if (q.length < 4) return text.replace(/\?+$/, "").trim();
  return q;
}

function answerMetaQuestion(text: string, opts: AutonomousBrainOptions): string | null {
  const t = text.toLowerCase();

  if (META_ONLINE.test(t)) {
    if (opts.llmOnline) {
      return (
        `Hajur, hajur online hunuhunchha — internet connection chha! 🟢\n\n` +
        `e-Khata pani online chha. Ollama LLM ${opts.llmModel ? `(${opts.llmModel})` : ""} connected chha — full AI brain active.\n\n` +
        `Khata entry, accounting sawal, wa kunai pani kura — sodhnus!`
      );
    }
    return (
      `Hajur online hunuhunchha — tapai ko browser/internet chaliraheko chha! 🟢\n\n` +
      `e-Khata ko **built-in autonomous brain** active chha (CA + Emotional AI + Web Search). ` +
      `Ollama LLM ahile offline chha — tara ma web search ra local brain bata help garchhu.\n\n` +
      `Ke help garna sakchhu?`
    );
  }

  if (META_STATUS.test(t) && !/\b(vat|tax|debit|credit|balance)\b/i.test(t)) {
    return (
      `Ma **e-Khata Autonomous Brain** ho — tapaiko self-contained AI sahayogi:\n\n` +
      `🧠 **Autonomous reasoning** — sawal bujhchhu, khojchu, jawaf dinchhu\n` +
      `🌐 **Web search** — aaja ko news, weather, facts — internet bata khojchhu\n` +
      `📒 **CA accounting** — journal entries, natural language ma ("sold 200 cups @ 50")\n` +
      `💚 **Emotional AI** — tapai ko mood bujhchhu, empathetic jawaf\n` +
      `${opts.llmOnline ? `🟢 Ollama LLM online (${opts.llmModel ?? "connected"})` : "🟡 Ollama offline — built-in brain + web search active"}\n\n` +
      `Kunai pani sawal sodhnus — ma afai sochera jawaf dinchhu!`
    );
  }

  return null;
}

export function shouldAutonomousWebSearch(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (META_ONLINE.test(t) || META_STATUS.test(t)) return false;
  if (EXPLICIT_SEARCH.test(t)) return true;
  if (isCurrentEventQuery(t) || NEEDS_WEB.test(t)) return true;
  // Unknown general knowledge without local answer
  if (GENERAL_KNOWLEDGE.test(t) && t.length > 8) return true;
  return false;
}

async function performWebSearch(
  query: string,
): Promise<{ text: string | null; sources: string[] }> {
  try {
    const results = await searchWeb(buildSearchQuery(query), { timeout: 8000 });
    if (results.error && results.results.length === 0) {
      return { text: null, sources: [] };
    }
    const formatted = formatSearchResults(results);
    const sources = results.results.map((r) => r.url ?? r.source).filter(Boolean) as string[];
    return { text: formatted, sources };
  } catch {
    return { text: null, sources: [] };
  }
}

function composeWebAnswer(
  query: string,
  searchText: string,
  lang: "nepali" | "english" | "mixed",
): string {
  const intro =
    lang === "english"
      ? "I searched the web for you:\n\n"
      : "Maile internet bata khojera yo paye:\n\n";

  const body = searchText.replace(/^Web search results for '[^']+':\n?/, "").trim();

  const closer =
    lang === "english" ? "\n\nNeed anything else?" : "\n\nAru kei chahiyo bhane sodhnus!";

  return `${intro}${body}${closer}`;
}

function detectLang(text: string): "nepali" | "english" | "mixed" {
  if (/[\u0900-\u097F]/.test(text)) return "nepali";
  if (/\b(the|is|are|what|who|how|am|i|online|you|your)\b/i.test(text)) return "english";
  return "mixed";
}

/**
 * Main autonomous brain — async, self-directed, web-search capable.
 */
export async function askAutonomousBrain(
  text: string,
  options: AutonomousBrainOptions = {},
): Promise<AutonomousBrainResult> {
  const trimmed = text.trim();
  const lang = detectLang(trimmed);
  const emotional = detectEmotionalContext(trimmed, options.history ?? []);

  // 1. Meta/system questions — instant accurate answer
  const meta = answerMetaQuestion(trimmed, options);
  if (meta) {
    return {
      reply: composeEmotionalReply(meta, emotional, { userText: trimmed }),
      engine: "autonomous",
      searchedWeb: false,
      sources: ["system"],
    };
  }

  // 2. Local knowledge base first (fast, no network)
  const local = searchKnowledge(trimmed);
  if (local && !shouldAutonomousWebSearch(trimmed)) {
    return {
      reply: composeEmotionalReply(local, emotional, { userText: trimmed }),
      engine: "autonomous",
      searchedWeb: false,
      sources: ["knowledge-base"],
    };
  }

  // 3. Web search when brain decides it needs external info
  if (shouldAutonomousWebSearch(trimmed)) {
    const { text: searchText, sources } = await performWebSearch(trimmed);
    if (searchText) {
      const reply = composeWebAnswer(trimmed, searchText, lang);
      return {
        reply: composeEmotionalReply(reply, emotional, { userText: trimmed }),
        engine: "web-search",
        searchedWeb: true,
        sources,
      };
    }
  }

  // 4. Fallback — conversational + emotional brain
  const conversational = generateConversationalReply(trimmed, {
    balance: options.balance,
    history: options.history,
  });

  return {
    reply: conversational,
    engine: "brain",
    searchedWeb: false,
    sources: ["conversational-brain"],
  };
}
